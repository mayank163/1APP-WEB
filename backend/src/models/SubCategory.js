const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide subcategory name'],
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Please provide category']
    },
    image: {
        type: String,
        default: null
    },
    icon: {
        type: String,
        default: null
    },
    startingFromPrice: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive', 'draft'] },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

subCategorySchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('SubCategory', subCategorySchema);
