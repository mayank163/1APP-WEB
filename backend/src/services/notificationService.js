// const admin = require('../config/firebase');

const Notification = require('../models/Notification');

const sendNotification = async ({
    recipients,
    sender = null,
    type,
    title,
    message,
    data = {},
}) => {

    try {

        if (!recipients || recipients.length === 0) {
            return;
        }

        /*
         * 1. Save notification in MongoDB
         */

        await Notification.insertMany(
            recipients.map(user => ({
                recipient: user._id,
                sender,
                type,
                title,
                message,
                data,
            }))
        );


        /*
         * 2. Get FCM tokens
         */

        const tokens = recipients
            .flatMap(user => user.fcmTokens || [])
            .filter(Boolean);


        if (tokens.length === 0) {
            console.log(
                'No FCM tokens found'
            );

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


        /*
         * 4. Send Firebase notification
         */

        const response =
            await admin.messaging()
                .sendEachForMulticast({

                    tokens,

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


        console.log(
            'Notification success:',
            response.successCount
        );

        console.log(
            'Notification failed:',
            response.failureCount
        );


    } catch (error) {

        console.error(
            'Notification Service Error:',
            error
        );

    }
};

module.exports = sendNotification;