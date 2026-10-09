const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOptions, buildFinancials } = require('../src/services/technicianFinancials');
const now = new Date('2026-10-08T12:00:00Z');
const job = (id, amount, date, status = 'paid') => ({ _id: id, title: id, finalPrice: amount, status: 'checkout', payment: { status, paidAt: date }, jobCompletedAt: date, updatedAt: date });
const build = (jobs = [], query = {}) => buildFinancials({ _id: 'tech', totalEarnings: 400, totalWithdrawn: 100 }, jobs, [{ _id: 'withdraw', amount: 20, status: 'pending', method: 'bank-transfer', createdAt: now }], parseOptions(query), now);
test('earnings use net paid amount and exclude refunds and unfinished jobs', () => {
  const result = build([job('paid', 120.25, now), job('pending', 50, now, 'pending'), job('refund', 200, now, 'refunded'), { ...job('unfinished', 999, now, 'unpaid'), status: 'assigned' }]);
  assert.equal(result.summary.totalEarned, 120.25);
  assert.equal(result.summary.todayEarnings, 120.25);
  assert.equal(result.summary.pendingEarnings, 50);
  assert.equal(result.summary.pendingJobs, 1);
  assert.equal(result.summary.availableBalance, 300);
  assert.equal(result.summary.pendingWithdrawals, 20);
  assert.equal(result.transactions.pagination.total, 2);
});
test('weekly buckets include Sunday through Saturday and previous week growth', () => {
  const result = build([job('current', 100, '2026-10-08'), job('previous', 50, '2026-10-01')]);
  assert.equal(result.activity.from, '2026-10-04');
  assert.equal(result.activity.to, '2026-10-10');
  assert.equal(result.activity.points.length, 7);
  assert.equal(result.activity.changePercent, 100);
  assert.equal(result.activity.points[4].amount, 100);
});
test('monthly and year boundaries, zero baseline, empty response', () => {
  const result = buildFinancials({ _id: 'tech' }, [job('last', 40, '2025-12-31'), job('new', 60, '2026-01-01')], [], parseOptions({ period: 'monthly' }), new Date('2026-01-02'));
  assert.equal(result.summary.monthChangePercent, 50);
  assert.equal(result.activity.points.length, 31);
  assert.equal(build().summary.totalEarned, 0);
  assert.equal(build().summary.monthChangePercent, 0);
  assert.equal(build([job('new', 10, now)]).summary.monthChangePercent, null);
});
test('inclusive date and status filters paginate history without changing overview', () => {
  const result = build([job('a', 10, now), job('b', 30, '2026-10-07'), job('c', 20, now, 'pending')], { from: '2026-10-08', to: '2026-10-08', status: 'pending', limit: 1 });
  assert.equal(result.summary.totalEarned, 40);
  assert.equal(result.transactions.items[0].id, 'c');
  assert.equal(result.transactions.groups[0].date, '2026-10-08');
  assert.equal(result.transactions.pagination.total, 1);
  assert.deepEqual(build([], { page: 2 }).transactions.items, []);
});
test('pending amounts use negotiated final amount, not an advertised estimate', () => {
  const result = build([{ ...job('negotiated', 0, now, 'unpaid'), assignedRequest: { finalJobAmount: 75 }, pay: { fixedAmount: 100 } }]);
  assert.equal(result.summary.pendingEarnings, 75);
});
test('rejects malformed filters before querying data', () => {
  for (const query of [{ from: '2026-02-30' }, { from: '2026-10-09', to: '2026-10-01' }, { page: 0 }, { limit: 101 }, { page: 1.5 }, { period: 'yearly' }, { status: 'paid' }, { from: ['2026-10-01'] }]) assert.throws(() => parseOptions(query), { statusCode: 400 });
});
