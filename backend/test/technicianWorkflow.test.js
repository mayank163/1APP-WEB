const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateTechnicianSummary, getRequestStatusTone } = require('../src/services/technicianFlow');

test('calculateTechnicianSummary totals jobs, earnings, and withdrawals correctly', () => {
  const summary = calculateTechnicianSummary({
    totalJobsDone: 7,
    totalEarnings: 12000,
    totalWithdrawn: 6500,
    pendingBalance: 5500,
  });

  assert.deepEqual(summary, {
    totalJobsDone: 7,
    totalEarnings: 12000,
    totalWithdrawn: 6500,
    availableBalance: 5500,
  });
});

test('request status tone matches admin decision states', () => {
  assert.equal(getRequestStatusTone('accepted'), 'success');
  assert.equal(getRequestStatusTone('rejected'), 'danger');
  assert.equal(getRequestStatusTone('counter-offer'), 'warning');
  assert.equal(getRequestStatusTone('pending'), 'info');
});
