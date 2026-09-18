const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPaths = [
    path.join(__dirname, '..', 'firebase-service-account.json'),
    path.join(__dirname, '..', '..', 'firebase-service-account.json'),
];
let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
        console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
} else {
    const serviceAccountPath = serviceAccountPaths.find(candidate => fs.existsSync(candidate));
    if (serviceAccountPath) serviceAccount = require(serviceAccountPath);
}

if (serviceAccount && !admin.getApps().length) {
    admin.initializeApp({ credential: admin.cert(serviceAccount) });
    console.log('[Firebase] Admin SDK initialised');
} else if (!serviceAccount) {
    console.warn('[Firebase] No service account configured; FCM delivery is disabled.');
}

module.exports = admin;