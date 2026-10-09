const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(found = true) {
  const writes = [];
  const context = { exports: {}, require(name) {
    if (name === 'mongoose') return { isValidObjectId: value => /^[a-f\d]{24}$/.test(String(value)) };
    if (name === '../models/User') return { findOneAndUpdate(filter, update, options) { writes.push({ filter, update, options }); return { select: async () => found ? { technicianAdminNote: update.$set.technicianAdminNote } : null }; } };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/adminTechnicians'), 'utf8'), context);
  return { writes, save: context.exports.saveTechnicianNote };
}
const id = '507f1f77bcf86cd799439011';
test('saves and clears bounded private notes only on technician accounts', async () => {
  const app = setup(); let body;
  const res = { json(value) { body = value; } };
  await app.save({ params: { technicianId: id }, body: { note: '  Bring a ladder  ' } }, res, error => { throw error; });
  assert.equal(app.writes[0].filter.role, 'technician');
  assert.equal(app.writes[0].filter._id, id);
  assert.equal(body.data.note, 'Bring a ladder');
  await app.save({ params: { technicianId: id }, body: { note: '' } }, res, error => { throw error; });
  assert.equal(body.data.note, '');
});
test('rejects malformed note, excessive size, invalid ID, and unknown technician', async () => {
  for (const req of [{ params: { technicianId: id }, body: { note: {} } }, { params: { technicianId: id }, body: { note: 'x'.repeat(1001) } }, { params: { technicianId: 'bad' }, body: { note: 'note' } }]) {
    const app = setup(); let failure;
    await app.save(req, {}, error => { failure = error; });
    assert.equal(failure.statusCode, 400);
    assert.equal(app.writes.length, 0);
  }
  let failure;
  await setup(false).save({ params: { technicianId: id }, body: { note: 'note' } }, {}, error => { failure = error; });
  assert.equal(failure.statusCode, 404);
});
