const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let offer, usage, claims, globalFilter, usageFilter, updates, unavailable;
const clone = value => structuredClone(value);
let queue = Promise.resolve();
const transaction = callback => {
    const operation = queue.then(async () => {
        const snapshot = clone({ offer, usage, claims });
        try { return await callback({ transaction: true }); }
        catch (error) { ({ offer, usage, claims } = snapshot); throw error; }
    });
    queue = operation.catch(() => {}); return operation;
};
const Offer = {
    findOne: async () => clone(offer),
    findOneAndUpdate: async (filter, update, options) => {
        assert.ok(options.session); globalFilter = filter;
        if (unavailable || filter.__v !== offer.__v || offer.totalLimit != null && offer.used + offer.reserved >= offer.totalLimit) return null;
        offer.reserved += update.$inc.reserved; offer.__v += update.$inc.__v; return clone(offer);
    },
    updateOne: async (filter, update, options) => { assert.ok(options.session); updates.push(update); for (const [key, value] of Object.entries(update.$inc)) offer[key] += value; }
};
const Usage = {
    findOne: async () => clone(usage),
    updateOne: async (filter, update, options) => {
        assert.ok(options.session);
        if (!usage) usage = { used: 0, reserved: 0 };
        if (update.$inc) for (const [key, value] of Object.entries(update.$inc)) usage[key] += value;
    },
    findOneAndUpdate: async (filter, update, options) => { assert.ok(options.session); usageFilter = filter; if (usage.used + usage.reserved >= offer.perCustomerLimit) return null; usage.reserved++; return clone(usage); }
};
const Redemption = {
    create: async (values, options) => { assert.ok(options.session); claims.push({ ...values[0], status: 'reserved' }); },
    findOneAndUpdate: async (filter, update, options) => { assert.ok(options.session); const record = claims.find(item => item.attempt === filter.attempt && item.status === filter.status); if (!record) return null; const old = clone(record); Object.assign(record, update.$set); return old; }
};
Module._load = function(name, parent, ...rest) {
    if (parent?.filename.endsWith('/offerService.js')) {
        if (name === 'mongoose') return { connection: { transaction }, isValidObjectId: () => true };
        if (name === '../models/Offer') return Offer;
        if (name === '../models/OfferUsage') return Usage;
        if (name === '../models/OfferRedemption') return Redemption;
        if (name === '../models/Booking') return { exists: async () => false };
        if (name === '../models/Service') return {};
    }
    return originalLoad.call(this, name, parent, ...rest);
};
const { reserve, settle, evaluate } = require('../src/services/offerService');
Module._load = originalLoad;
const lines = [{ service: 's1', category: 'c1', price: 100, quantity: 1 }];
beforeEach(() => { offer = { _id: 'offer', __v: 0, code: 'SAVE10', currency: 'USD', publicationStatus: 'active', startsAt: '2020-01-01', endsAt: '2099-01-01', used: 0, reserved: 0, totalLimit: 1, perCustomerLimit: 1, discountType: 'percentage', discountValue: 10, maximumDiscount: null, minimumOrderValue: 0, applicability: 'all', eligibility: 'all' }; usage = null; claims = []; updates = []; unavailable = false; queue = Promise.resolve(); });
test('reserves both quotas atomically and returns a server-priced snapshot', async () => {
    const snapshot = await reserve('SAVE10', 'user', lines, 'attempt', 'USD');
    assert.deepEqual(snapshot, { offer: 'offer', code: 'SAVE10', discount: 10, subtotal: 100 });
    assert.equal(offer.used, 0); assert.equal(offer.reserved, 1); assert.equal(usage.reserved, 1);
    assert.ok(globalFilter.$expr); assert.ok(usageFilter.$expr); assert.equal(claims.length, 1);
});
test('concurrent claims for the last slot permit only one reservation', async () => {
    const results = await Promise.allSettled([reserve('SAVE10', 'user1', lines, 'one', 'USD'), reserve('SAVE10', 'user2', lines, 'two', 'USD')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(offer.reserved, 1); assert.equal(claims.length, 1);
});
test('successful payment settles once even when verification is retried', async () => {
    await reserve('SAVE10', 'user', lines, 'attempt', 'USD');
    await settle('attempt', 'booking'); await settle('attempt', 'booking');
    assert.equal(offer.used, 1); assert.equal(offer.reserved, 0); assert.equal(usage.used, 1); assert.equal(usage.reserved, 0); assert.equal(claims[0].booking, 'booking');
});
test('failed payment releases the reservation without counting a redemption', async () => {
    await reserve('SAVE10', 'user', lines, 'attempt', 'USD');
    await settle('attempt'); await settle('attempt');
    assert.equal(offer.used, 0); assert.equal(offer.reserved, 0); assert.equal(usage.reserved, 0); assert.equal(claims[0].status, 'released');
});
test('rejects exhausted customer quota, currency mismatch and stale availability', async () => {
    usage = { used: 1, reserved: 0 };
    await assert.rejects(evaluate('SAVE10', 'user', lines, 'USD'), /usage limit/);
    usage = null;
    await assert.rejects(evaluate('SAVE10', 'user', lines, 'INR'), /USD orders/);
    unavailable = true;
    await assert.rejects(reserve('SAVE10', 'user', lines, 'attempt', 'USD'), /availability changed/);
    assert.equal(offer.reserved, 0); assert.equal(claims.length, 0);
});
