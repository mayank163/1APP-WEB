const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const setup = () => {
    const calls = {};
    const data = { _id: 'booking-1', status: 'On the Way' };
    const query = {
        populate() { return this; }, sort(value) { calls.sort = value; return this; }, skip() { return this; }, limit() { return Promise.resolve([{ ...data, toObject: () => data }]); }
    };
    const context = { exports: {}, console, Date, Map, process, require(name) {
        if (name === '../models/Booking') return { countDocuments: async () => 1, find(filter) { calls.filter = filter; return query; } };
        if (name === '../models/User') return { find() { return { select: async () => [{ _id: 'user-1' }] }; } };
        if (name === '../models/Service') return { find() { return { select: async () => [{ _id: 'service-1' }] }; } };
        if (name === '../models/TechnicianJob') return { find() { return { select: async () => [{ _id: 'job-1', sourceBooking: 'booking-1', statusHistory: [{ status: 'assigned' }] }] }; } };
        if (name === '../models/AdditionalCharge') return { find() { return { select: async () => [{ _id: 'charge-1', job: 'job-1', label: 'Parts', requestedAmount: 300 }] }; } };
        if (name === '../utils/pagination') return { getPagination: () => ({ page: 1, limit: 10, skip: 0 }), getPaginationMeta: values => values };
        return {};
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/adminController'), 'utf8'), context);
    return { calls, async invoke(params) {
        let body;
        const res = { status() { return this; }, json(value) { body = value; } };
        await context.exports.getAllBookings({ query: params }, res, error => { throw error; });
        return body;
    } };
};
test('booking search includes matching services and searches structured addresses', async () => {
    const app = setup();
    await app.invoke({ search: 'AC Repair', sort: 'amount-desc' });
    assert.equal(app.calls.sort.totalAmount, -1);
    assert.ok(app.calls.filter.$or.some(condition => condition['services.service']?.$in.includes('service-1')));
    assert.ok(app.calls.filter.$or.some(condition => condition['address.addressLine'] instanceof Object || condition['address.addressLine']?.source === 'AC Repair'));
    assert.equal(app.calls.filter.$or.some(condition => 'address' in condition), false);
});
test('booking response includes linked history and additional charges', async () => {
    const app = setup();
    const res = await app.invoke({ status: 'On the Way' });
    assert.equal(app.calls.filter.status, 'On the Way');
    assert.equal(res.data.bookings[0].tracking.statusHistory[0].status, 'assigned');
    assert.equal(res.data.bookings[0].additionalCharges[0].requestedAmount, 300);
});
