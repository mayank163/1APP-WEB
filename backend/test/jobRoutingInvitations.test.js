const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ids = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];
const jobId = 'cccccccccccccccccccccccc';
let created, existing, transactions, lockCount;
const chain = value => ({ select() { return this; }, session() { return this; }, lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const job = { _id: jobId, status: 'open', workType: { _id: 'fiber', name: 'Fiber' }, pay: { type: 'fixed', fixedAmount: 100 } };
const history = ids.map(_id => ({ ...job, status: 'completed', assignedTechnician: { _id } }));
const mocks = {
  mongoose: { isValidObjectId: id => /^[a-f0-9]{24}$/.test(String(id)), connection: { transaction: async fn => { transactions++; await fn({}); } } },
  '../models/TechnicianJob': { findById: () => chain(job), find: () => chain(history), updateOne: async () => { lockCount++; return { matchedCount: 1 }; } },
  '../models/TechnicianJobRequest': { find: () => chain(existing), create: async rows => { created = rows; return rows.map((r, i) => ({ ...r, _id: String(i) })); }, findById: () => ({ populate: async () => ({}) }) },
  '../models/User': { find: () => chain(ids.map(_id => ({ _id, name: _id, accountStatus: 'active' }))) },
  '../utils/socketInstance': { getIO: () => ({ to: () => ({ emit() {} }) }) },
  '../services/notificationService': { sendToTechnician: async () => {} },
  '../services/bookingTechnicianJobSync': { syncBookingFromTechnicianJob: async () => {} },
};
const originalLoad = Module._load;
Module._load = function(name, ...args) { return mocks[name] || originalLoad.call(this, name, ...args); };
const { sendInvitation } = require('../src/controllers/jobInvitationController');
Module._load = originalLoad;
const invoke = async body => {
  created = null; transactions = 0; lockCount = 0;
  let result, failure, status;
  await sendInvitation({ params: { jobId }, body, user: { _id: ids[0] } }, { status(n) { status = n; return this; }, json(value) { result = value; } }, err => { failure = err; });
  return { result, failure, status };
};
test('bulk invitations deduplicate recipients and create the full batch in one transaction', async () => {
  existing = [];
  const response = await invoke({ technicianIds: [...ids, ids[0]], message: 'Please help' });
  assert.equal(response.failure, undefined);
  assert.equal(response.status, 201);
  assert.equal(transactions, 1);
  assert.equal(lockCount, 1);
  assert.deepEqual(created.map(r => r.technician), ids);
  assert.equal(response.result.data.requests.length, 2);
});
test('stale or ineligible selection rejects the batch before creating requests', async () => {
  existing = [{ technician: ids[1] }];
  const response = await invoke({ technicianIds: ids });
  assert.equal(response.failure.statusCode, 409);
  assert.equal(created, null);
  assert.equal(lockCount, 0);
});
test('empty selection is rejected and single-recipient requests remain supported', async () => {
  existing = [];
  const empty = await invoke({ technicianIds: [] });
  assert.equal(empty.failure.statusCode, 400);
  assert.equal(transactions, 0);
  const single = await invoke({ technicianId: ids[0] });
  assert.equal(single.status, 201);
  assert.equal(created.length, 1);
});
