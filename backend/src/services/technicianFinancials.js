const fail = message => Object.assign(new Error(message), { statusCode: 400 });
const money = value => Math.round(Number(value || 0) * 100) / 100;
const day = date => new Date(date).toISOString().slice(0, 10);
const dateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || day(value) !== value) throw fail('Dates must be valid YYYY-MM-DD values.');
  return value;
};
function parseOptions(query = {}) {
  const period = query.period || 'weekly';
  const status = query.status || 'all';
  if (!['weekly', 'monthly'].includes(period)) throw fail('period must be weekly or monthly.');
  if (!['all', 'pending', 'completed'].includes(status)) throw fail('status must be all, pending or completed.');
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw fail('page must be positive and limit must be between 1 and 100.');
  const from = query.from === undefined ? null : dateOnly(query.from);
  const to = query.to === undefined ? null : dateOnly(query.to);
  if (from && to && from > to) throw fail('from must be before or equal to to.');
  return { period, status, page, limit, from, to };
}
function buildFinancials(technician, jobs, withdrawals, options, now = new Date()) {
  const today = day(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const transactions = jobs.filter(job => job.payment?.status === 'paid' || (['checkout', 'completed', 'closed'].includes(job.status) && job.payment?.status !== 'refunded')).map(job => {
    const paid = job.payment?.status === 'paid';
    const date = paid ? job.payment.paidAt || job.completedAt || job.updatedAt : job.jobCompletedAt || job.completedAt || job.updatedAt;
    const amount = paid ? job.finalPrice : job.finalPrice || job.assignedRequest?.finalJobAmount || job.pay?.fixedAmount || job.pay?.blendedFixedAmount || 0;
    return { id: String(job._id), jobId: String(job._id), title: job.title, category: job.category, amount: money(amount), status: paid ? 'completed' : 'pending', date: new Date(date).toISOString(), dateKey: day(date), paymentStatus: job.payment?.status || 'unpaid' };
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const paid = transactions.filter(t => t.status === 'completed');
  const sum = items => money(items.reduce((total, t) => total + t.amount, 0));
  const between = (start, end) => paid.filter(t => t.dateKey >= day(start) && t.dateKey < day(end));
  const thisMonth = sum(paid.filter(t => t.dateKey >= day(monthStart) && t.dateKey <= today));
  const lastMonth = sum(between(previousMonth, monthStart));
  const change = (current, previous) => previous === 0 ? (current === 0 ? 0 : null) : money((current - previous) / previous * 100);
  let start, end, previousStart;
  if (options.period === 'weekly') {
    start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    previousStart = new Date(start); previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  } else {
    start = monthStart;
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    previousStart = previousMonth;
  }
  const currentTotal = sum(between(start, end)), previousTotal = sum(between(previousStart, start));
  const points = [];
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = day(cursor);
    points.push({ date, label: options.period === 'weekly' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][cursor.getUTCDay()] : String(cursor.getUTCDate()), amount: sum(paid.filter(t => t.dateKey === date)) });
  }
  const pending = transactions.filter(t => t.status === 'pending');
  const filtered = transactions.filter(t => (options.status === 'all' || t.status === options.status) && (!options.from || t.dateKey >= options.from) && (!options.to || t.dateKey <= options.to));
  const items = filtered.slice((options.page - 1) * options.limit, options.page * options.limit);
  const totalEarned = sum(paid), totalWithdrawn = money(technician.totalWithdrawn);
  const pendingWithdrawals = sum(withdrawals.filter(w => w.status === 'pending'));
  return {
    technicianId: String(technician._id), currency: 'USD', timezone: 'UTC', generatedAt: now.toISOString(),
    summary: { todayEarnings: sum(paid.filter(t => t.dateKey === today)), thisMonth, previousMonth: lastMonth, monthChangePercent: change(thisMonth, lastMonth), totalEarned, pendingEarnings: sum(pending), pendingJobs: pending.length, totalWithdrawn, walletEarnings: money(technician.totalEarnings), availableBalance: money(Math.max(Number(technician.totalEarnings || 0) - totalWithdrawn, 0)), pendingWithdrawals },
    activity: { period: options.period, from: day(start), to: day(new Date(end.getTime() - 86400000)), total: currentTotal, previousTotal, changePercent: change(currentTotal, previousTotal), points },
    recentTransactions: transactions.slice(0, 5),
    transactions: { items, groups: [...new Set(items.map(t => t.dateKey))].map(date => ({ date, items: items.filter(t => t.dateKey === date) })), pagination: { page: options.page, limit: options.limit, total: filtered.length, totalPages: Math.ceil(filtered.length / options.limit), hasNextPage: options.page * options.limit < filtered.length } },
    withdrawals: withdrawals.map(w => ({ id: String(w._id), amount: money(w.amount), status: w.status, method: w.method, createdAt: w.createdAt }))
  };
}
module.exports = { parseOptions, buildFinancials };
