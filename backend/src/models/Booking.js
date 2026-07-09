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
        type: String,
        required: [true, 'Please provide service address']
    },
    phone: {
        type: String,
        required: [true, 'Please provide contact phone number']
    },
    serviceDate: {
        type: Date,
        required: [true, 'Please provide service date']
    },
    timeSlot: {
        type: String,
        required: [true, 'Please provide service time slot']
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'],
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

module.exports = mongoose.model('Booking', bookingSchema);
