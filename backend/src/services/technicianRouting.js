const { COMPLETED_STATUSES } = require('./technicianWorkSummary');

// Legacy records used presence as account status; both remain enabled accounts.
const ROUTABLE_ACCOUNT_STATUSES = ['active', 'online', 'offline'];
const isRoutableAccount = user => ROUTABLE_ACCOUNT_STATUSES.includes(user?.accountStatus);

const types = job => [job.workType, job.additionalWorkType].filter(type => type?._id || type?.name);
const sameType = (a, b) => a._id && b._id
  ? String(a._id) === String(b._id)
  : Boolean(a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase());

function matchesWorkType(job, pastJob) {
  if (!COMPLETED_STATUSES.includes(pastJob.status)) return false;
  const target = types(job);
  const previous = types(pastJob);
  if (target.length && previous.length) {
    return target.some(type => previous.some(past => sameType(type, past)));
  }
  // Older jobs can store only the category name instead of a work-type snapshot.
  const normalized = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const category = normalized(job.category);
  const pastCategory = normalized(pastJob.category);
  if (category && pastCategory && category === pastCategory) return true;
  if (target.length && !previous.length && pastCategory) {
    return target.some(type => normalized(type.name) === pastCategory);
  }
  if (!target.length && previous.length && category) {
    return previous.some(type => normalized(type.name) === category);
  }
  return false;
}

function straightLineDistanceKm(from, to) {
  const valid = point => point && typeof point.lat === 'number' && typeof point.lng === 'number'
    && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  if (!valid(from) || !valid(to)) return null;
  const rad = value => value * Math.PI / 180;
  const a = Math.sin(rad(to.lat - from.lat) / 2) ** 2
    + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function rankTechnicians(job, history, technicians) {
  const counts = new Map();
  const totals = new Map();
  const finished = new Map();
  for (const past of history) {
    const id = String(past.assignedTechnician?._id || '');
    if (COMPLETED_STATUSES.includes(past.status) || past.status === 'cancelled') finished.set(id, (finished.get(id) || 0) + 1);
    if (COMPLETED_STATUSES.includes(past.status)) totals.set(id, (totals.get(id) || 0) + 1);
    if (!matchesWorkType(job, past)) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return technicians.filter(t => isRoutableAccount(t) && counts.has(String(t._id)))
    .map(t => {
      const id = String(t._id);
      const completedJobCount = totals.get(id) || 0;
      const { addresses, ...profile } = t;
      return { ...profile, matchingJobCount: counts.get(id), completedJobCount,
        providerSuccessScore: finished.get(id) ? completedJobCount / finished.get(id) * 100 : null,
        distanceKm: straightLineDistanceKm(job.coordinates, t.serviceAreaCoordinates) };
    })
    .sort((a, b) => b.matchingJobCount - a.matchingJobCount || a.name.localeCompare(b.name) || String(a._id).localeCompare(String(b._id)));
}

module.exports = { matchesWorkType, rankTechnicians, straightLineDistanceKm, ROUTABLE_ACCOUNT_STATUSES, isRoutableAccount };
