const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const adminTechnicianController = require('../controllers/adminTechnicianController');

router.use(protect);

router.get('/technician-jobs', checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicianJobs);
router.post('/technician-jobs', checkPermission('technician_jobs', 'write'), adminTechnicianController.createTechnicianJob);
router.put('/technician-jobs/:jobId', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianJob);
router.delete('/technician-jobs/:jobId', checkPermission('technician_jobs', 'write'), adminTechnicianController.deleteTechnicianJob);
router.patch('/technician-jobs/:jobId/status', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianJobStatus);
router.post('/technician-jobs/:jobId/pay-wallet', checkPermission('technician_jobs', 'write'), adminTechnicianController.payTechnicianWallet);
router.patch('/technician-jobs/:jobId/reschedule', checkPermission('technician_jobs', 'write'), adminTechnicianController.rescheduleJob);
router.get('/technician-requests', checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicianRequests);
router.patch('/technician-requests/:requestId/status', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianRequest);
router.patch('/technician-requests/:requestId/message', checkPermission('technician_jobs', 'write'), adminTechnicianController.sendTechnicianRequestMessage);

module.exports = router;
