const crypto = require('crypto');
const twilio = require('twilio');
const { normalizePhone } = require('./phone');

const otpStore = new Map();
const simulationEnabled = () => process.env.NODE_ENV !== 'production' && process.env.OTP_SIMULATION_ENABLED === 'true';

const sendSMS = async (phone, body) => {
    const to = normalizePhone(phone);
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_PHONE_NUMBER: from, TWILIO_MESSAGING_SERVICE_SID: messagingServiceSid } = process.env;
    if (process.env.TWILIO_SMS_ENABLED !== 'true' || !sid || !token || (!from && !messagingServiceSid)) {
        const error = new Error('SMS delivery is not configured. Please contact the administrator.');
        error.statusCode = 503;
        throw error;
    }
    await twilio(sid, token).messages.create({ to, body, ...(messagingServiceSid ? { messagingServiceSid } : { from }) });
};

const sendOTP = async (value, purpose = 'phone') => {
    const phone = normalizePhone(value);
    const key = `${purpose}:${phone}`;
    const previous = otpStore.get(key);
    if (previous && Date.now() - previous.sentAt < 60000) {
        const error = new Error('Please wait 60 seconds before requesting another OTP.');
        error.statusCode = 429;
        throw error;
    }
    for (const [entryKey, entry] of otpStore) if (entry.expires < Date.now()) otpStore.delete(entryKey);
    const otp = crypto.randomInt(100000, 1000000).toString();
    otpStore.set(key, { otp, expires: Date.now() + 5 * 60000, sentAt: Date.now(), attempts: 0 });
    try {
        if (simulationEnabled()) console.log(`[Development OTP] ${phone}: ${otp}`);
        else await sendSMS(phone, `Your 1APP verification OTP is: ${otp}. Valid for 5 minutes.`);
    } catch (error) {
        otpStore.delete(key);
        error.statusCode = error.statusCode || 502;
        throw error;
    }
    return otp;
};

const verifyOTP = (value, code, purpose = 'phone') => {
    const key = `${purpose}:${normalizePhone(value)}`;
    const data = otpStore.get(key);
    if (!data) return false;
    if (Date.now() > data.expires || ++data.attempts > 5) {
        otpStore.delete(key);
        return false;
    }
    if (data.otp !== String(code)) return false;
    otpStore.delete(key);
    return true;
};

const getLastOTP = (value, purpose = 'phone') => otpStore.get(`${purpose}:${normalizePhone(value)}`)?.otp || null;
module.exports = { sendSMS, sendOTP, verifyOTP, getLastOTP, simulationEnabled };
