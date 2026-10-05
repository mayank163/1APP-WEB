const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup({ wrongAmount = false, wrongCurrency = false, wrongOwner = false, pending = false, completed = false } = {}) {
    let captures = 0;
    let bookings = 0;
    const attempt = { _id: 'attempt', user: 'customer', totalAmount: 25,
        paymentDetails: { provider: 'paypal', orderId: 'order', currency: 'USD' }, async save() {} };
    const capture = { id: 'capture', status: pending ? 'PENDING' : 'COMPLETED', amount: { value: wrongAmount ? '1.00' : '25.00', currency_code: wrongCurrency ? 'EUR' : 'USD' } };
    const order = { id: 'order', intent: 'CAPTURE', status: completed ? 'COMPLETED' : 'APPROVED', purchase_units: [{ custom_id: wrongOwner ? 'other' : 'attempt', amount: { value: '25.00', currency_code: 'USD' }, payments: { captures: [capture] } }] };
    const Booking = {
        async findOne() { return null; },
        async create(data) { bookings++; assert.equal(data.paymentDetails.paymentId, 'capture'); return { _id: 'booking' }; },
        findById() { return { populate() { return { async populate() { return {}; } }; } }; }
    };
    const PaymentAttempt = { async findOne(query) { assert.equal(query.user, 'customer'); assert.equal(query._id, 'attempt'); return wrongOwner === 'user' ? null : attempt; }, async findOneAndUpdate() { return attempt; } };
    const exports = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/bookingController.js'), 'utf8'), {
        exports, console, Date,
        require(name) {
            if (name === '../models/Booking') return Booking;
            if (name === '../models/PaymentAttempt') return PaymentAttempt;
            if (name === '../config/paypal') return { async getOrder() { return order; }, async captureOrder() { captures++; return { ...order, status: 'COMPLETED' }; } };
            if (name === '../utils/emailService') return { sendBookingConfirmed: async () => {} };
            return {};
        }
    });
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    return { async run(id = 'order') {
        await exports.verifyPayment({ user: { id: 'customer' }, body: { paymentAttemptId: 'attempt', paypalOrderId: id } }, res, err => { throw err; });
        return { code: res.code, body: res.body, captures, bookings };
    } };
}

test('approved PayPal order is captured and creates a paid booking', async () => {
    const result = await setup().run();
    assert.equal(result.code, 201); assert.equal(result.captures, 1); assert.equal(result.bookings, 1);
});
test('completed capture is recovered without charging again', async () => {
    const result = await setup({ completed: true }).run();
    assert.equal(result.code, 201); assert.equal(result.captures, 0);
});
for (const option of ['wrongAmount', 'wrongCurrency', 'pending', 'wrongOwner']) {
    test(`rejects ${option} without creating a booking`, async () => {
        const result = await setup({ [option]: true }).run();
        assert.ok([400, 409].includes(result.code)); assert.equal(result.bookings, 0);
    });
}
test('rejects a different order before capture', async () => {
    const result = await setup().run('other-order');
    assert.equal(result.code, 400); assert.equal(result.captures, 0);
});
test('payment attempt must belong to the authenticated customer', async () => {
    const result = await setup({ wrongOwner: 'user' }).run();
    assert.equal(result.code, 404); assert.equal(result.captures, 0);
});
