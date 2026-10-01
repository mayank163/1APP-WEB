const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { protect, restrictTo, checkPermission } = require('../middleware/auth');

router.get('/', planController.getActivePlans);

router.post('/purchases', protect, restrictTo('user'), planController.createPurchase);
router.post('/purchases/verify', protect, restrictTo('user'), planController.verifyPurchase);
router.get('/my-purchases', protect, restrictTo('user'), planController.getMyPurchases);

router.use('/admin', protect);
router.get('/admin/plans', checkPermission('offers', 'read'), planController.getAdminPlans);
router.post('/admin/plans', checkPermission('offers', 'write'), planController.createPlan);
router.put('/admin/plans/:id', checkPermission('offers', 'write'), planController.updatePlan);
router.patch('/admin/plans/:id/status', checkPermission('offers', 'write'), planController.updatePlanStatus);
router.get('/admin/purchases', checkPermission('offers', 'read'), planController.getAdminPurchases);

module.exports = router;