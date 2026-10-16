// Only completed work contributes experience, including jobs awaiting checkout approval.
const COMPLETED_STATUSES = ['checkout', 'completed', 'closed'];

function buildWorkSummary(jobs) {
  const groups = new Map();
  let totalJobs = 0;
  const key = (type) => String(type?._id || type?.name || 'Unspecified');
  const entry = (type) => ({ id: key(type), name: type?.name || 'Unspecified', jobCount: 0, lastCompletedAt: null, ratingTotal: 0, ratingCount: 0, hourlyTotal: 0, hourlyCount: 0 });
  const add = (target, job) => {
    target.jobCount += 1;
    const date = job.jobCompletedAt || job.completedAt || job.completedStatus?.at;
    if (date && Number.isFinite(new Date(date).getTime()) && (!target.lastCompletedAt || new Date(date) > new Date(target.lastCompletedAt))) target.lastCompletedAt = new Date(date).toISOString();
    const score = job.technicianRating?.score;
    if (typeof score === 'number' && score >= 1 && score <= 5) { target.ratingTotal += score; target.ratingCount += 1; }
    if (job.pay?.type === 'hourly' && job.pay.hourlyRate > 0) { target.hourlyTotal += job.pay.hourlyRate; target.hourlyCount += 1; }
  };
  for (const job of jobs) {
    if (!COMPLETED_STATUSES.includes(job.status)) continue;
    totalJobs += 1;
    const types = [job.workType, job.additionalWorkType].filter((type) => type?.name);
    if (!types.length) types.push({ name: job.category || 'General Service' });
    const seen = new Set();
    for (const type of types) {
      const id = key(type);
      if (!groups.has(id)) groups.set(id, { ...entry(type), subTypes: new Map(), serviceTypes: new Map() });
      const group = groups.get(id);
      if (!seen.has(id)) add(group, job);
      for (const [field, value] of [['subTypes', type.subType], ['serviceTypes', job.serviceType]]) {
        if (!value?.name) continue;
        const childKey = `${id}:${field}:${key(value)}`;
        if (seen.has(childKey)) continue;
        if (!group[field].has(key(value))) group[field].set(key(value), entry(value));
        add(group[field].get(key(value)), job);
        seen.add(childKey);
      }
      seen.add(id);
    }
  }
  const finish = ({ ratingTotal, ratingCount, hourlyTotal, hourlyCount, ...row }) => ({ ...row, ratingCount, averageRating: ratingCount ? Number((ratingTotal / ratingCount).toFixed(2)) : null, averageHourlyRate: hourlyCount ? Number((hourlyTotal / hourlyCount).toFixed(2)) : null });
  const sorted = (values) => [...values].map(finish).sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name));
  return { totalJobs, workTypes: sorted(groups.values()).map((group) => ({ ...group, subTypes: sorted(group.subTypes.values()), serviceTypes: sorted(group.serviceTypes.values()) })) };
}

module.exports = { buildWorkSummary, COMPLETED_STATUSES };
