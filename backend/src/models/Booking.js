const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Booking must belong to a user']
    },
    services: [
        {
            service: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Service',
                required: true
            },
            quantity: {
                type: Number,
                default: 1,
                min: 1
            },
            variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
            variantName: { type: String, default: '', trim: true },
            selectedAddons: [{
                addonId: { type: mongoose.Schema.Types.ObjectId, default: null },
                name: { type: String, default: '', trim: true },
                price: { type: Number, default: 0, min: 0 }
            }],
            price: {
                type: Number,
                required: true
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: [true, 'Booking must have a total amount']
    },
    address: {
        // Structured address captured at booking time
        label: { type: String, default: 'Home' },
        name: { type: String, default: '', trim: true },  // custom nickname: "My Home", "Friend's Home"
        addressLine: { type: String, required: [true, 'Please provide address line'], trim: true },
        city: { type: String, default: '', trim: true },
        state: { type: String, default: '', trim: true },
        zipcode: { type: String, default: '', trim: true },
        coordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        }
    },
    phone: {
        type: String,
        required: [true, 'Please provide contact phone number']
    },
    serviceDate: {
        type: Date,
        required: [true, 'Please provide service date']
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Assigned', 'On the Way', 'In Progress', 'Checkout', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    paymentDetails: {
        provider: String,
        orderId: String,
        paymentId: String,
        signature: String,
        transactionId: String
    },
    assignedTechnician: {
        name: { type: String, default: '' },
        phone: { type: String, default: '' }
    },
    specialInstructions: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

bookingSchema.index({ 'paymentDetails.orderId': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Booking', bookingSchema);
