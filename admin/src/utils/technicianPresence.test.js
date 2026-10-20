import { presenceOnline, lastActiveText } from './technicianPresence';
const now = Date.parse('2026-10-19T09:20:00Z');
const technician = { accountStatus: 'active', isOnline: true, lastActiveAt: new Date(now - 30000).toISOString() };
test('online status requires active account and a fresh last contact', () => {
  expect(presenceOnline(technician, now)).toBe(true);
  expect(presenceOnline({ ...technician, accountStatus: 'suspended' }, now)).toBe(false);
  expect(presenceOnline({ ...technician, lastActiveAt: null }, now)).toBe(false);
  expect(presenceOnline(technician, now + 60000)).toBe(false);
});
test('last activity handles never-seen, online and relative offline times', () => {
  expect(lastActiveText({ ...technician, lastActiveAt: null }, now)).toBe('No activity recorded');
  expect(lastActiveText(technician, now)).toBe('Active now');
  expect(lastActiveText({ ...technician, isOnline: false }, now)).toBe('Last active just now');
  expect(lastActiveText(technician, now + 270000)).toBe('Last active 5 minutes ago');
});
