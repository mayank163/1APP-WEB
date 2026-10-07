const mongoose = require('mongoose');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');

// Accept current participant payloads and legacy technician chat clients.
const conversationFrom = payload => {
    if (typeof payload === 'string') return { participantType: 'technician', participantId: payload };
    if (!payload || typeof payload !== 'object') return {};
    return {
        participantType: payload.participantType || 'technician',
        participantId: payload.participantId || payload.technicianId
    };
};
const roomFor = ({ participantType, participantId }) => `chat:${participantType}:${participantId}`;

const registerChatHandlers = (io, socket) => {
    // Keep customers subscribed even when their chat panel is closed.
    const ownConversation = ['user', 'technician'].includes(socket.userRole)
        ? { participantType: socket.userRole, participantId: String(socket.user._id) } : null;
    if (ownConversation) socket.join(roomFor(ownConversation));
    const canAccess = conversation => {
        const { participantType, participantId } = conversation;
        return ['user', 'technician'].includes(participantType) && mongoose.isObjectIdOrHexString(participantId) &&
            (socket.userRole === 'admin' ||
                (socket.userRole === participantType && String(socket.user._id) === String(participantId)));
    };
    const metadata = conversation => ({
        ...conversation,
        ...(conversation.participantType === 'technician' ? { technicianId: conversation.participantId } : {})
    });
    socket.on('chat:join', payload => {
        const conversation = conversationFrom(payload);
        if (canAccess(conversation)) socket.join(roomFor(conversation));
    });
    socket.on('chat:leave', payload => {
        const conversation = conversationFrom(payload);
        if (canAccess(conversation) && (!ownConversation || roomFor(conversation) !== roomFor(ownConversation))) {
            socket.leave(roomFor(conversation));
        }
    });
    socket.on('chat:typing', payload => {
        const conversation = conversationFrom(payload);
        if (!canAccess(conversation)) return;
        socket.to(roomFor(conversation)).emit('chat:typing', {
            ...metadata(conversation), userId: socket.user._id,
            senderRole: socket.userRole, isTyping: Boolean(payload?.isTyping)
        });
    });
    socket.on('chat:send', async (payload, acknowledge) => {
        try {
            const conversation = conversationFrom(payload);
            const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
            if (!canAccess(conversation)) throw new Error('You cannot access this conversation.');
            if (!text) throw new Error('Text messages cannot be empty.');
            if (text.length > 4000) throw new Error('Text messages must be 4000 characters or fewer.');
            const participant = await User.findOne({ _id: conversation.participantId, role: conversation.participantType });
            if (!participant) throw new Error('You cannot access this conversation.');
            const message = await ChatMessage.create({
                ...metadata(conversation), senderId: socket.user._id,
                senderRole: socket.userRole,
                receiverId: socket.userRole === 'admin' ? participant._id : null,
                messageType: 'text', text
            });
            io.to(roomFor(conversation)).emit('chat:message', { message });
            if (typeof acknowledge === 'function') acknowledge({ success: true, message });
        } catch (error) {
            if (typeof acknowledge === 'function') acknowledge({ success: false, message: error.message });
        }
    });
};
module.exports = { registerChatHandlers };
