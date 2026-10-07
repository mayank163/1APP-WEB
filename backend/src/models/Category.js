const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide category name'],
        trim: true,
        unique: true
    },
    image: {
        type: String,
        default: null
    },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive', 'draft'] },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
