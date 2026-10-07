const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Admin { constructor(role, isActive = true) { this._id = 'admin-id'; this.role = role; this.isActive = isActive; } }
function load(controller, booking) {
    const context = { exports: {}, console, process, require(name) {
        if (name === '../models/Admin') return Admin;
        if (name === '../models/Booking') return { findById() { return { populate() { return this; }, then(resolve) { return Promise.resolve(booking).then(resolve); } }; } };
        if (name === 'mongoose') return { isObjectIdOrHexString: () => true };
        if (name === '../utils/invoiceService') return { generateTextInvoice: () => 'Invoice content' };
        if (name === '../utils/bookingInvoiceData') return { buildBookingInvoice: () => ({ id: 'invoice-1' }) };
        return {};
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve(`../src/controllers/${controller}`), 'utf8'), context);
    return async (method, user) => {
        const result = { status: 200 };
        const response = { status(code) { result.status = code; return this; }, setHeader() {}, send(body) { result.body = body; }, json(body) { result.body = body; } };
        await context.exports[method]({ params: { id: 'booking-id' }, user }, response, error => { throw error; });
        return result;
    };
}
for (const [controller, method] of [['bookingController', 'downloadInvoice'], ['invoiceController', 'getInvoice']]) {
    test(`${method}: active admin accounts can access another customer's invoice`, async () => {
        const invoke = load(controller, { _id: 'booking-id', user: { _id: 'customer-id' } });
        for (const role of ['admin', 'read_only_analyst', 'operations_dispatch', 'support_agents']) {
            assert.equal((await invoke(method, new Admin(role))).status, 200);
        }
    });
    test(`${method}: owner is allowed and other customers and inactive admins are denied`, async () => {
        const invoke = load(controller, { _id: 'booking-id', user: { _id: 'customer-id' } });
        assert.equal((await invoke(method, { _id: 'customer-id', role: 'user' })).status, 200);
        assert.equal((await invoke(method, { id: 'other-id', role: 'user' })).status, 403);
        assert.equal((await invoke(method, new Admin('admin', false))).status, 403);
        assert.equal((await invoke(method, { id: 'other-id', role: 'admin' })).status, 403);
    });
    test(`${method}: admin access works when the original customer record is missing`, async () => {
        const invoke = load(controller, { _id: 'booking-id', user: null });
        assert.equal((await invoke(method, new Admin('admin'))).status, 200);
        assert.equal((await invoke(method, { id: 'other-id', role: 'user' })).status, 403);
    });
}
