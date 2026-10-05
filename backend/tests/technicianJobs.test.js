const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const createController = ({ assignedTo = 'signed-in-technician', missing = false } = {}) => {
  const calls = [];
  const job = {
    _id: 'job-1',
    assignedTechnician: { _id: assignedTo },
    technicianRating: { score: 4 },
    privateTechnicianFeedback: { note: 'Good work', criteria: { workQuality: 'up' } },
  };
  const TechnicianJob = {
    findById(id) {
      const call = { id, selection: null };
      calls.push(call);
      return {
        select(selection) { call.selection = selection; return this; },
        async populate() {
          return missing ? null : { ...job, toObject: () => ({ ...job }) };
        },
      };
    },
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
  return { controller: context.module.exports.getJobsForTechnicians, detailsController: context.module.exports.getDetailsByJobId, calls };
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


const getDetails = async options => {
  const { detailsController, calls } = createController(options);
  let status;
  let response;
  await detailsController({ params: { jobId: 'job-1' }, user: { _id: 'signed-in-technician' } }, {
    status(code) { status = code; return this; },
    json(body) { response = body; return this; },
  }, error => { throw error; });
  return { status, response, calls };
};

test('job details include private feedback for the assigned technician', async () => {
  const { status, response, calls } = await getDetails();
  assert.equal(status, 200);
  assert.equal(calls[0].selection, '+privateTechnicianFeedback');
  assert.equal(response.data.job.privateTechnicianFeedback.note, 'Good work');
  assert.equal(response.data.job.privateTechnicianFeedback.criteria.workQuality, 'up');
  assert.equal(response.data.job.technicianRating.score, 4);
});

test('job details hide private feedback from another technician', async () => {
  const { status, response } = await getDetails({ assignedTo: 'another-technician' });
  assert.equal(status, 200);
  assert.equal(response.data.job.privateTechnicianFeedback, undefined);
  assert.equal(response.data.job.technicianRating.score, 4);
});

test('job details still return 404 for missing jobs', async () => {
  const { status, response } = await getDetails({ missing: true });
  assert.equal(status, 404);
  assert.equal(response.message, 'Job not found');
});
