const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const modelNameFor = user => user.constructor?.modelName || (user.role === 'admin' ? 'Admin' : 'User');

exports.registerToken = async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token || token.length > 4096) return res.status(400).json({ success: false, message: 'A valid FCM token is required.' });
    const Model = modelNameFor(req.user) === 'Admin' ? require('../models/Admin') : require('../models/User');
    await Model.findByIdAndUpdate(req.user._id, { $addToSet: { fcmTokens: token } });
    res.json({ success: true, message: 'Notification token registered.' });
  } catch (error) { next(error); }
};

exports.removeToken = async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const Model = modelNameFor(req.user) === 'Admin' ? require('../models/Admin') : require('../models/User');
    await Model.findByIdAndUpdate(req.user._id, { $pull: { fcmTokens: token } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.list = async (req, res, next) => {
  try {
    const recipientModel = modelNameFor(req.user);
    const { page, limit, skip } = getPagination(req.query);
    const query = { recipient: req.user._id, recipientModel };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort('-createdAt').skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, isRead: false }),
    ]);
    res.json({
      success: true,
      data: { notifications, unreadCount },
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) { next(error); }
};

exports.markRead = async (req, res, next) => {
  try {
    const notificationId = req.params.notificationId;
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ success: false, message: 'A valid notification ID is required.' });
    }

    const recipientModel = modelNameFor(req.user);
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user._id, recipientModel },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });

    res.json({ success: true, data: { notification } });
  } catch (error) { next(error); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const recipientModel = modelNameFor(req.user);
    const result = await Notification.updateMany(
      { recipient: req.user._id, recipientModel, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
  } catch (error) { next(error); }
};