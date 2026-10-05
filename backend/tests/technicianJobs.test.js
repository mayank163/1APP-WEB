const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const createController = () => {
  const calls = [];
  const job = {
    _id: 'job-1',
    technicianRating: { score: 4 },
    privateTechnicianFeedback: { note: 'Good work', criteria: { workQuality: 'up' } },
  };
  const TechnicianJob = {
    find(query) {
      const call = { query, selection: null };
      calls.push(call);
      return {
        select(selection) { call.selection = selection; return this; },
        async sort() {
          return [{ _id: job._id, toObject() {
            const result = { _id: job._id, technicianRating: job.technicianRating };
            if (call.selection === '+privateTechnicianFeedback') result.privateTechnicianFeedback = job.privateTechnicianFeedback;
            return result;
          } }];
        },
      };
    },
  };
  const TechnicianJobRequest = { find() { return { async select() { return []; } }; } };
  const context = {
    module: { exports: {} }, console,
    require(name) {
      if (name === '../models/TechnicianJob') return TechnicianJob;
      if (name === '../models/TechnicianJobRequest') return TechnicianJobRequest;
      return {};
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/technicianController.js'), 'utf8'), context);
  return { controller: context.module.exports.getJobsForTechnicians, calls };
};

const getJobs = async (filter) => {
  const { controller, calls } = createController();
  let response;
  await controller({ query: filter ? { filter } : {}, user: { _id: 'signed-in-technician' } }, {
    status(code) { assert.equal(code, 200); return this; },
    json(body) { response = body; return this; },
  }, error => { throw error; });
  return { response, calls };
};

test('completed jobs include feedback and rating while retaining technician ownership filtering', async () => {
  const { response, calls } = await getJobs('completed');
  assert.equal(calls[0].query['assignedTechnician._id'], 'signed-in-technician');
  assert.equal(calls[0].selection, '+privateTechnicianFeedback');
  assert.equal(response.data.jobs[0].technicianRating.score, 4);
  assert.equal(response.data.jobs[0].privateTechnicianFeedback.note, 'Good work');
  assert.equal(response.data.jobs[0].privateTechnicianFeedback.criteria.workQuality, 'up');
});

test('the default new-jobs feed does not opt into private feedback', async () => {
  const { response, calls } = await getJobs();
  assert.equal(calls[0].query.status, 'open');
  assert.equal(calls[0].selection, null);
  assert.equal(response.data.jobs[0].privateTechnicianFeedback, undefined);
});
