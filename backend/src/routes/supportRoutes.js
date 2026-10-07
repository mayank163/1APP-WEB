const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { protect } = require('../middleware/auth');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Ticket = require('../models/SupportTicket');
const Booking = require('../models/Booking');
const Message = require('../models/SupportMessage');
const Article = require('../models/SupportArticle');
const { uploadFile } = require('../utils/s3Upload');
const { getIO } = require('../utils/socketInstance');
const router = express.Router();
const isAdmin = user => user?.constructor?.modelName === 'Admin';
const can = (user, access) => isAdmin(user) && user.isActive && (user.isSuperAdmin || (user.permissions || []).some(p => p.resource === 'support' && [access, 'both'].includes(p.access)));
const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status || (e.name === 'ValidationError' || e.name === 'CastError' ? 400 : 500)).json({ success: false, message: e.status || e.name === 'ValidationError' ? e.message : 'Unable to process support request.' }); } };
const access = (req, res, next) => {
    if (isAdmin(req.user) && !can(req.user, req.method === 'GET' ? 'read' : 'write')) return res.status(403).json({ success: false, message: 'Support permission required.' });
    if (!isAdmin(req.user) && !['user', 'technician'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Support access denied.' });
    next();
};
const adminOnly = (req, res, next) => isAdmin(req.user) ? next() : res.status(403).json({ success: false, message: 'Admin access required.' });
const ticketFor = async req => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw fail(400, 'Invalid ticket ID.');
    const ticket = await Ticket.findOne({ _id: req.params.id, ...(!isAdmin(req.user) ? { requester: req.user._id } : {}) });
    if (!ticket) throw fail(404, 'Ticket not found.');
    return ticket;
};
const clean = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw fail(400, `${label} is required (maximum ${max} characters).`);
    return value.trim();
};
const uploadStorage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 }, fileFilter: (req, file, cb) => ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype) ? cb(null, true) : cb(fail(400, 'Only JPEG, PNG, WebP and PDF attachments are supported.')) });
const upload = uploadStorage.single('file');
const ticketUpload = uploadStorage.fields([{ name: 'files', maxCount: 5 }, { name: 'file', maxCount: 1 }]);
const ticketMedia = (req, res, next) => ticketUpload(req, res, e => e ? res.status(400).json({ success: false, message: e.message }) : next());
const media = (req, res, next) => upload(req, res, e => e ? res.status(400).json({ success: false, message: e.message }) : next());
const attachmentFor = async req => {
    if (!req.file) return undefined;
    const { key } = await uploadFile(req.file, 'support');
    return { name: req.file.originalname, url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`, mimeType: req.file.mimetype, size: req.file.size };
};
const notify = (ticket, internal = false) => {
    const io = getIO();
    // Dedicated rooms are joined only by authenticated, authorized identities.
    io.to('support:admins').emit('support:updated', { ticketId: String(ticket._id) });
    if (!internal) io.to(`support:user:${ticket.requester}`).emit('support:updated', { ticketId: String(ticket._id) });
};
router.use(protect, access);
router.get('/agents', adminOnly, wrap(async (req, res) => {
    const data = await Admin.find({ isActive: true, isSuperAdmin: false }).select('name email role').sort({ name: 1, _id: 1 });
    res.json({ success: true, data });
}));
router.get('/tickets', wrap(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const scope = isAdmin(req.user) ? {} : { requester: req.user._id };
    const filter = { ...scope };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.search) {
        const search = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = isAdmin(req.user) ? await User.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(100) : [];
        filter.$or = [{ ticketId: { $regex: search, $options: 'i' } }, { subject: { $regex: search, $options: 'i' } }, { requester: { $in: users.map(u => u._id) } }];
    }
    const [data, total, counts] = await Promise.all([
        Ticket.find(filter).populate('requester', 'name role').populate('assignedAgent', 'name').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).select('-audit -attachments -description'),
        Ticket.countDocuments(filter),
        Ticket.aggregate([{ $match: scope }, { $group: { _id: null, unreadUser: { $sum: '$unreadUser' }, unreadAdmin: { $sum: '$unreadAdmin' }, open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } }, in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } }, urgent: { $sum: { $cond: [{ $and: [{ $eq: ['$priority', 'urgent'] }, { $not: [{ $in: ['$status', ['resolved', 'closed']] }] }] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } }])
    ]);
    res.json({ success: true, data, total, page, limit, stats: counts[0] || { open: 0, in_progress: 0, urgent: 0, resolved: 0 } });
}));
router.post('/tickets', ticketMedia, wrap(async (req, res) => {
    if (isAdmin(req.user)) throw fail(400, 'Tickets must be created from a customer or technician account.');
    const subject = clean(req.body.subject, 200, 'Subject');
    const description = clean(req.body.description, 10000, 'Description');
    const category = clean(req.body.category, 80, 'Category');
    const priority = req.body.priority || 'medium';
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) throw fail(400, 'Invalid priority.');
    const subcategory = req.body.subcategory ? clean(req.body.subcategory, 120, 'Subcategory') : '';
    let relatedBooking = null, relatedBookingLabel = '';
    if (req.body.relatedBooking) {
        if (!mongoose.isObjectIdOrHexString(req.body.relatedBooking)) throw fail(400, 'Invalid related booking.');
        const booking = await Booking.findOne({ _id: req.body.relatedBooking, user: req.user._id }).populate('services.service', 'name');
        if (!booking) throw fail(400, 'Related booking not found.');
        relatedBooking = booking._id;
        relatedBookingLabel = `${booking.bookingId || '#' + String(booking._id).slice(-6).toUpperCase()} · ${booking.services.map(s => s.service?.name || s.variantName || 'Service').join(', ')}`;
    }
    const uploaded = [...(req.files?.files || []), ...(req.files?.file || [])];
    if (uploaded.length > 5) throw fail(400, 'Up to 5 attachments are supported.');
    const attachments = await Promise.all(uploaded.map(file => attachmentFor({ file })));
    const ticket = await Ticket.create({ ticketId: `TK-${randomUUID().slice(0, 8).toUpperCase()}`, requester: req.user._id, subject, description, category, subcategory, relatedBooking, relatedBookingLabel, priority, attachments, unreadAdmin: 1, audit: [{ action: 'Ticket created', actor: req.user.name }] });
    notify(ticket);
    res.status(201).json({ success: true, data: ticket });
}));
router.get('/tickets/:id', wrap(async (req, res) => {
    const ticket = await ticketFor(req);
    await ticket.populate([{ path: 'requester', select: 'name role email phone address profileImage technicianId' }, { path: 'assignedAgent', select: 'name' }]);
    const data = ticket.toObject();
    if (!isAdmin(req.user)) delete data.audit;
    res.json({ success: true, data });
}));
router.patch('/tickets/:id', wrap(async (req, res) => {
    const ticket = await ticketFor(req);
    const changes = {};
    if (!isAdmin(req.user)) {
        if (!['closed', 'open'].includes(req.body.status) || (req.body.status === 'open' && !['closed', 'resolved'].includes(ticket.status))) throw fail(400, 'You can close a ticket or reopen a resolved/closed ticket.');
        changes.status = req.body.status;
    } else {
        for (const [field, allowed] of Object.entries({ status: ['open', 'in_progress', 'escalated', 'resolved', 'closed'], priority: ['low', 'medium', 'high', 'urgent'] })) {
            if (req.body[field] !== undefined) { if (!allowed.includes(req.body[field])) throw fail(400, `Invalid ${field}.`); changes[field] = req.body[field]; }
        }
        if (req.body.subject !== undefined) changes.subject = clean(req.body.subject, 200, 'Subject');
        if (req.body.category !== undefined) changes.category = clean(req.body.category, 80, 'Category');
        if (req.body.assignedAgent !== undefined) {
            const id = req.body.assignedAgent;
            if (id) {
                if (!mongoose.isObjectIdOrHexString(id)) throw fail(400, 'Invalid agent.');
                const agent = await Admin.findById(id);
                if (!agent || !agent.isActive || agent.isSuperAdmin) throw fail(400, 'Select an active sub-admin.');
            }
            changes.assignedAgent = id || null;
        }
    }
    const audit = Object.entries(changes).map(([field, value]) => ({ action: `${field}: ${value || 'Unassigned'}`, actor: req.user.name }));
    const updated = await Ticket.findByIdAndUpdate(ticket._id, { $set: changes, $push: { audit: { $each: audit } } }, { new: true, runValidators: true });
    notify(updated);
    const data = updated.toObject();
    if (!isAdmin(req.user)) delete data.audit;
    res.json({ success: true, data });
}));
router.get('/tickets/:id/messages', wrap(async (req, res) => {
    const ticket = await ticketFor(req);
    const filter = { ticket: ticket._id, ...(!isAdmin(req.user) ? { internal: false } : {}) };
    if (req.query.before) {
        const [timestamp, messageId] = String(req.query.before).split('|');
        const before = new Date(timestamp);
        if (Number.isNaN(before.getTime()) || (messageId && !mongoose.isObjectIdOrHexString(messageId))) throw fail(400, 'Invalid cursor.');
        if (messageId) filter.$or = [{ createdAt: { $lt: before } }, { createdAt: before, _id: { $lt: messageId } }];
        else filter.createdAt = { $lt: before };
    }
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const data = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
    const hasMore = data.length > limit;
    if (hasMore) data.pop();
    data.reverse();
    res.json({ success: true, data, hasMore, nextCursor: hasMore ? `${data[0].createdAt.toISOString()}|${data[0]._id}` : null });
}));
router.post('/tickets/:id/messages', media, wrap(async (req, res) => {
    const ticket = await ticketFor(req);
    if (['closed', 'resolved'].includes(ticket.status)) throw fail(409, 'Reopen this ticket before replying.');
    const internal = req.body.internal === true || req.body.internal === 'true';
    if (internal && !isAdmin(req.user)) throw fail(403, 'Internal notes are admin only.');
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if ((!text && !req.file) || text.length > 4000) throw fail(400, 'Provide a message or attachment; text limit is 4000 characters.');
    const attachment = await attachmentFor(req);
    const data = await Message.create({ ticket: ticket._id, senderId: req.user._id, senderName: req.user.name, senderRole: isAdmin(req.user) ? 'admin' : req.user.role, text, internal, attachment });
    await Ticket.updateOne({ _id: ticket._id }, { $set: { updatedAt: new Date() }, ...(!internal ? { $inc: { [isAdmin(req.user) ? 'unreadUser' : 'unreadAdmin']: 1 } } : {}), $push: { audit: { action: internal ? 'Internal note added' : 'Reply sent', actor: req.user.name } } });
    notify(ticket, internal);
    res.status(201).json({ success: true, data });
}));
router.patch('/tickets/:id/read', wrap(async (req, res) => {
    const ticket = await ticketFor(req);
    await Ticket.updateOne({ _id: ticket._id }, { $set: { [isAdmin(req.user) ? 'unreadAdmin' : 'unreadUser']: 0 } }, { timestamps: false });
    res.json({ success: true });
}));
router.get('/articles', wrap(async (req, res) => {
    const filter = isAdmin(req.user) ? {} : { published: true, audience: { $in: ['all', req.user.role] } };
    if (req.query.category) filter.category = String(req.query.category);
    const data = await Article.find(filter).populate('author', 'name').sort({ updatedAt: -1 });
    res.json({ success: true, data });
}));
const articleData = body => ({ title: clean(body.title, 200, 'Title'), content: clean(body.content, 20000, 'Content'), category: clean(body.category, 80, 'Category'), audience: body.audience || 'all', published: body.published === true });
router.post('/articles', adminOnly, wrap(async (req, res) => res.status(201).json({ success: true, data: await Article.create({ ...articleData(req.body), author: req.user._id }) })));
router.put('/articles/:id', adminOnly, wrap(async (req, res) => {
    const data = await Article.findByIdAndUpdate(req.params.id, articleData(req.body), { new: true, runValidators: true });
    if (!data) throw fail(404, 'Article not found.');
    res.json({ success: true, data });
}));
router.delete('/articles/:id', adminOnly, wrap(async (req, res) => {
    if (!await Article.findByIdAndDelete(req.params.id)) throw fail(404, 'Article not found.');
    res.json({ success: true });
}));
module.exports = router;
