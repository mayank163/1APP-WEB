const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 30, match: /^[A-Z0-9-]+$/, unique: true },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    description: { type: String, trim: true, maxlength: 120, default: '' },
    image: { type: String, default: '' },
    icon: { type: String, enum: ['tag', 'gift', 'percent', 'tool', 'home', 'calendar'], default: 'tag' },
    currency: { type: String, enum: ['USD', 'INR'], default: 'USD' },
    discountType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    discountValue: { type: Number, min: 0, default: 0 },
    maximumDiscount: { type: Number, min: 0, default: null },
    applicability: { type: String, enum: ['all', 'services', 'categories', 'minimum'], default: 'all' },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    minimumOrderValue: { type: Number, min: 0, default: 0 },
    eligibility: { type: String, enum: ['all', 'new', 'selected'], default: 'all' },
    customers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    totalLimit: { type: Number, min: 1, default: null },
    perCustomerLimit: { type: Number, min: 1, default: 1 },
    publicationStatus: { type: String, enum: ['draft', 'active', 'scheduled', 'inactive'], default: 'draft' },
    used: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ publicationStatus: 1, startsAt: 1, endsAt: 1 });
module.exports = mongoose.model('Offer', schema);
