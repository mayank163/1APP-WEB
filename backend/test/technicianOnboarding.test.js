const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let found, created, tokenUser, validOTP;
const User = { findOne: async () => found, create: async data => { created = data; } };
Module._load = function (name, parent, ...rest) {
  if (parent?.filename.endsWith('/technicianOnboardingController.js')) {
    if (name === '../utils/s3Upload') return { uploadFile: async file => ({ key: `test/${file.originalname}` }), deleteFile: async () => {} };
    if (name === '../models/User') return User;
    if (name === './technicianAuthController') return { sendTechnicianTokenResponse: async user => { tokenUser = user; } };
    if (name === '../utils/otpService') return { sendOTP: async () => {}, sendEmailOTP: async () => {}, verifyOTP: () => validOTP, verifyEmailOTP: () => validOTP };
  }
  return originalLoad.call(this, name, parent, ...rest);
};
const controller = require('../src/controllers/technicianOnboardingController');
Module._load = originalLoad;
const body = { name: 'Test Technician', phone: '9876543210', email: 'Tech@Example.com', address: 'Delhi', serviceRadius: 15, yearsOfExperience: 3, drivingLicenseIssuedDate: '2020-01-01', drivingLicenseExpiryDate: '2030-01-01', consent: true };
const invoke = async (handler, data) => {
  let error, payload, status;
  await handler({ body: data, files: { drivingLicenseFront: [{ originalname: 'licence.jpg' }], drivingLicenseBack: [{ originalname: 'back.jpg' }] } }, { status(code) { status = code; return this; }, json(value) { payload = value; } }, err => { error = err; });
  return { error, payload, status };
};
test('preregistration saves an invited unapproved account without exposing credentials', async () => {
  found = undefined;
  const result = await invoke(controller.preregister, body);
  assert.equal(result.status, 201);
  assert.equal(created.phone, '+919876543210');
  assert.equal(created.email, 'tech@example.com');
  assert.equal(created.accountStatus, 'invited');
  assert.equal(created.technicianProfile.verificationStatus, 'pending');
  assert.equal(created.address, 'Delhi');
  assert.equal(created.serviceRadius, 15);
  assert.equal(created.technicianProfile.drivingLicense.front, 'test/licence.jpg');
  assert.equal(created.profileImage, undefined);
  assert.equal(created.technicianProfile.drivingLicense.back, 'test/back.jpg');
  assert.equal(created.technicianProfile.drivingLicense.issuedDate.toISOString().slice(0, 10), '2020-01-01');
  assert.equal(created.technicianProfile.documents.length, 2);
  assert.equal(created.password.length, 64);
  assert.equal(result.payload.password, undefined);
});
test('duplicates and missing consent cannot create accounts', async () => {
  found = { role: 'technician' };
  assert.equal((await invoke(controller.preregister, body)).error.statusCode, 409);
  found = undefined;
  assert.equal((await invoke(controller.preregister, { ...body, consent: false })).error.statusCode, 400);
});
test('malformed inputs are rejected', async () => {
  for (const changes of [{ phone: 'bad' }, { email: 'invalid' }, { yearsOfExperience: -1 }, { yearsOfExperience: '' }, { address: '' }, { serviceRadius: 0 }, { serviceRadius: 501 }, { email: '' }, { drivingLicenseIssuedDate: '' }, { drivingLicenseIssuedDate: '2020-02-30' }, { drivingLicenseExpiryDate: '2019-01-01' }, { drivingLicenseIssuedDate: '2099-01-01' }]) {
    assert.equal((await invoke(controller.preregister, { ...body, ...changes })).error.statusCode, 400);
  }
});
test('phone or email OTP activates the existing account without approving documents', async () => {
  for (const type of ['phone', 'email']) {
    tokenUser = undefined;
    validOTP = true;
    found = { role: 'technician', accountStatus: 'invited', technicianProfile: { verificationStatus: 'not-started' }, save: async () => {} };
    const result = await invoke(controller.verifyLoginOTP, { ...body, type, otp: '123456' });
    assert.equal(result.error, undefined);
    assert.equal(tokenUser, found);
    assert.equal(found.accountStatus, 'active');
    assert.equal(found[type === 'phone' ? 'isPhoneVerified' : 'isEmailVerified'], true);
    assert.equal(found.technicianProfile.verificationStatus, 'not-started');
  }
});
test('invalid codes and unavailable accounts never receive tokens', async () => {
  for (const status of ['suspended', 'blocked', 'inactive', 'active']) {
    tokenUser = undefined;
    validOTP = status !== 'active';
    found = { role: 'technician', accountStatus: status };
    assert.equal((await invoke(controller.verifyLoginOTP, { ...body, otp: 'bad' })).error.statusCode, 401);
    assert.equal(tokenUser, undefined);
  }
});
