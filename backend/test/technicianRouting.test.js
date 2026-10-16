const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchesWorkType, rankTechnicians } = require('../src/services/technicianRouting');
const fiber = { _id: 'fiber', name: 'Fiber' };
const camera = { _id: 'camera', name: 'Camera' };
const past = (id, overrides = {}) => ({ status: 'completed', workType: fiber, assignedTechnician: { _id: id }, ...overrides });

test('ranks active matching technicians by matching job count and counts a multi-type job once', () => {
  const technicians = ['a', 'b', 'c', 'd'].map(_id => ({ _id, name: _id, accountStatus: _id === 'd' ? 'inactive' : 'active' }));
  const history = [past('a'), past('b'), past('b', { status: 'checkout', additionalWorkType: fiber }), past('c', { workType: camera }), past('d'), past('a', { status: 'cancelled' }), past('a', { status: 'assigned' }), past('a', { workType: camera })];
  assert.equal(rankTechnicians({ workType: fiber }, history, technicians).find(t => t._id === 'a').completedJobCount, 2);
  assert.deepEqual(rankTechnicians({ workType: fiber }, history, technicians).map(t => [t._id, t.matchingJobCount]), [['b', 2], ['a', 1]]);
});
test('matches additional work types and supports legacy names and categories', () => {
  assert.equal(matchesWorkType({ workType: camera, additionalWorkType: fiber }, past('a')), true);
  assert.equal(matchesWorkType({ workType: fiber }, past('a', { workType: camera, additionalWorkType: fiber })), true);
  assert.equal(matchesWorkType({ workType: fiber }, past('a', { workType: { name: ' FIBER ' } })), true);
  assert.equal(matchesWorkType({ workType: fiber }, past('a', { workType: { _id: 'different', name: 'Fiber' } })), false);
  assert.equal(matchesWorkType({ category: 'Repair' }, past('a', { category: 'repair' })), true);
  assert.deepEqual(rankTechnicians({ workType: fiber }, [], []), []);
});

test('routing metrics include cancelled outcomes and saved-address distance without exposing addresses', () => {
  const technicians = [{ _id: 'a', name: 'A', accountStatus: 'active', addresses: [{ isDefault: true, coordinates: { lat: 0, lng: 1 } }] }];
  const [candidate] = rankTechnicians({ workType: fiber, coordinates: { lat: 0, lng: 0 } }, [past('a'), past('a', { status: 'cancelled' }), past('a', { status: 'assigned' })], technicians);
  assert.equal(candidate.providerSuccessScore, 50);
  assert.ok(Math.abs(candidate.distanceKm - 111.195) < 0.01);
  assert.equal(candidate.addresses, undefined);
});

test('distance treats missing and invalid coordinates as unavailable, and accepts zero', () => {
  const { straightLineDistanceKm } = require('../src/services/technicianRouting');
  assert.equal(straightLineDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  for (const point of [undefined, { lat: null, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: NaN }]) {
    assert.equal(straightLineDistanceKm({ lat: 0, lng: 0 }, point), null);
  }
});

test('includes both technicians when older completed work has only a category', () => {
  const workType = { _id: 'av', name: 'A/V & Digital Signage' };
  const technicians = ['a', 'b'].map(_id => ({ _id, name: _id, accountStatus: 'active' }));
  const history = [past('a', { workType }), past('b', { workType: undefined, category: ' A/V & Digital Signage ' })];
  assert.deepEqual(rankTechnicians({ workType }, history, technicians).map(t => t._id), ['a', 'b']);
});

test('legacy category fallback preserves completed-work and explicit-type restrictions', () => {
  assert.equal(matchesWorkType({ workType: fiber }, past('a', { workType: undefined, category: 'Camera' })), false);
  assert.equal(matchesWorkType({ workType: fiber }, past('a', { workType: undefined, category: 'Fiber', status: 'assigned' })), false);
  assert.equal(matchesWorkType({ workType: fiber, category: 'Repair' }, past('a', { workType: camera, category: 'Repair' })), false);
  assert.equal(matchesWorkType({ category: 'Fiber' }, past('a')), true);
});

test('legacy online and offline technicians with matching completed work remain routable', () => {
  const statuses = ['active', 'online', 'offline', 'inactive', 'invited', 'suspended', 'blocked'];
  const technicians = statuses.map(accountStatus => ({ _id: accountStatus, name: accountStatus, accountStatus }));
  const history = statuses.map(id => past(id));
  assert.deepEqual(rankTechnicians({ workType: fiber }, history, technicians).map(t => t._id), ['active', 'offline', 'online']);
});
