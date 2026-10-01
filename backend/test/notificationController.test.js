const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const controllerSource = fs.readFileSync(path.join(__dirname, '../src/controllers/notificationController.js'), 'utf8');

function setup({
    validId = true,
    notification = { _id: 'notification-1', isRead: true },
    notifications = [{ _id: 'notification-2', isRead: false }],
    total = 21,
    unreadCount = 3,
} = {}) {
    const calls = [];
    const module = { exports: {} };
    vm.runInNewContext(controllerSource, {
        module,
        exports: module.exports,
        require(name) {
            if (name === '../models/Notification') {
                return {
                    async findOneAndUpdate(...args) {
                        calls.push(JSON.parse(JSON.stringify(args)));
                        return notification;
                    },
                    async updateMany(...args) {
                        calls.push(JSON.parse(JSON.stringify(args)));
                        return { modifiedCount: 3 };
                    },
                    find(query) {
                        calls.push(['find', JSON.parse(JSON.stringify(query))]);
                        return {
                            sort(value) { calls.push(['sort', value]); return this; },
                            skip(value) { calls.push(['skip', value]); return this; },
                            limit(value) { calls.push(['limit', value]); return this; },
                            async lean() { return notifications; },
                        };
                    },
                    async countDocuments(query) {
                        calls.push(['countDocuments', JSON.parse(JSON.stringify(query))]);
                        return query.isRead === false ? unreadCount : total;
                    },
                };
            }
            if (name === 'mongoose') return { Types: { ObjectId: { isValid: () => validId } } };
            if (name === '../utils/pagination') return {
                getPagination(query) {
                    const page = Number.parseInt(query.page, 10) || 1;
                    const limit = Number.parseInt(query.limit, 10) || 10;
                    return { page, limit, skip: (page - 1) * limit };
                },
                getPaginationMeta({ page, limit, total: count }) {
                    return { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) };
                },
            };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    }, { filename: 'notificationController.js' });
    return { list: module.exports.list, markRead: module.exports.markRead, markAllRead: module.exports.markAllRead, calls };
}

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('returns one page of notifications with global unread and pagination counts', async () => {
    const { list, calls } = setup();
    const res = response();

    await list({
        query: { page: '2', limit: '10' },
        user: { _id: 'recipient-1', role: 'user' },
    }, res, assert.fail);

    assert.deepEqual(calls, [
        ['find', { recipient: 'recipient-1', recipientModel: 'User' }],
        ['sort', '-createdAt'],
        ['skip', 10],
        ['limit', 10],
        ['countDocuments', { recipient: 'recipient-1', recipientModel: 'User' }],
        ['countDocuments', { recipient: 'recipient-1', recipientModel: 'User', isRead: false }],
    ]);
    assert.deepEqual(res.body.data.notifications, [{ _id: 'notification-2', isRead: false }]);
    assert.equal(res.body.data.unreadCount, 3);
    assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
});

test('marks only the requested notification belonging to the current recipient', async () => {
    const { markRead, calls } = setup();
    const res = response();

    await markRead({
        params: { notificationId: 'notification-1' },
        user: { _id: 'recipient-1', role: 'admin' },
    }, res, assert.fail);

    assert.deepEqual(calls, [[
        { _id: 'notification-1', recipient: 'recipient-1', recipientModel: 'Admin' },
        { $set: { isRead: true } },
        { new: true },
    ]]);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.notification.isRead, true);
});

test('rejects invalid IDs and returns not found for notifications outside the recipient scope', async () => {
    const invalid = setup({ validId: false });
    const invalidRes = response();
    await invalid.markRead({ params: { notificationId: 'invalid' }, user: { _id: 'recipient-1' } }, invalidRes, assert.fail);
    assert.equal(invalidRes.statusCode, 400);
    assert.equal(invalid.calls.length, 0);

    const missing = setup({ notification: null });
    const missingRes = response();
    await missing.markRead({ params: { notificationId: 'notification-1' }, user: { _id: 'recipient-1' } }, missingRes, assert.fail);
    assert.equal(missingRes.statusCode, 404);
    assert.deepEqual(missing.calls[0][0], {
        _id: 'notification-1',
        recipient: 'recipient-1',
        recipientModel: 'User',
    });
});

test('marks all unread notifications belonging to the current recipient', async () => {
    const { markAllRead, calls } = setup();
    const res = response();

    await markAllRead({ user: { _id: 'recipient-1', role: 'user' } }, res, assert.fail);

    assert.deepEqual(calls, [[
        { recipient: 'recipient-1', recipientModel: 'User', isRead: false },
        { $set: { isRead: true } },
    ]]);
    assert.equal(res.body.data.modifiedCount, 3);
});