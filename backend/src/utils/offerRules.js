const fail = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
function effectiveStatus(offer, now = new Date()) {
    if (['draft', 'inactive'].includes(offer.publicationStatus)) return offer.publicationStatus;
    if (offer.endsAt && new Date(offer.endsAt) <= now) return 'expired';
    if (offer.totalLimit != null && offer.used >= offer.totalLimit) return 'exhausted';
    if (offer.startsAt && new Date(offer.startsAt) > now) return 'scheduled';
    return 'active';
}
function discountFor(offer, lines, userId, hasBookings = false) {
    if (effectiveStatus(offer) !== 'active') fail('This coupon is not currently available.');
    if (offer.eligibility === 'new' && hasBookings) fail('This coupon is for first-time customers only.');
    if (offer.eligibility === 'selected' && !offer.customers.some(id => String(id) === String(userId))) fail('You are not eligible for this coupon.');
    const total = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!Number.isFinite(total) || total <= 0) fail('A valid order is required.');
    if (total < offer.minimumOrderValue) fail(`Minimum order value is ${offer.minimumOrderValue}.`);
    const eligible = lines.filter(item => offer.applicability === 'services' ? offer.services.some(id => String(id) === String(item.service)) : offer.applicability === 'categories' ? offer.categories.some(id => String(id) === String(item.category)) : true);
    const amount = eligible.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (amount <= 0) fail('This coupon does not apply to the selected services.');
    let discount = offer.discountType === 'percentage' ? amount * offer.discountValue / 100 : offer.discountValue;
    if (offer.maximumDiscount != null) discount = Math.min(discount, offer.maximumDiscount);
    discount = Math.round(Math.min(amount, discount) * 100) / 100;
    if (discount <= 0) fail('This coupon has no applicable discount.');
    return { subtotal: Math.round(total * 100) / 100, discount, total: Math.round((total - discount) * 100) / 100 };
}
function parseOffer(body) {
    if (!body || typeof body !== 'object') fail('Invalid coupon payload.');
    const out = {};
    for (const [key, max] of [['code', 30], ['title', 120], ['description', 120]]) {
        if (typeof body[key] !== 'string') fail(`${key} must be text.`);
        out[key] = body[key].trim();
        if (out[key].length > max) fail(`${key} is too long.`);
    }
    out.image = body.image || '';
    if (typeof out.image !== 'string' || (out.image && !/^(?:\/uploads\/)?offers\/[a-f0-9-]+\.webp$/.test(out.image))) fail('Invalid promotional image.');
    out.code = out.code.toUpperCase();
    if (!/^[A-Z0-9-]{1,30}$/.test(out.code)) fail('Use uppercase letters, numbers and hyphens for the coupon code.');
    const enums = { currency: ['USD', 'INR'], icon: ['tag', 'gift', 'percent', 'tool', 'home', 'calendar'], discountType: ['percentage', 'flat'], applicability: ['all', 'services', 'categories', 'minimum'], eligibility: ['all', 'new', 'selected'], publicationStatus: ['draft', 'active', 'scheduled', 'inactive'] };
    for (const [key, values] of Object.entries(enums)) { if (!values.includes(body[key])) fail(`Invalid ${key}.`); out[key] = body[key]; }
    for (const key of ['discountValue', 'maximumDiscount', 'minimumOrderValue', 'totalLimit', 'perCustomerLimit']) {
        const optional = ['maximumDiscount', 'totalLimit'].includes(key);
        if (optional && (body[key] === '' || body[key] == null)) { out[key] = null; continue; }
        if (body[key] === '' || body[key] == null || typeof body[key] === 'boolean') fail(`Invalid ${key}.`);
        const number = Number(body[key]);
        if (!Number.isFinite(number) || number < 0 || (['totalLimit', 'perCustomerLimit'].includes(key) && (!Number.isSafeInteger(number) || number < 1))) fail(`Invalid ${key}.`);
        out[key] = number;
    }
    if (out.discountType === 'percentage' && out.discountValue > 100) fail('Percentage cannot exceed 100.');
    for (const key of ['services', 'categories', 'customers']) {
        if (!Array.isArray(body[key]) || body[key].length > 1000 || body[key].some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) fail(`Invalid ${key}.`);
        out[key] = [...new Set(body[key])];
    }
    for (const key of ['startsAt', 'endsAt']) { out[key] = body[key] ? new Date(body[key]) : null; if (out[key] && !Number.isFinite(out[key].getTime())) fail(`Invalid ${key}.`); }
    if (out.startsAt && out.endsAt && out.endsAt <= out.startsAt) fail('End time must be after start time.');
    if (out.publicationStatus !== 'draft') {
        if (!out.title || !out.description) fail('Title and description are required.');
        if (out.discountValue <= 0 || out.maximumDiscount === 0) fail('Discount must be greater than zero.');
        if (!out.startsAt || !out.endsAt) fail('Start and end dates are required.');
        if (out.applicability === 'services' && !out.services.length) fail('Select at least one service.');
        if (out.applicability === 'categories' && !out.categories.length) fail('Select at least one category.');
        if (out.applicability === 'minimum' && out.minimumOrderValue <= 0) fail('Enter a minimum order value.');
        if (out.eligibility === 'selected' && !out.customers.length) fail('Select eligible customers.');
    }
    return out;
}
module.exports = { fail, effectiveStatus, discountFor, parseOffer };
