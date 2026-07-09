const mongoose = require('mongoose');

const contentBlockSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    image: { type: String, default: null },
    text: { type: String, default: '' },
    order: { type: Number, default: 0 }
}, { _id: false });

const blogSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '', trim: true },
    description: { type: String, required: true },
    featuredImage: { type: String, default: null },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
    contentBlocks: [contentBlockSchema],
    isPublished: { type: Boolean, default: true },
    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Blog', blogSchema);
