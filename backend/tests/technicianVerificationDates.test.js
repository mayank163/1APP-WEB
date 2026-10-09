const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('admin verification API includes licence dates and handles older uploads', async () => {
  const issuedDate = new Date('2020-01-01');
  const expiryDate = new Date('2030-01-01');
  const users = [{ _id: 'new', technicianProfile: { verificationStatus: 'pending', drivingLicense: { front: 'front.jpg', issuedDate, expiryDate } } }, { _id: 'old', technicianProfile: { verificationStatus: 'pending' } }];
  const context = { module: { exports: {} }, require(name) {
    if (name === '../models/User') return { find: () => ({ sort: async () => users }) };
    if (name === '../models/Admin') return { find: () => ({ select: () => ({ sort: async () => [] }) }) };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/adminTechVerificationController'), 'utf8'), context);
  let body;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(value) { body = value; } };
  await context.module.exports.getTechnicianVerificationRequests({}, res, error => { throw error; });
  assert.equal(body.data.requests[0].drivingLicense.issuedDate, issuedDate);
  assert.equal(body.data.requests[0].drivingLicense.expiryDate, expiryDate);
  assert.equal(body.data.requests[0].documents.drivingLicenseFront, 'front.jpg');
  assert.equal(body.data.requests[1].drivingLicense.issuedDate, null);
  assert.equal(body.data.requests[1].drivingLicense.expiryDate, null);
});
