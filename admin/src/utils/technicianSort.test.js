import { sortTechnicians } from './technicianSort';
const candidates = [
  { _id: 'a', distanceKm: null, providerSuccessScore: 50, completedJobCount: 8 },
  { _id: 'b', distanceKm: 10, providerSuccessScore: 90, completedJobCount: 2 },
  { _id: 'c', distanceKm: 0, providerSuccessScore: null, completedJobCount: 5 },
];
test.each([
  ['best_match', ['a', 'b', 'c']],
  ['distance', ['c', 'b', 'a']],
  ['success', ['b', 'a', 'c']],
  ['completed', ['a', 'c', 'b']],
])('%s sorts without changing the original ranking', (sort, expected) => {
  expect(sortTechnicians(candidates, sort).map(t => t._id)).toEqual(expected);
  expect(candidates.map(t => t._id)).toEqual(['a', 'b', 'c']);
});
test('ties keep best-match order and missing scores sort last', () => {
  expect(sortTechnicians([{ _id: 'a', distanceKm: 1 }, { _id: 'b', distanceKm: 1 }, { _id: 'c' }], 'distance').map(t => t._id)).toEqual(['a', 'b', 'c']);
});
