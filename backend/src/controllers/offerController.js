const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const Service = require('../models/Service');
const Category = require('../models/Category');
const User = require('../models/User');
const Redemption = require('../models/OfferRedemption');
const { parseOffer, effectiveStatus, fail } = require('../utils/offerRules');
const offerService = require('../services/offerService');
const sharp = require('sharp');
const { uploadFile } = require('../utils/s3Upload');
const safe = o => ({ ...o.toObject(), status: effectiveStatus(o) });
const id = value => { if (!mongoose.isValidObjectId(value)) fail('Invalid coupon ID.'); return value; };
exports.list = async (req, res, next) => { try {
    const offers = await Offer.find().sort('-createdAt');
    res.json({ success: true, data: { offers: offers.map(safe) } });
} catch (e) { next(e); } };
exports.options = async (req, res, next) => { try {
    const [services, categories] = await Promise.all([Service.find({ isActive: true, status: { $nin: ['draft', 'inactive'] } }).select('name category').sort('name'), Category.find({ isActive: true }).select('name').sort('name')]);
    const search = String(req.query.customerSearch || '').trim();
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customers = search.length >= 2 ? await User.find({ role: 'user', accountStatus: 'active', $or: [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }, { phone: { $regex: escaped } }] }).select('name email phone').limit(30) : [];
    res.json({ success: true, data: { services, categories, customers } });
} catch (e) { next(e); } };
async function references(values) {
    for (const [field, Model, filter] of [['services', Service, { isActive: true }], ['categories', Category, { isActive: true }], ['customers', User, { role: 'user', accountStatus: 'active' }]]) {
        if (values[field].length && await Model.countDocuments({ ...filter, _id: { $in: values[field] } }) !== values[field].length) fail(`One or more selected ${field} are unavailable.`);
    }
}
exports.save = async (req, res, next) => { try {
    const values = parseOffer(req.body);
    await references(values);
    let offer;
    if (req.params.id) {
        offer = await Offer.findById(id(req.params.id));
        if (!offer) fail('Coupon not found.', 404);
        if (offer.reserved > 0) fail('This coupon has pending payments. Retry after those payments are resolved.', 409);
        if (offer.used > 0 && values.code !== offer.code) fail('The code cannot be changed after a successful redemption.');
        if (values.totalLimit != null && values.totalLimit < offer.used) fail('Total limit cannot be below successful redemptions.');
        Object.assign(offer, values);
        await offer.save();
    } else offer = await Offer.create({ ...values, createdBy: req.user._id });
    res.status(req.params.id ? 200 : 201).json({ success: true, data: { offer: safe(offer) } });
} catch (e) { if (e.code === 11000) { e.statusCode = 409; e.message = 'This coupon code already exists.'; } if (e.name === 'VersionError') { e.statusCode = 409; e.message = 'Coupon changed. Refresh and try again.'; } next(e); } };
exports.status = async (req, res, next) => { try {
    if (req.body.publicationStatus !== 'inactive') fail('Use the editor to publish or activate a coupon.');
    const offer = await Offer.findByIdAndUpdate(id(req.params.id), { $set: { publicationStatus: 'inactive' }, $inc: { __v: 1 } }, { new: true });
    if (!offer) fail('Coupon not found.', 404);
    res.json({ success: true, data: { offer: safe(offer) } });
} catch (e) { next(e); } };
exports.upload = async (req, res, next) => { try {
    if (!req.file) fail('Select an image.');
    let metadata;
    try { metadata = await sharp(req.file.buffer, { limitInputPixels: 20000000 }).metadata(); }
    catch { fail('This image could not be read. Choose a valid JPG, PNG or WebP image.'); }
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) fail('Only JPG, PNG and WebP are supported.');
    const buffer = await sharp(req.file.buffer, { limitInputPixels: 20000000 }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const uploaded = await uploadFile({ buffer, originalname: 'coupon.webp', mimetype: 'image/webp' }, 'offers');
    res.status(201).json({ success: true, data: { image: uploaded.key } });
} catch (e) { if (!e.statusCode) { e.statusCode = 500; e.message = 'Unable to upload promotional image. Please try again.'; } next(e); } };
exports.image = async (req, res, next) => { try {
    if (typeof req.body.image !== 'string' || (req.body.image && !/^(?:\/uploads\/)?offers\/[a-f0-9-]+\.webp$/.test(req.body.image))) fail('Invalid promotional image.');
    const offer = await Offer.findByIdAndUpdate(id(req.params.id), { $set: { image: req.body.image }, $inc: { __v: 1 } }, { new: true });
    if (!offer) fail('Coupon not found.', 404);
    res.json({ success: true, data: { offer: safe(offer) } });
} catch (e) { next(e); } };
exports.redemptions = async (req, res, next) => { try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = { offer: id(req.params.id), status: 'completed' };
    const [records, total] = await Promise.all([Redemption.find(filter).populate('user', 'name email').sort('-updatedAt').skip((page - 1) * 20).limit(20), Redemption.countDocuments(filter)]);
    res.json({ success: true, data: { records, total, page } });
} catch (e) { next(e); } };
exports.available = async (req, res, next) => { try {
    const now = new Date();
    const offers = await Offer.find({ publicationStatus: { $in: ['active', 'scheduled'] }, startsAt: { $lte: now }, endsAt: { $gt: now }, $or: [{ eligibility: { $in: ['all', 'new'] } }, { eligibility: 'selected', customers: req.user._id }] });
    res.json({ success: true, data: { offers: offers.filter(o => effectiveStatus(o) === 'active').map(o => ({ _id: o._id, code: o.code, title: o.title, description: o.description, image: o.image, icon: o.icon, currency: o.currency, discountType: o.discountType, discountValue: o.discountValue, maximumDiscount: o.maximumDiscount, minimumOrderValue: o.minimumOrderValue, startsAt: o.startsAt, endsAt: o.endsAt, eligibility: o.eligibility })) } });
} catch (e) { next(e); } };
exports.validate = async (req, res, next) => { try {
    const lines = await offerService.priceLines(req.body.services);
    const quote = await offerService.evaluate(req.body.code, req.user._id, lines, req.body.paymentProvider === 'paypal' ? require('../config/paypal').currency() : (process.env.STRIPE_CURRENCY || 'usd').toUpperCase());
    res.json({ success: true, data: { code: quote.offer.code, subtotal: quote.subtotal, discount: quote.discount, total: quote.total } });
} catch (e) { next(e); } };
