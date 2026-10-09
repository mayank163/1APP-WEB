const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const invoke = async ({ rating = 4, review = ' Great work ', booking = { assignedTechnician: { name: 'Sam', phone: '123' }, save: async () => {} }, id = 'valid', job } = {}) => {
    let filter, body, status;
    const context = { exports: {}, require(name) {
        if (name === 'mongoose') return { isValidObjectId: value => value === 'valid' };
        if (name === '../models/TechnicianJob') return { findOne: async () => job === undefined ? { assignedTechnician: { _id: 'tech-id', ...booking?.assignedTechnician } } : job };
        if (name === '../services/technicianRating') return { syncCustomerRatingToProfile: async value => { assert.equal(value.technicianReview.technician, 'tech-id'); } };
        if (name === '../models/Booking') return { findOne: async value => { filter = value; return booking; } };
        return {};
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/reviewController'), 'utf8'), context);
    await context.exports.submitTechnicianReview({ params: { bookingId: id }, user: { _id: 'customer' }, body: { rating, review } }, {
        status(value) { status = value; return this; }, json(value) { body = value; }
    }, err => { throw err; });
    return { status, body, filter, booking };
};
test('saves a separate review scoped to the customer and completed booking', async () => {
    const result = await invoke();
    assert.equal(result.status, 200);
    assert.equal(result.filter.user, 'customer');
    assert.equal(result.filter.status, 'Completed');
    assert.equal(result.filter._id, 'valid');
    assert.equal(result.booking.technicianReview.review, 'Great work');
    assert.equal(result.booking.technicianReview.technicianName, 'Sam');
    assert.equal(result.booking.technicianReview.technician, 'tech-id');
});
test('rejects invalid ratings and comments', async () => {
    for (const rating of [0, 6, 1.5, '4']) assert.equal((await invoke({ rating })).status, 400);
    for (const review of [null, {}, 'x'.repeat(501)]) assert.equal((await invoke({ review })).status, 400);
    assert.equal((await invoke({ id: 'bad' })).status, 400);
});
test('rejects ineligible bookings and missing technicians', async () => {
    assert.equal((await invoke({ booking: null })).status, 403);
    assert.equal((await invoke({ job: null })).status, 400);
    assert.equal((await invoke({ job: { assignedTechnician: {} } })).status, 400);
});
test('updates the booking review and retains its original creation time', async () => {
    const createdAt = new Date('2026-01-01');
    const booking = { assignedTechnician: { name: 'Sam' }, technicianReview: { rating: 2, createdAt }, save: async () => {} };
    const result = await invoke({ booking, rating: 5 });
    assert.equal(result.booking.technicianReview.rating, 5);
    assert.equal(result.booking.technicianReview.createdAt, createdAt);
});
