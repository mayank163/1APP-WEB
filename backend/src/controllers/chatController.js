const User = require('../models/User');
const Admin = require('../models/Admin');
const ChatMessage = require('../models/ChatMessage');
const { uploadFile } = require('../utils/s3Upload');
const { getIO } = require('../utils/socketInstance');
const sharp = require('sharp');
const convertHeic = require('heic-convert');

const mediaUrl = (key) =>
    `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

const isHeicImage = (file) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    const fileName = String(file.originalname || '').toLowerCase();
    return mimeType === 'image/heic' || mimeType === 'image/heif' ||
        fileName.endsWith('.heic') || fileName.endsWith('.heif');
};

const findParticipant = async (req, participantType, participantId) => {
    const isAdmin = req.user instanceof Admin || req.user.constructor?.modelName === 'Admin';
    if (!isAdmin && !['technician', 'user'].includes(req.user.role)) return null;
    if (!isAdmin && String(req.user._id) !== String(participantId)) {
        return null;
    }
    return User.findOne({ _id: participantId, role: participantType });
};

const participantParams = req => ({
    participantType: req.params.participantType || 'technician',
    participantId: req.params.participantId || req.params.technicianId
});

const roomFor = (participantType, participantId) => `chat:${participantType}:${participantId}`;
const senderRoleFor = user => {
    const isAdmin = user instanceof Admin || user.constructor?.modelName === 'Admin' || user.role === 'super-admin';
    return isAdmin ? 'admin' : user.role;
};

const sendMessage = async (req, res, next) => {
    try {
        const { participantType, participantId } = participantParams(req);
        const participant = await findParticipant(req, participantType, participantId);
        if (!participant) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });

        const file = req.file;
        const messageType = file
            ? (file.mimetype.startsWith('image/') ? 'image' : 'video')
            : (req.body.messageType || 'text');
        const text = String(req.body.text || '').trim();

        if (!['text', 'image', 'video'].includes(messageType)) {
            return res.status(400).json({ success: false, message: 'messageType must be text, image, or video.' });
        }
        if (messageType === 'text' && !text) {
            return res.status(400).json({ success: false, message: 'Text messages cannot be empty.' });
        }
        if (messageType !== 'text' && !file) {
            return res.status(400).json({ success: false, message: 'A media file is required.' });
        }
        if (file && file.mimetype.startsWith('image/') && file.size > 5 * 1024 * 1024) {
            return res.status(413).json({ success: false, message: 'Images must be 5 MB or smaller.' });
        }

        let media = undefined;
        if (file) {
            let upload = file;
            if (file.mimetype.startsWith('image/')) {
                // Sharp's bundled libheif rejects some valid iPhone HEIC files
                // because of their internal reference-count security limit.
                // Decode HEIC/HEIF separately, then use Sharp only for resizing.
                const sourceBuffer = isHeicImage(file)
                    ? Buffer.from(await convertHeic({ buffer: file.buffer, format: 'JPEG', quality: 0.9 }))
                    : file.buffer;
                const compressedBuffer = await sharp(sourceBuffer)
                    .rotate()
                    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();
                upload = {
                    ...file,
                    buffer: compressedBuffer,
                    mimetype: 'image/webp',
                    originalname: `${file.originalname.replace(/\.[^/.]+$/, '')}.webp`,
                    size: compressedBuffer.length
                };
            }
            const { key } = await uploadFile(upload, `chat/${participantType}/${participantId}`);
            media = { url: mediaUrl(key), key, mimeType: upload.mimetype, size: upload.size };
        }

        const message = await ChatMessage.create({
            ...(participantType === 'technician' ? { technicianId: participantId } : {}),
            participantId,
            participantType,
            senderId: req.user._id,
            senderRole: senderRoleFor(req.user),
            receiverId: req.user.role === participantType ? (req.body.receiverId || null) : participant._id,
            messageType,
            text,
            media
        });

        try {
            getIO().to(roomFor(participantType, participantId)).emit('chat:message', { message });
        } catch (socketError) {
            console.warn('[Chat] message broadcast failed:', socketError.message);
        }

        res.status(201).json({ success: true, data: { message } });
    } catch (error) {
        next(error);
    }
};

const getMessages = async (req, res, next) => {
    try {
        const { participantType, participantId } = participantParams(req);
        const participant = await findParticipant(req, participantType, participantId);
        if (!participant) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });

        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
        const query = participantType === 'technician'
            ? { $or: [{ technicianId: participant._id }, { participantId: participant._id, participantType }] }
            : { participantId: participant._id, participantType };
        if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };
        const messages = await ChatMessage.find(query).sort({ createdAt: -1 }).limit(limit).lean();
        res.json({ success: true, data: { messages: messages.reverse(), hasMore: messages.length === limit } });
    } catch (error) {
        next(error);
    }
};

const markRead = async (req, res, next) => {
    try {
        const { participantType, participantId } = participantParams(req);
        const participant = await findParticipant(req, participantType, participantId);
        if (!participant) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });
        const conversationQuery = participantType === 'technician'
            ? { $or: [{ technicianId: participant._id }, { participantId: participant._id, participantType }] }
            : { participantId: participant._id, participantType };
        await ChatMessage.updateMany(
            { ...conversationQuery, 'readBy.userId': { $ne: req.user._id }, senderId: { $ne: req.user._id } },
            { $push: { readBy: { userId: req.user._id, readAt: new Date() } } }
        );
        try {
            getIO().to(roomFor(participantType, participantId)).emit('chat:read', {
                participantType, participantId, userId: String(req.user._id)
            });
        } catch (socketError) {
            console.warn('[Chat] read broadcast failed:', socketError.message);
        }
        res.json({ success: true, message: 'Messages marked as read.' });
    } catch (error) {
        next(error);
    }
};

const getInbox = async (req, res, next) => {
    try {
        if (!(req.user instanceof Admin || req.user.constructor?.modelName === 'Admin')) {
            return res.status(403).json({ success: false, message: 'Only admins can view the chat inbox.' });
        }
        const participantType = req.params.participantType;
        if (!['technician', 'user'].includes(participantType)) {
            return res.status(400).json({ success: false, message: 'Invalid chat participant type.' });
        }
        const participants = await User.find({ role: participantType }).sort({ name: 1 }).lean();
        const participantMatch = participantType === 'technician'
            ? { $or: [{ participantType: 'technician' }, { participantType: { $exists: false } }] }
            : { participantType };
        const latest = await ChatMessage.aggregate([
            { $match: participantMatch },
            { $sort: { createdAt: -1 } },
            { $group: { _id: { $ifNull: ['$participantId', '$technicianId'] }, lastMessage: { $first: '$$ROOT' } } }
        ]);
        const latestByParticipant = new Map(latest.map(item => [String(item._id), item.lastMessage]));
        const unread = await ChatMessage.aggregate([
            { $match: { ...participantMatch, senderRole: { $ne: 'admin' }, 'readBy.userId': { $ne: req.user._id } } },
            { $group: { _id: { $ifNull: ['$participantId', '$technicianId'] }, count: { $sum: 1 } } }
        ]);
        const unreadByParticipant = new Map(unread.map(item => [String(item._id), item.count]));
        const conversations = participants.map(participant => ({
            participant,
            lastMessage: latestByParticipant.get(String(participant._id)) || null,
            unreadCount: unreadByParticipant.get(String(participant._id)) || 0
        })).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        res.json({ success: true, data: { conversations } });
    } catch (error) {
        next(error);
    }
};

const getUnreadCount = async (req, res, next) => {
    try {
        const { participantType, participantId } = participantParams(req);
        const participant = await findParticipant(req, participantType, participantId);
        if (!participant) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });
        const conversationQuery = participantType === 'technician'
            ? { $or: [{ technicianId: participant._id }, { participantId: participant._id, participantType }] }
            : { participantId: participant._id, participantType };
        const unreadCount = await ChatMessage.countDocuments({
            ...conversationQuery, senderRole: 'admin', 'readBy.userId': { $ne: req.user._id }
        });
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ success: true, data: { unreadCount } });
    } catch (error) { next(error); }
};

module.exports = { sendMessage, getMessages, markRead, getInbox, getUnreadCount };
