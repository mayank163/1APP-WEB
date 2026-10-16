import { getAdminNavItems } from './adminNavigation';

const canRead = permissions => (resource, access) =>
    permissions[resource] === 'both' || permissions[resource] === access;

test('super admin lands on Dashboard', () => {
    expect(getAdminNavItems(() => true)[0].to).toBe('/');
});

test('sub-admin lands on first sidebar section regardless of permission order', () => {
    const items = getAdminNavItems(canRead({ users: 'both', technician_jobs: 'both', bookings: 'read' }));
    expect(items[0].to).toBe('/bookings');
    expect(items.some(item => item.to === '/')).toBe(false);
});

test.each([
    ['technician_jobs', '/technician-jobs'],
    ['service_types', '/service-types'],
    ['subcategories', '/subcategories'],
    ['offers', '/plans'],
    ['support', '/support'],
])('lands on an accessible section for %s', (resource, path) => {
    expect(getAdminNavItems(canRead({ [resource]: 'read' }))[0].to).toBe(path);
});

test('write-only permissions do not expose unreadable pages', () => {
    expect(getAdminNavItems(canRead({ bookings: 'write', users: 'read' }))[0].to).toBe('/users');
});

test('no permissions produces no landing section', () => {
    expect(getAdminNavItems(canRead({}))).toEqual([]);
});
