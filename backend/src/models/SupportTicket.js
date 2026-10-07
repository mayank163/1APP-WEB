const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    ticketId: { type: String, unique: true, required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 10000 },
    category: { type: String, required: true, maxlength: 80 },
    subcategory: { type: String, maxlength: 120, default: '' },
    relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    relatedBookingLabel: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['open', 'in_progress', 'escalated', 'resolved', 'closed'], default: 'open' },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    attachments: [{ name: String, url: String, mimeType: String, size: Number }],
    audit: [{ action: String, actor: String, createdAt: { type: Date, default: Date.now } }],
    unreadUser: { type: Number, default: 0 },
    unreadAdmin: { type: Number, default: 0 }
}, { timestamps: true });
schema.index({ requester: 1, updatedAt: -1 });
schema.index({ status: 1, priority: 1, updatedAt: -1 });
module.exports = mongoose.model('SupportTicket', schema);
