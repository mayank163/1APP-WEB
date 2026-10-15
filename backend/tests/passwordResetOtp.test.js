const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let delivered = 0;
const otpService = {
    sendOTP: async () => { delivered++; },
    getLastOTP: () => '123456',
    simulationEnabled: () => false,
};
const user = { phone: '+919876543210' };
let foundUser = user;
Module._load = function (name, parent, ...rest) {
    if (parent?.filename.endsWith('/controllers/authController.js')) {
        if (name === '../models/User') return { findOne: async () => foundUser };
        if (name === '../utils/otpService') return otpService;
        if (name === '../utils/s3Upload' || name === '../utils/emailService') return {};
    }
    return originalLoad.call(this, name, parent, ...rest);
};
const controller = require('../src/controllers/authController');
Module._load = originalLoad;
const invoke = async (body) => {
    const result = {};
    const res = {
        status(code) { result.status = code; return this; },
        json(data) { result.data = data; return this; },
    };
    await controller.resendOTP({ body }, res, error => { result.error = error; });
    return result;
};

test('password-reset resend validates input, delivers, and propagates failures', async () => {
    for (const identifier of [undefined, {}, '   ']) {
        assert.equal((await invoke({ identifier })).status, 400);
    }
    assert.equal(delivered, 0);
    const success = await invoke({ identifier: ' +919876543210 ' });
    assert.equal(success.status, 200);
    assert.equal(success.data.phone, user.phone);
    assert.equal(success.data.resendAfter, 60);
    assert.equal(success.data.expiresIn, 300);
    assert.equal(success.data.devOtp, undefined);
    foundUser = null;
    assert.equal((await invoke({ identifier: 'missing@example.com' })).status, 404);
    foundUser = user;
    const cooldown = Object.assign(new Error('Wait'), { statusCode: 429 });
    otpService.sendOTP = async () => { throw cooldown; };
    assert.equal((await invoke({ identifier: user.phone })).error, cooldown);
    const providerError = Object.assign(new Error('SMS unavailable'), { statusCode: 502 });
    otpService.sendOTP = async () => { throw providerError; };
    assert.equal((await invoke({ identifier: user.phone })).error, providerError);
});
