const admin = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');

const Notification = require('../models/Notification');
const { getIO } = require('../utils/socketInstance');
const User = require('../models/User');
const Admin = require('../models/Admin');

const MAX_MULTICAST_TOKENS = 500;
const INVALID_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

const firebaseErrorDetails = (error, tokens) => {
    let message = String(error?.message || 'Unknown Firebase error');
    // Firebase errors can include the registration token in their message.
    for (const token of tokens) message = message.split(token).join('[redacted token]');
    return { code: error?.code || 'unknown', message };
};

const sendNotification = async ({
    recipients,
    sender = null,
    type,
    title,
    message,
    data = {},
}) => {
    let tokens = [];
    try {

        if (!recipients || recipients.length === 0) {
            console.log(`[Firebase] trigger skipped type="${type}" reason="no recipients"`);
            return;
        }

        const recipientIds = recipients.map(user => String(user._id)).join(',');
        console.log(`[Firebase] trigger type="${type}" title="${title}" recipients="${recipientIds}"`);

        /*
         * 1. Save notification in MongoDB
         */

        const recipientModel = recipients[0].constructor?.modelName || recipients[0].modelName || 'User';
        const senderModel = sender?.constructor?.modelName || null;
        const saved = await Notification.insertMany(recipients.map(user => ({
            recipient: user._id,
            recipientModel: user.constructor?.modelName || recipientModel,
            sender,
            senderModel,
            type,
            title,
            message,
            data,
        })));
        console.log(`[Firebase] notification persisted type="${type}" count=${saved.length}`);

        try {
            const io = getIO();
            const emittedRooms = new Set();
            recipients.forEach((user, index) => {
                const model = user.constructor?.modelName || recipientModel;
                const room = model === 'Admin' ? 'admin' : `technician:${user._id}`;
                if (emittedRooms.has(room)) return;
                emittedRooms.add(room);
                io.to(room).emit('notification:new', {
                    notification: saved[index],
                    type,
                    title,
                    message,
                    data,
                });
            });
            console.log(`[Firebase] socket delivered type="${type}" rooms=${emittedRooms.size}`);
        } catch (socketError) {
            console.warn('[Notification] Socket delivery failed:', socketError.message);
        }


        /*
         * 2. Get FCM tokens
         */

        const RecipientModel = recipientModel === 'Admin' ? Admin : User;
        const tokenRecords = await RecipientModel.find({
            _id: { $in: recipients.map(user => user._id) },
        }).select('_id fcmTokens').lean();
        tokens = [...new Set(tokenRecords
            .flatMap(user => Array.isArray(user.fcmTokens) ? user.fcmTokens : [])
            .filter(token => typeof token === 'string')
            .map(token => token.trim())
            .filter(Boolean))];
        console.log(`[Firebase] token lookup model="${recipientModel}" recipients=${recipients.length} records=${tokenRecords.length} tokens=${tokens.length}`);


        if (tokens.length === 0 || !admin.getApps().length) {
            if (tokens.length === 0) console.log(`[Firebase] FCM skipped type="${type}" reason="no device tokens"`);
            if (!admin.getApps().length) console.warn(`[Firebase] FCM skipped type="${type}" reason="SDK not configured"`);
            return;
        }


        /*
         * 3. Convert data to strings
         */

        const notificationData = {};

        Object.keys(data).forEach(key => {

            notificationData[key] =
                String(data[key]);

        });

        notificationData.target = recipientModel === 'Admin' ? 'admin' : 'technician';


        /*
         * 4. Send Firebase notification
         */

        const messaging = getMessaging();
        const invalidTokens = [];
        let successCount = 0;
        let failureCount = 0;

        for (let offset = 0; offset < tokens.length; offset += MAX_MULTICAST_TOKENS) {
            const batch = tokens.slice(offset, offset + MAX_MULTICAST_TOKENS);
            let response;
            try {
                response = await messaging.sendEachForMulticast({
                    tokens: batch,

                    notification: {
                        title,
                        body: message,
                    },

                    data: {
                        type,
                        ...notificationData,
                    },

                    android: {
                        priority: 'high',
                    },

                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                            },
                        },
                    },

                });
            } catch (error) {
                failureCount += batch.length;
                console.error(`[Firebase] FCM batch failed type="${type}" batch=${offset / MAX_MULTICAST_TOKENS + 1}`, firebaseErrorDetails(error, tokens));
                continue;
            }

            successCount += response.successCount;
            failureCount += response.failureCount;
            response.responses.forEach((result, index) => {
                if (result.success) return;
                console.warn(`[Firebase] FCM delivery failed type="${type}" deviceIndex=${offset + index}`, firebaseErrorDetails(result.error, tokens));
                // Payload/configuration/transient errors do not prove a token is invalid.
                if (INVALID_TOKEN_CODES.has(result.error?.code)) invalidTokens.push(batch[index]);
            });
        }

        if (invalidTokens.length > 0) {
            try {
                await RecipientModel.updateMany(
                    { _id: { $in: tokenRecords.map(user => user._id) } },
                    { $pull: { fcmTokens: { $in: invalidTokens } } },
                );
                console.log(`[Firebase] invalid tokens removed model="${recipientModel}" count=${invalidTokens.length}`);
            } catch (error) {
                console.warn('[Firebase] Invalid token cleanup failed:', firebaseErrorDetails(error, tokens));
            }
        }

        console.log(`[Firebase] FCM complete type="${type}" success=${successCount} failed=${failureCount}`);


    } catch (error) {

        console.error('Notification Service Error:', firebaseErrorDetails(error, tokens));

    }
};

module.exports = sendNotification;

module.exports.sendToAdmins = async (payload, sender) => {
    const admins = await Admin.find({ isActive: { $ne: false } }).select('_id fcmTokens');
    return sendNotification({ ...payload, recipients: admins, sender });
};

module.exports.sendToTechnician = async (technicianId, payload, sender) => {
    const technician = await User.findOne({ _id: technicianId, role: 'technician' }).select('_id fcmTokens');
    return technician ? sendNotification({ ...payload, recipients: [technician], sender }) : null;
};
