const mongoose = require('mongoose');

// Separate from User so credentials can never leak through profile responses.
const schema = new mongoose.Schema({
    subject: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    refreshToken: { type: String, required: true, select: false }
}, { timestamps: true });
module.exports = mongoose.model('AppleGrant', schema);
