const TechnicianJob = require('../models/TechnicianJob');

const BLOCKING_STATUSES = [
  'assigned',
  'ontheway',
  'visited',
  'inprogress',
  'in-progress',
];

const getValidWindow = (job) => {
  const from = new Date(job?.jobDate?.from);
  const to = new Date(job?.jobDate?.to);

  if (!job?.jobDate?.from || !job?.jobDate?.to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return null;
  }

  return { from, to };
};

const findTechnicianScheduleConflict = async (technicianId, job, options = {}) => {
  const window = getValidWindow(job);
  if (!window || !technicianId) return null;

  const query = {
    'assignedTechnician._id': technicianId,
    status: { $in: BLOCKING_STATUSES },
    'jobDate.from': { $lt: window.to },
    'jobDate.to': { $gt: window.from },
  };

  if (options.excludeJobId) query._id = { $ne: options.excludeJobId };

  let conflictQuery = TechnicianJob.findOne(query)
    .select('_id title jobDate status')
    .sort({ 'jobDate.from': 1 });

  if (options.session) conflictQuery = conflictQuery.session(options.session);

  return conflictQuery;
};

const createScheduleConflictError = (conflict, message = 'The technician already has an assigned job during this time.') => {
  const error = new Error(message);
  error.statusCode = 409;
  error.conflictingJob = conflict;
  return error;
};

module.exports = {
  BLOCKING_STATUSES,
  getValidWindow,
  findTechnicianScheduleConflict,
  createScheduleConflictError,
};
