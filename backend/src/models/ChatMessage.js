const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderRole: {
        type: String,
        enum: ['admin', 'technician'],
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video'],
        required: true
    },
    text: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: ''
    },
    media: {
        url: { type: String, default: '' },
        key: { type: String, default: '' },
        mimeType: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    readBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, required: true },
        readAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

chatMessageSchema.index({ technicianId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);