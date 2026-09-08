const express = require('express');
const router = express.Router();
const workTypeController = require('../controllers/workTypeController');
const { protect, checkPermission } = require('../middleware/auth');

// ─── WORK TYPES (public read, protected write) ───────────────────────────────
router.get('/', workTypeController.getAllWorkTypes);
router.get('/:id', workTypeController.getWorkTypeById);
router.post('/', protect, checkPermission('work_types', 'write'), workTypeController.createWorkType);
router.put('/:id', protect, checkPermission('work_types', 'write'), workTypeController.updateWorkType);
router.delete('/:id', protect, checkPermission('work_types', 'write'), workTypeController.deleteWorkType);

// ─── SUB-WORK-TYPES ───────────────────────────────────────────────────────────
router.post('/:id/sub-types', protect, checkPermission('work_types', 'write'), workTypeController.addSubType);
router.put('/:id/sub-types/:subId', protect, checkPermission('work_types', 'write'), workTypeController.updateSubType);
router.delete('/:id/sub-types/:subId', protect, checkPermission('work_types', 'write'), workTypeController.deleteSubType);

module.exports = router;
