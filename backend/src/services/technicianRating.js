const TechnicianJob = require('../models/TechnicianJob');
const User = require('../models/User');

const CRITERIA = ['checkInTimeliness', 'communication', 'preparedness', 'onsiteEfficiency', 'deliverableTimeliness', 'professionalism', 'responsiveness', 'followingInstructions', 'workQuality', 'deliverableAccuracy', 'clientSatisfaction', 'technicalSkills'];
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const validateFeedback = input => {
  if (!input || typeof input !== 'object' || !Number.isInteger(input.score) || input.score < 1 || input.score > 5) throw fail('Select a service rating from 1 to 5.');
  if (input.note != null && (typeof input.note !== 'string' || input.note.length > 5000)) throw fail('Team note must be at most 5000 characters.');
  const criteria = input.criteria || {};
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria) || Object.entries(criteria).some(([key, value]) => !CRITERIA.includes(key) || !['up', 'down'].includes(value))) throw fail('Invalid feedback criteria.');
  return { score: input.score, note: (input.note || '').trim(), criteria };
};

// One rating per paid work order. Profile history is idempotent and its average
// is recalculated atomically, so concurrent ratings cannot lose an update.
const saveTechnicianRating = async (jobId, input, adminId) => {
  const feedback = validateFeedback(input);
  const job = await TechnicianJob.findOneAndUpdate({
    _id: jobId, status: 'completed', 'payment.status': 'paid',
    'assignedTechnician._id': { $ne: null }, 'technicianRating.score': { $exists: false },
  }, { $set: {
    technicianRating: { score: feedback.score, ratedBy: adminId, ratedAt: new Date() },
    privateTechnicianFeedback: { note: feedback.note, criteria: feedback.criteria },
  } }, { new: true, runValidators: true });
  if (!job) throw fail('Only paid work orders with an assigned technician and no existing rating can be rated.', 409);
  try {
    await syncRatingToProfile(job);
  } catch (error) {
    // Keep the work order eligible for retry if profile persistence fails.
    // The profile update deduplicates by job, including an ambiguous DB retry.
    await TechnicianJob.updateOne({ _id: job._id, 'technicianRating.ratedAt': job.technicianRating.ratedAt },
      { $unset: { technicianRating: '', privateTechnicianFeedback: '' } });
    throw error;
  }
  return job;
};
const syncRatingToProfile = async job => {
  const entry = { job: job._id, score: job.technicianRating.score, ratedAt: job.technicianRating.ratedAt };
  const result = await User.updateOne({ _id: job.assignedTechnician._id, role: 'technician' }, [
    { $set: { workOrderRatings: { $concatArrays: [
      { $filter: { input: { $ifNull: ['$workOrderRatings', []] }, as: 'rating', cond: { $ne: ['$$rating.job', job._id] } } },
      { $literal: [entry] },
    ] } } },
    { $set: { rating: { $avg: '$workOrderRatings.score' }, ratingCount: { $size: '$workOrderRatings' } } },
  ], { updatePipeline: true });
  if (result.matchedCount === 0) throw fail('Assigned technician profile was not found.', 404);
};
module.exports = { CRITERIA, validateFeedback, saveTechnicianRating, syncRatingToProfile };
