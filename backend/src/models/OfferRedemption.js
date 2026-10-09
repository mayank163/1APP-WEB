const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAttempt', required: true, unique: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    status: { type: String, enum: ['reserved', 'completed', 'released'], default: 'reserved' },
    discount: { type: Number, required: true }
}, { timestamps: true });
schema.index({ offer: 1, user: 1, status: 1 });
module.exports = mongoose.model('OfferRedemption', schema);
