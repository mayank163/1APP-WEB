const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    used: { type: Number, default: 0 }, reserved: { type: Number, default: 0 }
});
schema.index({ offer: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('OfferUsage', schema);
