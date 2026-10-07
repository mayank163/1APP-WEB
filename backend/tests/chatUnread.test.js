const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const setup = () => {
    const queries = [], updates = [], events = [];
    class Admin {}
    const context = { module: { exports: {} }, console, require(name) {
        if (name === '../models/Admin') return Admin;
        if (name === '../models/User') return { async findOne(query) { return { _id: query._id }; } };
        if (name === '../models/ChatMessage') return {
            async countDocuments(query) { queries.push(query); return 75; },
            async updateMany(query, update) { updates.push({ query, update }); }
        };
        if (name === '../utils/socketInstance') return { getIO: () => ({ to: room => ({ emit: (event, payload) => events.push({ room, event, payload }) }) }) };
        return {};
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/chatController'), 'utf8'), context);
    const invoke = async (method, participantType = 'user', participantId = 'customer') => {
        const result = {};
        const res = { json(body) { result.body = body; }, status(value) { result.status = value; return this; }, setHeader() {} };
        await context.module.exports[method]({ user: { _id: 'customer', role: 'user' }, params: { participantType, participantId } }, res, error => { throw error; });
        return result;
    };
    return { invoke, queries, updates, events };
};
test('unread count includes only unread admin messages across entire conversation', async () => {
    const chat = setup();
    const result = await chat.invoke('getUnreadCount');
    assert.equal(result.body.data.unreadCount, 75);
    assert.equal(chat.queries[0].senderRole, 'admin');
    assert.equal(chat.queries[0]['readBy.userId'].$ne, 'customer');
    assert.equal(chat.queries[0].participantId, 'customer');
    assert.equal(chat.queries[0].participantType, 'user');
});
test('opening conversation marks all incoming messages read and broadcasts read event', async () => {
    const chat = setup();
    await chat.invoke('markRead');
    assert.equal(chat.updates[0].query.senderId.$ne, 'customer');
    assert.equal(chat.updates[0].update.$push.readBy.userId, 'customer');
    assert.equal(chat.events[0].room, 'chat:user:customer');
    assert.equal(chat.events[0].event, 'chat:read');
    assert.equal(chat.events[0].payload.userId, 'customer');
});
test('unread count rejects another customer conversation', async () => {
    const chat = setup();
    assert.equal((await chat.invoke('getUnreadCount', 'user', 'other')).status, 403);
    assert.equal(chat.queries.length, 0);
});
