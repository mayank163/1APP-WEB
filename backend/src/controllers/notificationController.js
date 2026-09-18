const Notification = require('../models/Notification');

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
    const notifications = await Notification.find({ recipient: req.user._id, recipientModel }).sort('-createdAt').limit(50).lean();
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, recipientModel, isRead: false });
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) { next(error); }
};

exports.markRead = async (req, res, next) => {
  try {
    const recipientModel = modelNameFor(req.user);
    await Notification.updateMany({ recipient: req.user._id, recipientModel, isRead: false }, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (error) { next(error); }
};