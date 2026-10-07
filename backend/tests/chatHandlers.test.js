const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const userId = '6ac01794fdc24f879a953c1a';
const otherId = '6ac01794fdc24f879a953c1b';
const setup = (role = 'user', exists = true) => {
    const handlers = {}, joined = [], left = [], broadcasts = [], typing = [], saved = [];
    const socket = {
        userRole: role, user: { _id: role === 'admin' ? otherId : userId },
        on(name, handler) { handlers[name] = handler; },
        join(room) { joined.push(room); }, leave(room) { left.push(room); },
        to(room) { return { emit(event, payload) { typing.push({ room, event, payload }); } }; }
    };
    const io = { to(room) { return { emit(event, payload) { broadcasts.push({ room, event, payload }); } }; } };
    const context = { module: { exports: {} }, require(name) {
        if (name === 'mongoose') return { isObjectIdOrHexString: value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) };
        if (name === '../models/User') return { async findOne(query) { return exists ? { _id: query._id, role: query.role } : null; } };
        if (name === '../models/ChatMessage') return { async create(data) { saved.push(data); return { ...data, _id: 'message' }; } };
        throw new Error(name);
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/socket/chatHandlers'), 'utf8'), context);
    context.module.exports.registerChatHandlers(io, socket);
    const send = async payload => { let result; await handlers['chat:send'](payload, value => { result = value; }); return result; };
    return { handlers, joined, left, broadcasts, typing, saved, send };
};
test('customer can join, type, send and leave their support conversation', async () => {
    const chat = setup();
    const payload = { participantType: 'user', participantId: userId };
    chat.handlers['chat:join'](payload);
    chat.handlers['chat:typing']({ ...payload, isTyping: true });
    const result = await chat.send({ ...payload, text: ' hy ' });
    chat.handlers['chat:leave'](payload);
    assert.equal(result.success, true);
    assert.equal(chat.saved[0].text, 'hy');
    assert.equal(chat.saved[0].participantType, 'user');
    assert.equal(chat.saved[0].participantId, userId);
    assert.equal(chat.saved[0].technicianId, undefined);
    assert.equal(chat.saved[0].senderRole, 'user');
    assert.equal(chat.joined[0], `chat:user:${userId}`);
    assert.equal(chat.left.length, 0);
    assert.equal(chat.broadcasts[0].room, chat.joined[0]);
    assert.equal(chat.typing[0].payload.participantType, 'user');
});
test('admin can reply to customer in the same support room', async () => {
    const chat = setup('admin');
    const result = await chat.send({ participantType: 'user', participantId: userId, text: 'Hello' });
    assert.equal(result.success, true);
    assert.equal(chat.saved[0].receiverId, userId);
    assert.equal(chat.saved[0].senderRole, 'admin');
    assert.equal(chat.broadcasts[0].room, `chat:user:${userId}`);
});
test('legacy technician payloads still join and send with technicianId', async () => {
    const chat = setup('technician');
    chat.handlers['chat:join'](userId);
    assert.equal((await chat.send({ technicianId: userId, text: 'Hello' })).success, true);
    assert.equal(chat.saved[0].technicianId, userId);
    assert.equal(chat.saved[0].participantId, userId);
    assert.equal(chat.broadcasts[0].room, `chat:technician:${userId}`);
});
test('other users, wrong participant types and malformed payloads are rejected', async () => {
    const chat = setup();
    for (const payload of [null, { participantType: 'user', participantId: otherId }, { participantType: 'technician', participantId: userId }, { participantType: 'admin', participantId: userId }, { participantType: 'user', participantId: 'invalid' }]) {
        chat.handlers['chat:join'](payload);
        chat.handlers['chat:typing'](payload);
        assert.equal((await chat.send(payload)).success, false);
    }
    assert.equal(chat.joined.length, 1);
    assert.equal(chat.typing.length, 0);
    assert.equal(chat.saved.length, 0);
});
test('empty, non-string and oversized messages are rejected without persistence', async () => {
    const chat = setup();
    for (const text of ['', '  ', {}, 'x'.repeat(4001)]) {
        assert.equal((await chat.send({ participantType: 'user', participantId: userId, text })).success, false);
    }
    assert.equal(chat.saved.length, 0);
});
test('admin cannot send to a missing participant', async () => {
    const chat = setup('admin', false);
    assert.equal((await chat.send({ participantType: 'user', participantId: userId, text: 'Hello' })).success, false);
    assert.equal(chat.saved.length, 0);
});
