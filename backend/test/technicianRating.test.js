const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/services/technicianRating.js'), 'utf8');
function load({ profileFailure = false, status = 'completed', payment = 'paid' } = {}) {
  let stored;
  const calls = { profile: [], rollback: 0 };
  const module = { exports: {} };
  const models = {
    '../models/TechnicianJob': {
      async findOneAndUpdate(query, update) {
        assert.equal(query.status, 'completed');
        assert.equal(query['payment.status'], 'paid');
        assert.equal(query['technicianRating.score'].$exists, false);
        if (stored || status !== 'completed' || payment !== 'paid') return null;
        stored = { _id: 'job-1', assignedTechnician: { _id: 'tech-1' }, ...update.$set };
        return stored;
      },
      async updateOne() { calls.rollback++; stored = null; },
    },
    '../models/User': {
      async updateOne(query, pipeline, options) {
        assert.equal(options.updatePipeline, true);
        calls.profile.push({ query, pipeline });
        if (profileFailure) throw new Error('Profile write failed');
        return { matchedCount: 1 };
      },
    },
  };
  vm.runInNewContext(source, { module, require: key => models[key], Date, console });
  return { ...module.exports, calls };
}
test('accepts five expectation ratings, optional notes and selected criteria', () => {
  const { validateFeedback } = load();
  for (let score = 1; score <= 5; score++) assert.equal(validateFeedback({ score }).score, score);
  const result = validateFeedback({ score: 4, note: ' Good job ', criteria: { communication: 'up', workQuality: 'down' } });
  assert.equal(result.note, 'Good job');
  assert.equal(result.criteria.communication, 'up');
});
test('rejects invalid rating values, excessive notes and unknown criteria', () => {
  const { validateFeedback } = load();
  for (const score of [0, 6, 3.5, '5', null, undefined]) assert.throws(() => validateFeedback({ score }), /rating/);
  assert.throws(() => validateFeedback({ score: 3, note: 'x'.repeat(5001) }), /note/);
  assert.throws(() => validateFeedback({ score: 3, criteria: { unknown: 'up' } }), /criteria/);
  assert.throws(() => validateFeedback({ score: 3, criteria: { communication: true } }), /criteria/);
});
test('stores work order score and private feedback separately and updates the assigned profile', async () => {
  const { saveTechnicianRating, calls } = load();
  const job = await saveTechnicianRating('job-1', { score: 5, note: 'Private team note' }, 'admin-1');
  assert.equal(job.technicianRating.score, 5);
  assert.equal(job.technicianRating.ratedBy, 'admin-1');
  assert.equal(job.technicianRating.note, undefined);
  assert.equal(job.privateTechnicianFeedback.note, 'Private team note');
  assert.equal(calls.profile[0].query._id, 'tech-1');
  const pipeline = calls.profile[0].pipeline;
  assert.equal(pipeline[1].$set.rating.$avg, '$workOrderRatings.score');
  assert.equal(pipeline[1].$set.ratingCount.$size, '$workOrderRatings');
  assert.equal(pipeline[0].$set.workOrderRatings.$concatArrays[1].$literal[0].job, 'job-1');
  assert.equal(pipeline[0].$set.workOrderRatings.$concatArrays[1].$literal[0].note, undefined);
});
test('duplicate feedback cannot add a second profile rating for one work order', async () => {
  const { saveTechnicianRating, calls } = load();
  await saveTechnicianRating('job-1', { score: 4 }, 'admin-1');
  await assert.rejects(saveTechnicianRating('job-1', { score: 2 }, 'admin-2'), error => error.statusCode === 409);
  assert.equal(calls.profile.length, 1);
});
test('unpaid and unfinished work orders cannot be rated', async () => {
  for (const options of [{ status: 'checkout' }, { payment: 'pending' }]) {
    const { saveTechnicianRating, calls } = load(options);
    await assert.rejects(saveTechnicianRating('job-1', { score: 3 }, 'admin-1'), error => error.statusCode === 409);
    assert.equal(calls.profile.length, 0);
  }
});
test('profile persistence failure keeps the work order available for retry', async () => {
  const { saveTechnicianRating, calls } = load({ profileFailure: true });
  await assert.rejects(saveTechnicianRating('job-1', { score: 3 }, 'admin-1'), /Profile write failed/);
  assert.equal(calls.rollback, 1);
});
test('private team feedback is excluded from default technician job queries', () => {
  const TechnicianJob = require('../src/models/TechnicianJob');
  assert.equal(TechnicianJob.schema.path('privateTechnicianFeedback').options.select, false);
});

// Exercise the installed Mongoose query layer, including pipeline opt-in and
// ObjectId handling, while replacing only the database transport.
test('profile pipeline is accepted by Mongoose and keeps ObjectId job references', async () => {
  const mongoose = require('mongoose');
  const User = require('../src/models/User');
  const original = User.collection.updateOne;
  let sent;
  User.collection.updateOne = async (filter, update) => {
    sent = { filter, update };
    return { matchedCount: 1, modifiedCount: 1 };
  };
  try {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, require: key => key.endsWith('/User') ? User : {}, Date });
    const jobId = new mongoose.Types.ObjectId();
    const technicianId = new mongoose.Types.ObjectId();
    await module.exports.syncRatingToProfile({ _id: jobId, assignedTechnician: { _id: technicianId }, technicianRating: { score: 5, ratedAt: new Date() } });
    assert.equal(String(sent.filter._id), String(technicianId));
    assert.equal(String(sent.update[0].$set.workOrderRatings.$concatArrays[1].$literal[0].job), String(jobId));
  } finally { User.collection.updateOne = original; }
});
