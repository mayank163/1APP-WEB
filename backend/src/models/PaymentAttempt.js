const mongoose = require('mongoose');

const paymentAttemptSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    services: [{
        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service',
            required: true
        },
        quantity: { type: Number, required: true, min: 1 },
        variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
        variantName: { type: String, default: '', trim: true },
        selectedAddons: [{
            addonId: { type: mongoose.Schema.Types.ObjectId, default: null },
            name: { type: String, default: '', trim: true },
            price: { type: Number, default: 0, min: 0 }
        }],
        price: { type: Number, required: true }
    }],
    coupon: {
        offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
        code: String, discount: { type: Number, min: 0 }, subtotal: { type: Number, min: 0 }
    },
    totalAmount: { type: Number, required: true, min: 0 },
    address: {
        label: { type: String, default: 'Home' },
        name: { type: String, default: '', trim: true },
        addressLine: { type: String, required: true, trim: true },
        city: { type: String, default: '', trim: true },
        state: { type: String, default: '', trim: true },
        zipcode: { type: String, default: '', trim: true },
        coordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        }
    },
    phone: { type: String, required: true },
    serviceDate: { type: Date, required: true },
    specialInstructions: { type: String, default: '' },
    paymentDetails: {
        provider: { type: String, required: true, enum: ['stripe', 'razorpay', 'paypal'] },
        orderId: { type: String, required: true },
        currency: String
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Completed', 'Cancelling', 'Cancelled'],
        default: 'Pending'
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    }
}, {
    timestamps: true
});

paymentAttemptSchema.index({ 'paymentDetails.orderId': 1 }, { unique: true });

module.exports = mongoose.model('PaymentAttempt', paymentAttemptSchema);
