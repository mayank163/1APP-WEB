const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const Usage = require('../models/OfferUsage');
const Redemption = require('../models/OfferRedemption');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { fail, discountFor } = require('../utils/offerRules');

async function priceLines(items) {
    if (!Array.isArray(items) || !items.length || items.length > 100) fail('Select between 1 and 100 services.');
    const lines = [];
    for (const item of items) {
        if (!mongoose.isValidObjectId(item.service) || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 1000) fail('Invalid service or quantity.');
        const service = await Service.findById(item.service);
        if (!service || !service.isActive || service.status === 'draft' || service.status === 'inactive') fail('A selected service is unavailable.');
        const variants = service.variants.filter(v => v.isActive !== false);
        const variant = item.variantId ? variants.find(v => String(v._id) === String(item.variantId)) : service.hasVariants ? variants[0] : null;
        if ((item.variantId || service.hasVariants) && !variant) fail('Selected variant is unavailable.');
        let price = Number(variant ? variant.offerPrice || variant.actualPrice : service.price);
        if (item.addonIds != null && !Array.isArray(item.addonIds)) fail('Invalid add-ons.');
        for (const id of [...new Set(item.addonIds || [])]) {
            const addon = service.addons.find(a => String(a._id) === String(id) && a.isActive !== false);
            if (!addon) fail('Selected add-on is unavailable.');
            price += addon.price;
        }
        lines.push({ service: service._id, category: service.category, price, quantity: Number(item.quantity) });
    }
    return lines;
}
async function evaluate(code, userId, lines, currency) {
    if (typeof code !== 'string' || !/^[A-Z0-9-]{1,30}$/.test(code.trim().toUpperCase())) fail('Invalid coupon code.');
    const offer = await Offer.findOne({ code: code.trim().toUpperCase() });
    if (!offer) fail('Coupon not found.', 404);
    if (currency && offer.currency !== currency) fail(`This coupon is available for ${offer.currency} orders only.`);
    const hasBookings = offer.eligibility === 'new' && Boolean(await Booking.exists({ user: userId, paymentStatus: 'Paid' }));
    const amounts = discountFor(offer, lines, userId, hasBookings);
    const usage = await Usage.findOne({ offer: offer._id, user: userId });
    if (offer.totalLimit != null && offer.used + offer.reserved >= offer.totalLimit) fail('Coupon redemption limit reached.');
    if (usage && usage.used + usage.reserved >= offer.perCustomerLimit) fail('You have reached the usage limit for this coupon.');
    return { offer, ...amounts };
}
async function reserve(code, userId, lines, attempt, currency) {
    const quote = await evaluate(code, userId, lines, currency);
    // Both global and per-customer limits are claimed in a single transaction.
    await mongoose.connection.transaction(async session => {
        const offer = await Offer.findOneAndUpdate({ _id: quote.offer._id, __v: quote.offer.__v, publicationStatus: { $in: ['active', 'scheduled'] }, startsAt: { $lte: new Date() }, endsAt: { $gt: new Date() }, $expr: { $or: [{ $eq: ['$totalLimit', null] }, { $lt: [{ $add: ['$used', '$reserved'] }, '$totalLimit'] }] } }, { $inc: { reserved: 1, __v: 1 } }, { new: true, session });
        if (!offer) fail('Coupon availability changed. Please try again.', 409);
        await Usage.updateOne({ offer: offer._id, user: userId }, { $setOnInsert: { used: 0, reserved: 0 } }, { upsert: true, session });
        const usage = await Usage.findOneAndUpdate({ offer: offer._id, user: userId, $expr: { $lt: [{ $add: ['$used', '$reserved'] }, offer.perCustomerLimit] } }, { $inc: { reserved: 1 } }, { session });
        if (!usage) fail('You have reached the usage limit for this coupon.', 409);
        await Redemption.create([{ offer: offer._id, user: userId, attempt, discount: quote.discount }], { session });
    });
    return { offer: quote.offer._id, code: quote.offer.code, discount: quote.discount, subtotal: quote.subtotal };
}
async function settle(attempt, booking = null) {
    await mongoose.connection.transaction(async session => {
        const claim = await Redemption.findOneAndUpdate({ attempt, status: 'reserved' }, { $set: { status: booking ? 'completed' : 'released', booking } }, { session });
        if (!claim) return;
        const increment = { reserved: -1, ...(booking ? { used: 1 } : {}) };
        await Offer.updateOne({ _id: claim.offer }, { $inc: increment }, { session });
        await Usage.updateOne({ offer: claim.offer, user: claim.user }, { $inc: increment }, { session });
    });
}
module.exports = { priceLines, evaluate, reserve, settle };
