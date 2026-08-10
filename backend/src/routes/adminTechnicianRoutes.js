const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminTechnicianController = require('../controllers/adminTechnicianController');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/technician-jobs', adminTechnicianController.getTechnicianJobs);
router.post('/technician-jobs', adminTechnicianController.createTechnicianJob);
router.get('/technician-requests', adminTechnicianController.getTechnicianRequests);
router.patch('/technician-requests/:requestId/status', adminTechnicianController.updateTechnicianRequest);
router.patch('/technician-requests/:requestId/message', adminTechnicianController.sendTechnicianRequestMessage);

module.exports = router;
