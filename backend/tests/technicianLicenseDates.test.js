const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(previous = {}) {
  const user = { role: 'technician', technicianProfile: { drivingLicense: previous }, async save() { this.saved = true; } };
  const uploads = [];
  const context = { exports: {}, require(name) {
    if (name === '../models/User') return { findById: async () => user };
    if (name === '../utils/s3Upload') return {
      uploadFile: async () => { uploads.push(true); return { key: 'license-key' }; },
      deleteFile: async () => {},
    };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/technicianAuthController'), 'utf8'), context);
  let status, body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; } };
  return { user, uploads, controller: context.exports, res, result: () => ({ status, body }) };
}
const dates = { drivingLicenseIssuedDate: '2020-01-01', drivingLicenseExpiryDate: '2030-01-01' };
const request = body => ({ user: { _id: 'tech' }, body, files: { drivingLicenseFront: [{}] } });
const next = error => { throw error; };

test('uploads license with dates and retains dates when completing profile', async () => {
  const app = setup();
  await app.controller.uploadTechnicianDocuments(request(dates), app.res, next);
  assert.equal(app.result().status, 200);
  assert.equal(app.user.technicianProfile.drivingLicense.issuedDate.toISOString(), '2020-01-01T00:00:00.000Z');
  assert.equal(app.user.technicianProfile.drivingLicense.expiryDate.toISOString(), '2030-01-01T00:00:00.000Z');
  await app.controller.completeTechnicianProfile({ user: { _id: 'tech' }, body: {} }, app.res, next);
  assert.equal(app.user.technicianProfile.drivingLicense.expiryDate.toISOString(), '2030-01-01T00:00:00.000Z');
});

test('rejects missing, impossible, malformed, and unordered dates before upload', async () => {
  for (const body of [{}, { ...dates, drivingLicenseIssuedDate: '2020-02-30' }, { ...dates, drivingLicenseExpiryDate: 'bad' }, { ...dates, drivingLicenseExpiryDate: '2019-01-01' }, { ...dates, drivingLicenseExpiryDate: '2020-01-01' }]) {
    const app = setup();
    await app.controller.uploadTechnicianDocuments(request(body), app.res, next);
    assert.equal(app.result().status, 400);
    assert.equal(app.uploads.length, 0);
    assert.equal(app.user.saved, undefined);
  }
});

test('other document uploads do not require license dates', async () => {
  const app = setup();
  await app.controller.uploadTechnicianDocuments({ user: { _id: 'tech' }, body: {}, files: { residentialProof: [{}] } }, app.res, next);
  assert.equal(app.result().status, 200);
});

test('license reupload preserves dates or accepts replacement dates', async () => {
  const app = setup({ issuedDate: new Date('2020-01-01'), expiryDate: new Date('2030-01-01') });
  const req = { user: { _id: 'tech' }, params: { documentId: 'drivingLicenseFront' }, body: {}, file: {} };
  await app.controller.reuploadDocument(req, app.res, next);
  assert.equal(app.result().status, 200);
  assert.equal(app.user.technicianProfile.drivingLicense.expiryDate.toISOString(), '2030-01-01T00:00:00.000Z');
  req.body = { drivingLicenseExpiryDate: '2035-01-01' };
  await app.controller.reuploadDocument(req, app.res, next);
  assert.equal(app.user.technicianProfile.drivingLicense.expiryDate.toISOString(), '2035-01-01T00:00:00.000Z');
});
