const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(overrides = {}) {
    const calls = [];
    const User = {
        exists: async () => false,
        create: async data => { calls.push(data); return { toObject: () => ({ ...data, _id: 'customer-id' }) }; },
        findOneAndUpdate: async (query, update, options) => { calls.push({ query, update, options }); return { _id: 'customer-id', ...update.$set }; },
        ...overrides
    };
    const context = { exports: {}, Date, console, process, require(name) { return name === '../models/User' ? User : {}; } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/adminController'), 'utf8'), context);
    return { calls, async invoke(method, body) {
        const result = {};
        const res = { status(code) { result.status = code; return this; }, json(data) { result.body = data; } };
        await context.exports[method]({ body, params: { id: 'customer-id' } }, res, err => { throw err; });
        return result;
    } };
}
test('creating a customer fixes role and excludes password from response', async () => {
    const app = setup();
    const result = await app.invoke('createCustomer', { name: 'Priya', email: 'priya@example.com', phone: '9876543210', password: 'secret123', role: 'admin' });
    assert.equal(result.status, 201);
    assert.equal(app.calls[0].role, 'user');
    assert.equal(result.body.data.user.password, undefined);
});
test('customer creation rejects duplicate emails and short passwords', async () => {
    const app = setup({ exists: async () => true });
    assert.equal((await app.invoke('createCustomer', { name: 'Priya', email: 'p@example.com', phone: '9876543210', password: 'short' })).status, 400);
    assert.equal((await app.invoke('createCustomer', { name: 'Priya', email: 'p@example.com', phone: '9876543210', password: 'secret123' })).status, 409);
    assert.equal(app.calls.length, 0);
});
test('editing a customer cannot alter password or role and validates fields', async () => {
    const app = setup();
    await app.invoke('updateCustomer', { name: 'Updated', role: 'admin', password: 'newpassword', dateOfBirth: '' });
    const call = app.calls[0];
    assert.equal(call.query.role, 'user');
    assert.equal(call.update.$set.name, 'Updated');
    assert.equal(call.update.$set.role, undefined);
    assert.equal(call.update.$set.password, undefined);
    assert.equal(call.update.$set.dateOfBirth, null);
    assert.equal(call.options.runValidators, true);
});
