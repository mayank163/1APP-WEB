const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(found = true) {
  const queries = [];
  const chain = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value });
  const context = { exports: {}, require(name) {
    if (name === 'mongoose') return { isValidObjectId: id => /^[a-f\d]{24}$/.test(String(id)) };
    if (name === '../models/User') return { findOne: filter => { queries.push(filter); return chain(found ? { _id: filter._id } : null); } };
    if (name === '../models/TechnicianJob') return { find: filter => { queries.push(filter); return chain([]); } };
    if (name === '../models/TechnicianWithdrawal') return { find: filter => { queries.push(filter); return chain([]); } };
    return require('../src/services/technicianFinancials');
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/technicianFinancialController'), 'utf8'), context);
  return { queries, handler: context.exports.getFinancials };
}
const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
test('technician query IDs cannot override authenticated identity', async () => {
  const app = setup(), res = response();
  await app.handler({ params: {}, query: { technicianId: 'other' }, user: { _id: id } }, res, error => { throw error; });
  assert.equal(app.queries[0]._id, id);
  assert.equal(app.queries[0].role, 'technician');
  assert.equal(app.queries[1]['assignedTechnician._id'], id);
  assert.equal(app.queries[2].technician, id);
  assert.equal(res.body.data.technicianId, id);
});
test('invalid ID and missing technician have explicit errors', async () => {
  const invalid = response();
  await setup().handler({ params: { technicianId: 'bad' }, query: {}, user: {} }, invalid, error => { throw error; });
  assert.equal(invalid.code, 400);
  const missing = response();
  await setup(false).handler({ params: { technicianId: id }, query: {}, user: {} }, missing, error => { throw error; });
  assert.equal(missing.code, 404);
});
test('filter validation happens before database queries', async () => {
  const app = setup(); let failure;
  await app.handler({ params: {}, query: { limit: 200 }, user: { _id: id } }, response(), error => { failure = error; });
  assert.equal(failure.statusCode, 400);
  assert.equal(app.queries.length, 0);
});
