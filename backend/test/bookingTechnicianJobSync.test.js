const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const serviceSource = fs.readFileSync(path.join(__dirname, '../src/services/bookingTechnicianJobSync.js'), 'utf8');

const loadService = ({
    status = 'Confirmed',
    technician = { name: '', phone: '' },
    template = {
        title: 'Work order',
        description: 'Complete the service using the work order checklist.',
        requirements: ['Bring standard tools'],
        preferredSkills: ['HVAC'],
        tasks: [{ title: 'Inspect unit', group: 'Inspection', requiresImage: true }],
        pay: { type: 'fixed', fixedAmount: 80 },
    },
} = {}) => {
    const calls = { saves: 0, emails: [], createdJobs: [], adminEvents: [] };
    const booking = {
        _id: 'booking-1',
        status,
        services: [{
            service: { name: 'HVAC Repair' },
            selectedAddons: [{ name: 'Filter replacement' }],
        }],
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
        '../models/TechnicianJobTemplate': {
            findOne() { return { sort: async () => template }; },
        },
        '../utils/socketInstance': {
            getIO: () => ({
                to(room) {
                    return { emit: (event, payload) => calls.adminEvents.push({ room, event, payload }) };
                },
            }),
        },
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
        console: { error() {}, warn() {} },
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
    assert.equal(bookingStatusByJobStatus.checkout, 'Completed');
    assert.equal(bookingStatusByJobStatus.completed, 'Completed');
});

test('creates a linked draft work order from the workorder template', async () => {
    const { ensure, calls, booking } = loadService();

    const job = await ensure(booking, 'admin-1');

    assert.equal(job.sourceBooking, booking._id);
    assert.equal(job.status, 'draft');
    assert.equal(job.title, 'HVAC Repair - Add-ons: Filter replacement');
    assert.equal(job.location, '12 Main St, Pune, MH, 411001');
    assert.equal(job.scheduledDate, booking.serviceDate);
    assert.equal(job.pay.fixedAmount, 80);
    assert.equal(
        job.description,
        `Complete the service using the work order checklist.\n\nWork order created from booking ${booking._id}.`,
    );
    assert.equal(job.requirements[0], 'Bring standard tools');
    assert.equal(job.tasks[0].title, 'Inspect unit');
    assert.equal(job.tasks[0].isDone, false);
    assert.equal(calls.createdJobs.length, 1);
    assert.deepEqual(calls.adminEvents.map(({ room, event }) => ({ room, event })), [
        { room: 'admin', event: 'job:created' },
    ]);
});

test('creates a booking-default draft when the workorder template is missing', async () => {
    const { ensure, booking } = loadService({ template: null });

    const job = await ensure(booking, 'admin-1');

    assert.equal(job.status, 'draft');
    assert.equal(job.title, 'HVAC Repair - Add-ons: Filter replacement');
    assert.equal(job.description, `Work order created from booking ${booking._id}.`);
    assert.equal(job.pay.fixedAmount, booking.totalAmount);
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

for (const status of ['In Progress', 'Checkout']) {
    test(`checkout work order completes a booking previously in ${status}`, async () => {
        const { sync, calls, booking } = loadService({
            status,
            technician: { name: 'Rohan Sharma', phone: '555-0100' },
        });

        await sync({ sourceBooking: 'booking-1', status: 'checkout' });

        assert.equal(booking.status, 'Completed');
        assert.equal(booking.assignedTechnician.name, 'Rohan Sharma');
        assert.equal(calls.saves, 1);
        assert.equal(calls.emails.length, 1);

        await sync({ sourceBooking: 'booking-1', status: 'completed' });
        assert.equal(calls.saves, 1);
        assert.equal(calls.emails.length, 1);
    });
}
