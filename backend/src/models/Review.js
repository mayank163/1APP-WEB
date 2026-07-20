'use strict';

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: [true, 'Review must belong to a service'],
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Review must belong to a user'],
        index: true,
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: [true, 'Review must reference a completed booking'],
    },
    rating: {
        type: Number,
        required: [true, 'Please provide a rating'],
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5'],
    },
    review: {
        type: String,
        trim: true,
        maxlength: [1000, 'Review cannot exceed 1000 characters'],
        default: '',
    },
}, { timestamps: true });

// One review per user per service PER BOOKING
// This allows a user to review the same service again if they book it a second time
reviewSchema.index({ service: 1, user: 1, booking: 1 }, { unique: true });

// ─── Statics: recalculate ratingsAverage & ratingsQuantity on Service ─────────
reviewSchema.statics.calcAverageRatings = async function (serviceId) {
    const stats = await this.aggregate([
        { $match: { service: serviceId } },
        {
            $group: {
                _id: '$service',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$rating' },
            },
        },
    ]);

    const Service = require('./Service');
    if (stats.length > 0) {
        await Service.findByIdAndUpdate(serviceId, {
            ratingsQuantity: stats[0].nRating,
            ratingsAverage: Math.round(stats[0].avgRating * 10) / 10,
        });
    } else {
        await Service.findByIdAndUpdate(serviceId, {
            ratingsQuantity: 0,
            ratingsAverage: 0,
        });
    }
};

// Recalculate after save
reviewSchema.post('save', function () {
    this.constructor.calcAverageRatings(this.service);
});

// Recalculate after delete
reviewSchema.post('findOneAndDelete', function (doc) {
    if (doc) doc.constructor.calcAverageRatings(doc.service);
});

module.exports = mongoose.model('Review', reviewSchema);
