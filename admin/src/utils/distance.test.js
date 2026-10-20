import { kilometersToMiles, milesToKilometers, formatMiles } from './distance';
test('converts distances to miles and back', () => {
  expect(kilometersToMiles(1.609344)).toBeCloseTo(1);
  expect(milesToKilometers(25)).toBeCloseTo(40.2336);
  expect(milesToKilometers(kilometersToMiles(15))).toBeCloseTo(15);
  expect(formatMiles(30)).toBe('18.6 miles');
  expect(formatMiles(0)).toBe('0.0 miles');
});
