const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadChatMedia } = require('../middleware/upload');
const chatController = require('../controllers/chatController');

router.use(protect);
router.get('/conversations/inbox/:participantType', chatController.getInbox);
router.get('/conversations/:technicianId/messages', chatController.getMessages);
router.post('/conversations/:technicianId/messages', uploadChatMedia, chatController.sendMessage);
router.patch('/conversations/:technicianId/read', chatController.markRead);
router.get('/conversations/:participantType/:participantId/messages', chatController.getMessages);
router.post('/conversations/:participantType/:participantId/messages', uploadChatMedia, chatController.sendMessage);
router.patch('/conversations/:participantType/:participantId/read', chatController.markRead);
router.get('/conversations/:participantType/:participantId/unread-count', chatController.getUnreadCount);

module.exports = router;
