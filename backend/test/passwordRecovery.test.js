const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
let calls, saved, query;
const user = { email: 'user@example.com', phone: '+1123456XXXX', save: async () => { saved = true; } };
const otp = {
  sendEmailOTP: async (...args) => calls.push(['email', ...args]),
  sendOTP: async (...args) => calls.push(['phone', ...args]),
  getLastEmailOTP: () => '123456', getLastOTP: () => '123456', simulationEnabled: () => false,
  verifyEmailOTP: (value, code, purpose) => { calls.push(['verifyEmail', value, purpose]); return code === '123456'; },
  verifyOTP: () => false,
};
const mocks = {
  '../models/User': { findOne: async value => { query = value; return user; } },
  '../utils/otpService': otp,
  '../utils/phone': { normalizePhone: value => value, phoneQuery: phone => ({ phone }) },
  '../utils/emailService': { sendPasswordResetSuccess: async () => {} },
};
const context = { exports: {}, require: name => mocks[name] || {}, Map, console, process };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/authController.js'), 'utf8'), context);
const invoke = async (handler, body) => {
  calls = []; saved = false;
  let result, status, failure;
  await handler({ body }, { status(value) { status = value; return this; }, json(value) { result = value; } }, err => { failure = err; });
  return { result, status, failure };
};
test('email recovery sends email only even with a placeholder phone', async () => {
  const response = await invoke(context.exports.forgotPassword, { identifier: 'USER@example.com' });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['email', user.email, 'password-reset']]);
  assert.equal(response.result.identifier, user.email);
  assert.equal(response.result.channel, 'email');
  assert.equal(response.result.devOtp, undefined);
});
test('email reset verifies reset-purpose OTP and saves the account password', async () => {
  const response = await invoke(context.exports.resetPassword, { identifier: user.email, otp: '123456', newPassword: 'newpassword' });
  assert.equal(response.status, 200);
  assert.equal(saved, true);
  assert.deepEqual(calls, [['verifyEmail', user.email, 'password-reset']]);
  assert.equal(query.email, user.email);
});
test('invalid email OTP cannot change the password', async () => {
  const response = await invoke(context.exports.resetPassword, { identifier: user.email, otp: '000000', newPassword: 'newpassword' });
  assert.equal(response.status, 400);
  assert.equal(saved, false);
});
test('phone recovery still sends SMS', async () => {
  const response = await invoke(context.exports.forgotPassword, { identifier: '+15551234567' });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['phone', user.phone]]);
});
