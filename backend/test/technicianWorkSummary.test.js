const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWorkSummary } = require('../src/services/technicianWorkSummary');

test('counts completed jobs once per work type and service, while retaining distinct subtypes', () => {
  const workType = { _id: 'fiber', name: 'Fiber', subType: { _id: 'runs', name: 'Runs' } };
  const job = { status: 'checkout', workType, additionalWorkType: { ...workType, subType: { _id: 'test', name: 'Testing' } }, serviceType: { _id: 'install', name: 'Installation' }, jobCompletedAt: '2026-01-02', technicianRating: { score: 4 }, pay: { type: 'hourly', hourlyRate: 90 } };
  const data = buildWorkSummary([job, { ...job, status: 'assigned' }, { ...job, status: 'cancelled' }]);
  assert.equal(data.totalJobs, 1);
  assert.equal(data.workTypes[0].jobCount, 1);
  assert.equal(data.workTypes[0].serviceTypes[0].jobCount, 1);
  assert.equal(data.workTypes[0].subTypes.length, 2);
  assert.equal(data.workTypes[0].averageRating, 4);
  assert.equal(data.workTypes[0].averageHourlyRate, 90);
});
test('handles empty history, legacy categories and missing dates/rates/ratings', () => {
  assert.deepEqual(buildWorkSummary([]), { totalJobs: 0, workTypes: [] });
  const data = buildWorkSummary([{ status: 'closed', category: 'Repair' }, { status: 'completed', category: 'Repair', completedAt: '2026-02-01' }]);
  assert.equal(data.workTypes[0].name, 'Repair');
  assert.equal(data.workTypes[0].jobCount, 2);
  assert.equal(data.workTypes[0].averageHourlyRate, null);
  assert.equal(data.workTypes[0].averageRating, null);
  assert.equal(data.workTypes[0].lastCompletedAt, '2026-02-01T00:00:00.000Z');
});
