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

const findTechnician = async (req, technicianId) => {
    const isAdmin = req.user instanceof Admin || req.user.constructor?.modelName === 'Admin';
    if (!isAdmin && req.user.role !== 'technician') return null;
    if (req.user.role === 'technician' && String(req.user._id) !== String(technicianId)) {
        return null;
    }
    return User.findOne({ _id: technicianId, role: 'technician' });
};

const sendMessage = async (req, res, next) => {
    try {
        const { technicianId } = req.params;
        const technician = await findTechnician(req, technicianId);
        if (!technician) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });

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
            const { key } = await uploadFile(upload, `chat/${technicianId}`);
            media = { url: mediaUrl(key), key, mimeType: upload.mimetype, size: upload.size };
        }

        const message = await ChatMessage.create({
            technicianId,
            senderId: req.user._id,
            senderRole: req.user.role === 'technician' ? 'technician' : 'admin',
            receiverId: req.user.role === 'technician' ? (req.body.receiverId || null) : technician._id,
            messageType,
            text,
            media
        });

        try {
            getIO().to(`chat:technician:${technicianId}`).emit('chat:message', { message });
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
        const technician = await findTechnician(req, req.params.technicianId);
        if (!technician) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });

        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
        const query = { technicianId: technician._id };
        if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };
        const messages = await ChatMessage.find(query).sort({ createdAt: -1 }).limit(limit).lean();
        res.json({ success: true, data: { messages: messages.reverse(), hasMore: messages.length === limit } });
    } catch (error) {
        next(error);
    }
};

const markRead = async (req, res, next) => {
    try {
        const technician = await findTechnician(req, req.params.technicianId);
        if (!technician) return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });
        await ChatMessage.updateMany(
            { technicianId: technician._id, 'readBy.userId': { $ne: req.user._id }, senderId: { $ne: req.user._id } },
            { $push: { readBy: { userId: req.user._id, readAt: new Date() } } }
        );
        res.json({ success: true, message: 'Messages marked as read.' });
    } catch (error) {
        next(error);
    }
};

module.exports = { sendMessage, getMessages, markRead };