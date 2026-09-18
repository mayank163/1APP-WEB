const express = require('express');
const { protect } = require('../middleware/auth');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);
router.get('/', controller.list);
router.patch('/read', controller.markRead);
router.post('/token', controller.registerToken);
router.delete('/token', controller.removeToken);

module.exports = router;