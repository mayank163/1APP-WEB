const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderName: String,
    senderRole: { type: String, enum: ['admin', 'user', 'technician'], required: true },
    text: { type: String, maxlength: 4000, default: '' },
    internal: { type: Boolean, default: false },
    attachment: { name: String, url: String, mimeType: String, size: Number }
}, { timestamps: true });
schema.index({ ticket: 1, createdAt: -1 });
module.exports = mongoose.model('SupportMessage', schema);
