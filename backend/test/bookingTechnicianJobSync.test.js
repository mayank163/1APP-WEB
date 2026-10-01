const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const serviceSource = fs.readFileSync(path.join(__dirname, '../src/services/bookingTechnicianJobSync.js'), 'utf8');

const loadService = ({ status = 'Confirmed', technician = { name: '', phone: '' } } = {}) => {
    const calls = { saves: 0, emails: [], createdJobs: [] };
    const booking = {
        _id: 'booking-1',
        status,
        services: [{ service: { name: 'HVAC Repair' } }],
        address: { addressLine: '12 Main St', city: 'Pune', state: 'MH', zipcode: '411001' },
        serviceDate: new Date('2026-10-02T10:00:00.000Z'),
        totalAmount: 125,
        assignedTechnician: { ...technician },
        async save() { calls.saves += 1; },
    };
    const dependencies = {
        '../models/Booking': {
            findById() {
                let shouldPopulate = false;
                const query = {
                    populate() { shouldPopulate = true; return query; },
                    then(resolve, reject) {
                        const value = shouldPopulate ? { ...booking, user: { email: 'client@example.com' }, services: [] } : booking;
                        return Promise.resolve(value).then(resolve, reject);
                    },
                };
                return query;
            },
        },
        '../models/TechnicianJob': {
            async findOne() { return null; },
            async create(job) { calls.createdJobs.push(job); return job; },
        },
        '../models/User': {
            find() { return { select: async () => [] }; },
        },
        './notificationService': async () => {},
        '../utils/socketInstance': { getIO: () => ({ emit() {} }) },
        '../utils/emailService': {
            sendBookingStatusUpdated: async value => calls.emails.push(value),
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(serviceSource, {
        module,
        require(name) {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
            return dependencies[name];
        },
        console: { error() {} },
    }, { filename: 'bookingTechnicianJobSync.js' });
    return {
        sync: module.exports.syncBookingFromTechnicianJob,
        ensure: module.exports.ensureTechnicianJobForBooking,
        bookingStatusByJobStatus: module.exports.bookingStatusByJobStatus,
        calls,
        booking,
    };
};

test('maps technician workflow states to valid customer booking states', () => {
    const { bookingStatusByJobStatus } = loadService();
    assert.equal(bookingStatusByJobStatus.assigned, 'Assigned');
    assert.equal(bookingStatusByJobStatus.ontheway, 'On the Way');
    assert.equal(bookingStatusByJobStatus.inprogress, 'In Progress');
    assert.equal(bookingStatusByJobStatus.checkout, 'Checkout');
    assert.equal(bookingStatusByJobStatus.completed, 'Completed');
});

test('creates a linked open work order from a confirmed booking', async () => {
    const { ensure, calls, booking } = loadService();

    const job = await ensure(booking, 'admin-1');

    assert.equal(job.sourceBooking, booking._id);
    assert.equal(job.status, 'open');
    assert.equal(job.title, 'HVAC Repair');
    assert.equal(job.location, '12 Main St, Pune, MH, 411001');
    assert.equal(job.scheduledDate, booking.serviceDate);
    assert.equal(job.pay.fixedAmount, booking.totalAmount);
    assert.equal(calls.createdJobs.length, 1);
});

test('copies technician assignment, updates booking status, and emails the customer', async () => {
    const { sync, calls, booking } = loadService();

    await sync({
        sourceBooking: 'booking-1',
        status: 'assigned',
        assignedTechnician: { name: 'Rohan Sharma', phone: '555-0100' },
    });

    assert.equal(booking.status, 'Assigned');
    assert.equal(JSON.stringify(booking.assignedTechnician), JSON.stringify({ name: 'Rohan Sharma', phone: '555-0100' }));
    assert.equal(calls.saves, 1);
    assert.equal(calls.emails.length, 1);
});

test('does not save or email again when booking already matches the job', async () => {
    const { sync, calls } = loadService({
        status: 'On the Way',
        technician: { name: 'Rohan Sharma', phone: '555-0100' },
    });

    await sync({
        sourceBooking: 'booking-1',
        status: 'ontheway',
        assignedTechnician: { name: 'Rohan Sharma', phone: '555-0100' },
    });

    assert.equal(calls.saves, 0);
    assert.equal(calls.emails.length, 0);
});

test('emails the customer when the assigned technician is replaced without a status change', async () => {
    const { sync, calls, booking } = loadService({
        status: 'Assigned',
        technician: { name: 'Previous Technician', phone: '555-0100' },
    });

    await sync({
        sourceBooking: 'booking-1',
        status: 'assigned',
        assignedTechnician: { name: 'Replacement Technician', phone: '555-0101' },
    });

    assert.equal(booking.status, 'Assigned');
    assert.equal(booking.assignedTechnician.name, 'Replacement Technician');
    assert.equal(calls.saves, 1);
    assert.equal(calls.emails.length, 1);
});