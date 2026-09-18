const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        recipientModel: {
            type: String,
            enum: ['User', 'Admin'],
            required: true,
            default: 'User',
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        senderModel: {
            type: String,
            enum: ['User', 'Admin'],
            default: null,
        },

        type: {
            type: String,
            required: true,
        },

        title: {
            type: String,
            required: true,
        },

        message: {
            type: String,
            required: true,
        },

        data: {
            type: Object,
            default: {},
        },

        isRead: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    'Notification',
    notificationSchema
);