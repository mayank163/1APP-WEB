const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const serviceSource = fs.readFileSync(path.join(__dirname, '../src/services/notificationService.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function setup({ records = [], deliver, configured = true, cleanupError } = {}) {
    const calls = { inserted: [], socket: [], batches: [], removed: [], logs: [], lookups: [] };
    const makeModel = model => ({
        find(query) {
            calls.lookups.push({ model, query: plain(query) });
            return { select: () => ({ lean: async () => records }) };
        },
        async updateMany(query, update) {
            if (cleanupError) throw cleanupError;
            calls.removed.push({ model, query: plain(query), update: plain(update) });
        },
    });
    const dependencies = {
        '../config/firebase': { getApps: () => configured ? [{}] : [] },
        'firebase-admin/messaging': {
            getMessaging: () => ({
                async sendEachForMulticast(payload) {
                    calls.batches.push(plain(payload));
                    if (deliver) return deliver(payload, calls.batches.length);
                    return {
                        successCount: payload.tokens.length,
                        failureCount: 0,
                        responses: payload.tokens.map(() => ({ success: true })),
                    };
                },
            }),
        },
        '../models/Notification': {
            async insertMany(notifications) {
                calls.inserted.push(...plain(notifications));
                return notifications.map((notification, index) => ({ ...notification, _id: `notification-${index}` }));
            },
        },
        '../utils/socketInstance': {
            getIO: () => ({
                to: room => ({ emit: (event, payload) => calls.socket.push({ room, event, payload: plain(payload) }) }),
            }),
        },
        '../models/User': makeModel('User'),
        '../models/Admin': makeModel('Admin'),
    };
    const module = { exports: {} };
    vm.runInNewContext(serviceSource, {
        module,
        require(name) {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
            return dependencies[name];
        },
        console: Object.fromEntries(['log', 'warn', 'error'].map(level => [level, (...args) => calls.logs.push({ level, args: plain(args) })])),
    }, { filename: 'notificationService.js' });
    return { send: module.exports, calls };
}

const payload = {
    recipients: [{ _id: 'technician-1', constructor: { modelName: 'User' } }],
    type: 'job_created',
    title: 'New job',
    message: 'A job is available',
    data: { jobId: 'job-1', amount: 125 },
};

test('deduplicates tokens and batches large broadcasts while preserving in-app delivery and payloads', async () => {
    const tokens = Array.from({ length: 501 }, (_, index) => `device-${index}`);
    const { send, calls } = setup({ records: [
        { _id: 'technician-1', fcmTokens: [...tokens, 'device-0', '   ', null] },
        { _id: 'technician-2', fcmTokens: [' device-500 '] },
    ] });

    await send(payload);

    assert.equal(calls.inserted.length, 1);
    assert.equal(calls.socket[0].room, 'technician:technician-1');
    assert.equal(calls.socket[0].event, 'notification:new');
    assert.deepEqual(calls.batches.map(batch => batch.tokens.length), [500, 1]);
    assert.deepEqual(calls.batches.flatMap(batch => batch.tokens), tokens);
    assert.deepEqual(calls.batches[0].notification, { title: 'New job', body: 'A job is available' });
    assert.deepEqual(calls.batches[0].data, { type: 'job_created', jobId: 'job-1', amount: '125', target: 'technician' });
    assert.equal(calls.removed.length, 0);
});

test('prunes only definitively invalid tokens, logs failures, and redacts tokens from error messages', async () => {
    const errors = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument',
        'messaging/mismatched-credential',
        'messaging/server-unavailable',
    ];
    const tokens = errors.map((_, index) => `private-device-${index}`);
    const { send, calls } = setup({
        records: [{ _id: 'technician-1', fcmTokens: tokens }],
        deliver: async () => ({
            successCount: 0,
            failureCount: errors.length,
            responses: errors.map((code, index) => ({ success: false, error: { code, message: `Failure for ${tokens[index]}` } })),
        }),
    });

    await send(payload);

    assert.deepEqual(calls.removed, [{
        model: 'User',
        query: { _id: { $in: ['technician-1'] } },
        update: { $pull: { fcmTokens: { $in: tokens.slice(0, 2) } } },
    }]);
    const failures = calls.logs.filter(log => log.level === 'warn');
    assert.equal(failures.length, errors.length);
    assert.deepEqual(failures.map(log => log.args[1].code), errors);
    assert.ok(failures.every(log => log.args[1].message.includes('[redacted token]')));
    assert.ok(tokens.every(token => !JSON.stringify(calls.logs).includes(token)));
});

test('continues other batches after a transport failure and does not prune uncertain tokens', async () => {
    const tokens = Array.from({ length: 501 }, (_, index) => `transport-device-${index}`);
    const { send, calls } = setup({
        records: [{ _id: 'technician-1', fcmTokens: tokens }],
        deliver: async (batch, batchNumber) => {
            if (batchNumber === 1) throw Object.assign(new Error(`Unavailable for ${tokens[0]}`), { code: 'messaging/server-unavailable' });
            return { successCount: batch.tokens.length, failureCount: 0, responses: batch.tokens.map(() => ({ success: true })) };
        },
    });

    await send(payload);

    assert.equal(calls.batches.length, 2);
    assert.equal(calls.removed.length, 0);
    assert.ok(calls.logs.some(log => log.args[0].includes('success=1 failed=500')));
    assert.ok(!JSON.stringify(calls.logs).includes(tokens[0]));
});

test('uses the admin model and target for admin notifications', async () => {
    const { send, calls } = setup({ records: [{ _id: 'admin-1', fcmTokens: ['admin-device'] }] });

    await send({ ...payload, recipients: [{ _id: 'admin-1', modelName: 'Admin' }] });

    assert.equal(calls.lookups[0].model, 'Admin');
    assert.equal(calls.inserted[0].recipientModel, 'Admin');
    assert.equal(calls.socket[0].room, 'admin');
    assert.equal(calls.batches[0].data.target, 'admin');
});

test('emits one realtime notification for the shared admin room', async () => {
    const recipients = [
        { _id: 'admin-1', constructor: { modelName: 'Admin' } },
        { _id: 'admin-2', constructor: { modelName: 'Admin' } },
        { _id: 'admin-3', constructor: { modelName: 'Admin' } },
    ];
    const { send, calls } = setup({
        records: recipients.map(({ _id }) => ({ _id, fcmTokens: [] })),
    });

    await send({ ...payload, recipients });

    assert.equal(calls.inserted.length, 3);
    assert.equal(calls.socket.length, 1);
    assert.equal(calls.socket[0].room, 'admin');
});

test('keeps MongoDB and socket notifications when there are no device tokens or Firebase is not configured', async () => {
    for (const options of [{ records: [] }, { configured: false, records: [{ _id: 'technician-1', fcmTokens: ['device'] }] }]) {
        const { send, calls } = setup(options);
        await send(payload);
        assert.equal(calls.inserted.length, 1);
        assert.equal(calls.socket.length, 1);
        assert.equal(calls.batches.length, 0);
    }
});

test('reports cleanup failure without losing delivery results or exposing the token', async () => {
    const { send, calls } = setup({
        records: [{ _id: 'technician-1', fcmTokens: ['private-device'] }],
        cleanupError: new Error('Cleanup failed for private-device'),
        deliver: async () => ({ successCount: 0, failureCount: 1, responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }] }),
    });

    await send(payload);

    assert.ok(calls.logs.some(log => log.args[0].includes('Invalid token cleanup failed')));
    assert.ok(calls.logs.some(log => log.args[0].includes('success=0 failed=1')));
    assert.ok(!JSON.stringify(calls.logs).includes('private-device'));
});
