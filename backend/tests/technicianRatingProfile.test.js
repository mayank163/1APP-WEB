const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Evaluate the Mongo expressions used by the profile pipeline against an in-memory profile.
const read = (value, path) => path.length === 0 ? value : Array.isArray(value)
    ? value.map(item => read(item, path)) : read(value?.[path[0]], path.slice(1));
const evaluate = (value, doc, vars = {}) => {
    if (typeof value === 'string' && value.startsWith('$$')) return read(vars, value.slice(2).split('.'));
    if (typeof value === 'string' && value.startsWith('$')) return read(doc, value.slice(1).split('.'));
    if (Array.isArray(value)) return value.map(item => evaluate(item, doc, vars));
    if (!value || typeof value !== 'object' || value instanceof Date) return value;
    const [op, argument] = Object.entries(value)[0];
    const args = () => evaluate(argument, doc, vars);
    switch (op) {
        case '$literal': return argument;
        case '$ifNull': { const [a, b] = args(); return a ?? b; }
        case '$concatArrays': return args().flat();
        case '$size': return args().length;
        case '$add': return args().reduce((sum, n) => sum + n, 0);
        case '$avg': { const items = args(); return items.length ? items.reduce((sum, n) => sum + n, 0) / items.length : null; }
        case '$ne': { const [a, b] = args(); return a !== b; }
        case '$filter': return evaluate(argument.input, doc, vars).filter(item => evaluate(argument.cond, doc, { ...vars, [argument.as]: item }));
        default: throw new Error(`Unsupported expression: ${op}`);
    }
};
const setup = (profile = {}) => {
    const context = { module: { exports: {} }, Date, require(name) {
        if (name === '../models/User') return { updateOne: async (filter, stages) => {
            assert.equal(filter._id, 'tech');
            assert.equal(filter.role, 'technician');
            for (const stage of stages) {
                const updates = Object.fromEntries(Object.entries(stage.$set).map(([key, value]) => [key, evaluate(value, profile)]));
                Object.assign(profile, updates);
            }
            return { matchedCount: 1 };
        } };
        return {};
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/technicianRating'), 'utf8'), context);
    return { profile, ...context.module.exports };
};
const booking = (id, rating) => ({ _id: id, user: 'customer', technicianReview: { technician: 'tech', rating, review: 'Good work' } });
const job = (id, score) => ({ _id: id, assignedTechnician: { _id: 'tech' }, technicianRating: { score, ratedAt: new Date() } });

test('customer rating contributes to existing admin average and updates without duplicate counts', async () => {
    const app = setup({ workOrderRatings: [{ job: 'workorder', score: 5 }] });
    await app.syncCustomerRatingToProfile(booking('booking-1', 3));
    assert.equal(app.profile.rating, 4);
    assert.equal(app.profile.ratingCount, 2);
    assert.equal(app.profile.customerBookingRatings[0].customer, 'customer');
    await app.syncCustomerRatingToProfile(booking('booking-1', 1));
    assert.equal(app.profile.rating, 3);
    assert.equal(app.profile.ratingCount, 2);
    await app.syncCustomerRatingToProfile(booking('booking-2', 3));
    assert.equal(app.profile.rating, 3);
    assert.equal(app.profile.ratingCount, 3);
});
test('subsequent admin ratings preserve customer contributions', async () => {
    const app = setup();
    await app.syncCustomerRatingToProfile(booking('booking-1', 1));
    assert.equal(app.profile.rating, 1);
    await app.syncRatingToProfile(job('workorder', 5));
    assert.equal(app.profile.rating, 3);
    assert.equal(app.profile.ratingCount, 2);
    await app.syncRatingToProfile(job('workorder', 5));
    assert.equal(app.profile.ratingCount, 2);
});
test('admin-only average still works for existing profiles', async () => {
    const app = setup({ workOrderRatings: [{ job: 'old-job', score: 3 }] });
    await app.syncRatingToProfile(job('new-job', 5));
    assert.equal(app.profile.rating, 4);
    assert.equal(app.profile.ratingCount, 2);
});
