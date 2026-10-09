const { test } = require('node:test');
const assert = require('node:assert/strict');
const { effectiveStatus, discountFor, parseOffer } = require('../src/utils/offerRules');
const base = () => ({ code: 'SAVE30', title: 'Save 30', description: 'Installation offer', image: '', icon: 'tag', currency: 'USD', discountType: 'percentage', discountValue: 30, maximumDiscount: 500, applicability: 'all', services: [], categories: [], customers: [], minimumOrderValue: 0, eligibility: 'all', startsAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z', totalLimit: 100, perCustomerLimit: 1, publicationStatus: 'active', used: 0 });
const lines = [{ service: 'service1', category: 'cat1', price: 1000, quantity: 3 }, { service: 'service2', category: 'cat2', price: 100, quantity: 1 }];
test('derives scheduled, expired, exhausted and disabled states with exact boundaries', () => {
    const offer = base(); const now = new Date('2026-10-10T00:00Z');
    assert.equal(effectiveStatus(offer, now), 'active');
    assert.equal(effectiveStatus({ ...offer, startsAt: '2026-10-11' }, now), 'scheduled');
    assert.equal(effectiveStatus({ ...offer, endsAt: now }, now), 'expired');
    assert.equal(effectiveStatus({ ...offer, used: 100 }, now), 'exhausted');
    assert.equal(effectiveStatus({ ...offer, publicationStatus: 'inactive' }, now), 'inactive');
    assert.equal(effectiveStatus({ ...offer, publicationStatus: 'draft' }, now), 'draft');
});
test('caps percentage discounts and applies only to eligible service lines', () => {
    assert.deepEqual(discountFor(base(), lines, 'user'), { subtotal: 3100, discount: 500, total: 2600 });
    const offer = { ...base(), applicability: 'services', services: ['service2'] };
    assert.equal(discountFor(offer, lines, 'user').discount, 30);
    assert.equal(discountFor({ ...offer, discountType: 'flat', discountValue: 300 }, lines, 'user').discount, 100);
    assert.throws(() => discountFor({ ...offer, services: ['missing'] }, lines, 'user'), /does not apply/);
});
test('enforces category, minimum order, first booking and selected customer restrictions', () => {
    assert.equal(discountFor({ ...base(), applicability: 'categories', categories: ['cat2'] }, lines, 'user').discount, 30);
    assert.throws(() => discountFor({ ...base(), minimumOrderValue: 4000 }, lines, 'user'), /Minimum order/);
    assert.throws(() => discountFor({ ...base(), eligibility: 'new' }, lines, 'user', true), /first-time/);
    assert.throws(() => discountFor({ ...base(), eligibility: 'selected', customers: ['other'] }, lines, 'user'), /not eligible/);
    assert.equal(discountFor({ ...base(), eligibility: 'selected', customers: ['user'] }, lines, 'user').discount, 500);
});
test('rounds money and never discounts above eligible subtotal', () => {
    const result = discountFor({ ...base(), discountValue: 33.33, maximumDiscount: null }, [{ service: 's', price: 10, quantity: 1 }], 'user');
    assert.deepEqual(result, { subtotal: 10, discount: 3.33, total: 6.67 });
});
test('validates published payloads and rejects forged usage counters', () => {
    const parsed = parseOffer({ ...base(), used: 999, reserved: 999, createdBy: 'fake' });
    assert.equal(parsed.used, undefined); assert.equal(parsed.reserved, undefined); assert.equal(parsed.createdBy, undefined);
    for (const invalid of [{ discountValue: 101 }, { totalLimit: 1.5 }, { perCustomerLimit: 0 }, { startsAt: 'nonsense' }, { endsAt: '2019-01-01' }, { code: 'bad_code' }, { maximumDiscount: -1 }, { services: ['$ne'] }, { title: '' }, { description: 'a'.repeat(121) }, { currency: 'FAKE' }, { image: 'https://external/image' }]) assert.throws(() => parseOffer({ ...base(), ...invalid }));
});
test('draft allows incomplete fields and normalizes optional limits', () => {
    const parsed = parseOffer({ ...base(), code: 'draft-1', title: '', description: '', discountValue: 0, publicationStatus: 'draft', startsAt: null, endsAt: null, totalLimit: '', maximumDiscount: '' });
    assert.equal(parsed.code, 'DRAFT-1'); assert.equal(parsed.totalLimit, null); assert.equal(parsed.maximumDiscount, null);
});
