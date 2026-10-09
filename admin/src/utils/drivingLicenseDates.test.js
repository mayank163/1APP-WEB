import { isDrivingLicenseExpired, formatLicenseDate } from './drivingLicenseDates';

test('licence expires only after the expiry calendar date', () => {
  const expiry = '2026-10-09T00:00:00.000Z';
  expect(isDrivingLicenseExpired(expiry, new Date(2026, 9, 8, 23, 59))).toBe(false);
  expect(isDrivingLicenseExpired(expiry, new Date(2026, 9, 9, 23, 59))).toBe(false);
  expect(isDrivingLicenseExpired(expiry, new Date(2026, 9, 10))).toBe(true);
});

test('missing or invalid dates are not marked expired', () => {
  for (const value of [null, undefined, '', 'invalid', '2026-02-30']) {
    expect(isDrivingLicenseExpired(value)).toBe(false);
    expect(formatLicenseDate(value)).toBe('Not provided');
  }
  expect(formatLicenseDate('2026-10-09T00:00:00.000Z')).toBe('09 Oct 2026');
});
