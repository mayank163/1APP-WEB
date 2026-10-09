const mongoose = require('mongoose');

const contentBlockSchema = new mongoose.Schema({
    type: { type: String, enum: ['text', 'heading', 'image', 'text-image', 'quote', 'bullet-list', 'numbered-list', 'callout'], default: 'text-image' },
    title: { type: String, default: '', maxlength: 200 },
    altText: { type: String, default: '', maxlength: 200 },
    caption: { type: String, default: '', maxlength: 500 },
    attribution: { type: String, default: '', maxlength: 200 },
    calloutType: { type: String, enum: ['note', 'tip', 'warning'], default: 'note' },
    items: [{ type: String }],
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
    imageAltText: { type: String, default: '', maxlength: 200 },
    isFeatured: { type: Boolean, default: false },
    author: { type: String, default: '', trim: true, maxlength: 100 },
    slug: { type: String, trim: true, lowercase: true, maxlength: 200 },
    publicationTimezone: { type: String, default: 'Asia/Kolkata' },
    isPublished: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    scheduledAt: { type: Date, default: null },
    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true }
}, { timestamps: true });

blogSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } });

module.exports = mongoose.model('Blog', blogSchema);
