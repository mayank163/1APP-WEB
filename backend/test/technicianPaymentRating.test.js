const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/controllers/adminTechnicianController.js'), 'utf8');
function load({ ratingFails = false } = {}) {
  const calls = { paid: 0, ratings: 0 };
  const job = { _id: 'job-1', title: 'Repair', status: 'checkout', assignedTechnician: { _id: 'tech-1' }, pay: { fixedAmount: 100 }, async save() { calls.paid++; } };
  const dependencies = {
    '../services/technicianRating': {
      validateFeedback: input => { if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) throw new Error('Invalid rating'); },
      saveTechnicianRating: async () => {
        calls.ratings++;
        assert.equal(job.status, 'completed');
        assert.equal(job.payment.status, 'paid');
        if (ratingFails) throw new Error('Feedback storage unavailable');
        return { technicianRating: { score: 4 } };
      },
    },
    '../models/TechnicianJob': { findById: async () => job },
    '../models/TechnicianJobRequest': { findById: async () => null },
    '../models/User': { findByIdAndUpdate: async () => ({ totalEarnings: 100 }) },
    '../models/Admin': { findByIdAndUpdate: async () => ({ walletBalance: 100 }) },
    '../utils/socketInstance': { getIO: () => ({ to: () => ({ emit() {} }) }) },
    '../services/notificationService': { sendToTechnician: async () => {} },
    '../services/bookingTechnicianJobSync': { syncBookingFromTechnicianJob: async () => {} },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: key => dependencies[key] || {}, console: { log() {}, warn() {}, error() {} }, Date });
  const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  return { calls, response, pay: body => module.exports.payTechnician({ params: { jobId: 'job-1' }, user: { _id: 'admin-1' }, body }, response, error => { throw error; }) };
}
test('payment can be approved without any technician rating', async () => {
  const { pay, response, calls } = load();
  await pay({});
  assert.equal(response.code, 200);
  assert.equal(response.body.success, true);
  assert.equal(calls.paid, 1);
  assert.equal(calls.ratings, 0);
});
test('payment accepts feedback and returns the saved work order rating', async () => {
  const { pay, response, calls } = load();
  await pay({ feedback: { score: 4 } });
  assert.equal(response.body.data.job.technicianRating.score, 4);
  assert.equal(calls.ratings, 1);
});
test('invalid feedback is rejected before payment changes', async () => {
  const { pay, response, calls } = load();
  await pay({ feedback: { score: 6 } });
  assert.equal(response.code, 400);
  assert.equal(calls.paid, 0);
});
test('feedback failure reports a successful payment with a separate warning', async () => {
  const { pay, response, calls } = load({ ratingFails: true });
  await pay({ feedback: { score: 4 } });
  assert.equal(response.body.success, true);
  assert.match(response.body.data.ratingWarning, /Payment succeeded/);
  assert.equal(calls.paid, 1);
});
