const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    sizeCapacity: { type: String, trim: true },
    unit: { type: String, trim: true },
    actualPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    offerPrice: { type: Number, default: 0, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
}, { _id: true });

const addonSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
}, { _id: true });

const listItemSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    icon: { type: String, default: '' }
}, { _id: true });

const faqSchema = new mongoose.Schema({
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 }
}, { _id: true });

const galleryItemSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'video', 'youtube', 'vimeo'], default: 'image' },
    url: { type: String, required: true },
    order: { type: Number, default: 0 }
}, { _id: true });

const toolSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    description: { type: String, trim: true }
}, { _id: true });

const processStepSchema = new mongoose.Schema({
    stepNumber: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    image: { type: String, default: '' }
}, { _id: true });

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Service name is required'], trim: true },
    shortDescription: [{ type: String, required: [true, 'Short description is required'], trim: true }],
    longDescription: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: [true, 'Subcategory is required'] },
    serviceType: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    isFeatured: { type: Boolean, default: false },
    serviceDuration: { type: Number, default: 0, min: 0 },
    hasVariants: { type: Boolean, default: false },
    actualPrice: { type: Number, required: [true, 'Actual price is required'], min: 0, default: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    offerPrice: { type: Number, min: 0, default: 0 },
    variants: [variantSchema],
    addons: [addonSchema],
    includedItems: [listItemSchema],
    excludedItems: [listItemSchema],
    faqs: [faqSchema],
    featuredImage: { type: String, default: '' },
    gallery: [galleryItemSchema],
    requirements: [{ title: { type: String, required: true, trim: true }, image: { type: String, default: '' } }],
    tools: [toolSchema],
    processSteps: [processStepSchema],
    isActive: { type: Boolean, default: true },
    ratingsAverage: { type: Number, default: 4.5, min: 1, max: 5 },
    ratingsQuantity: { type: Number, default: 0 }
}, { timestamps: true });

// NO PRE-SAVE MIDDLEWARE - REMOVED

serviceSchema.index({ category: 1, subcategory: 1 });
serviceSchema.index({ status: 1 });

serviceSchema.virtual('price').get(function() {
    if (this.hasVariants && this.variants?.length) {
        const prices = this.variants.map(v => v.offerPrice || v.actualPrice);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return min === max ? min : { min, max };
    }
    return this.offerPrice || this.actualPrice || 0;
});

serviceSchema.virtual('duration').get(function() {
    if (this.hasVariants && this.variants?.length) {
        const durations = this.variants.map(v => v.duration).filter(d => d > 0);
        if (durations.length === 0) return this.serviceDuration || 0;
        return Math.max(...durations);
    }
    return this.serviceDuration || 0;
});

serviceSchema.virtual('description').get(function() {
    return this.shortDescription?.join(' ') || '';
});

serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);