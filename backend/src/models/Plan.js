const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, enum: ['Residential', 'Business'], default: 'Residential', required: true },
    tagline: { type: String, default: '', trim: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0.01 },
    durationMonths: { type: Number, required: true, min: 1, max: 120 },
    features: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

planSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Plan', planSchema);