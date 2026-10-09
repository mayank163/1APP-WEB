const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const technicianId = '507f1f77bcf86cd799439011';
const reviewerId = '507f1f77bcf86cd799439012';
function setup({ reviewerFound = true, technicianFound = true } = {}) {
  const writes = [], events = [], lookups = [];
  const context = { module: { exports: {} }, require(name) {
    if (name === 'mongoose') return { isValidObjectId: value => typeof value === 'string' && /^[a-f\d]{24}$/.test(value) };
    if (name === '../models/Admin') return { findOne(filter) { lookups.push(filter); return { select: async () => reviewerFound ? { _id: reviewerId, name: 'Reviewer One' } : null }; } };
    if (name === '../models/User') return { async findOneAndUpdate(filter, update, options) { writes.push({ filter, update, options }); return technicianFound ? { technicianProfile: { verificationStatus: 'pending' } } : null; } };
    if (name === '../utils/socketEvents') return { emitVerificationUpdated: (...args) => events.push(args) };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/adminTechVerificationController'), 'utf8'), context);
  let status, body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
  return { writes, events, lookups, result: () => ({ status, body }), async assign(id) { await context.module.exports.assignReviewer({ params: { technicianId }, body: { reviewerId: id } }, res, error => { throw error; }); } };
}
test('assigns active sub-admin and clears reviewer without changing verification status', async () => {
  const app = setup(); await app.assign(reviewerId);
  assert.equal(app.result().status, 200);
  assert.equal(app.lookups[0].isActive, true);
  assert.equal(app.lookups[0].isSuperAdmin.$ne, true);
  assert.equal(app.writes[0].filter.role, 'technician');
  assert.equal(app.writes[0].update.$set['technicianProfile.reviewer'], reviewerId);
  assert.equal(app.result().body.data.reviewer, 'Reviewer One');
  assert.equal(app.events.length, 1);
  await app.assign(null);
  assert.equal(app.writes[1].update.$set['technicianProfile.reviewer'], null);
});
test('rejects invalid or unavailable reviewers without writing', async () => {
  for (const id of ['bad', undefined, {}]) {
    const app = setup(); await app.assign(id);
    assert.equal(app.result().status, 400); assert.equal(app.writes.length, 0);
  }
  const app = setup({ reviewerFound: false }); await app.assign(reviewerId);
  assert.equal(app.result().status, 400); assert.equal(app.writes.length, 0);
});
test('returns 404 for unknown technician', async () => {
  const app = setup({ technicianFound: false }); await app.assign(reviewerId);
  assert.equal(app.result().status, 404); assert.equal(app.events.length, 0);
});
