const mongoose = require('mongoose');

const planPurchaseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    planName: { type: String, required: true },
    category: { type: String, enum: ['Residential', 'Business'], default: 'Residential', required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true },
    durationMonths: { type: Number, required: true, min: 1 },
    features: { type: [String], default: [] },
    paymentIntentId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'active', 'expired', 'replaced'], default: 'pending', index: true },
    paidAt: { type: Date, default: null },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    replacedAt: { type: Date, default: null }
}, { timestamps: true });

planPurchaseSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('PlanPurchase', planPurchaseSchema);