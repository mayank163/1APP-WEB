const express = require('express');
const router = express.Router();
const serviceTypeController = require('../controllers/serviceTypeController');
const { protect, checkPermission } = require('../middleware/auth');

// ─── SERVICE TYPES (public read, protected write) ─────────────────────────────
router.get('/', serviceTypeController.getAllServiceTypes);
router.post('/', protect, checkPermission('service_types', 'write'), serviceTypeController.createServiceType);
router.put('/:id', protect, checkPermission('service_types', 'write'), serviceTypeController.updateServiceType);
router.delete('/:id', protect, checkPermission('service_types', 'write'), serviceTypeController.deleteServiceType);
router.patch('/:id/status', protect, checkPermission('service_types', 'write'), serviceTypeController.toggleServiceTypeStatus);

module.exports = router;
