const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadChatMedia } = require('../middleware/upload');
const chatController = require('../controllers/chatController');

router.use(protect);
router.get('/conversations/:technicianId/messages', chatController.getMessages);
router.post('/conversations/:technicianId/messages', uploadChatMedia, chatController.sendMessage);
router.patch('/conversations/:technicianId/read', chatController.markRead);

module.exports = router;