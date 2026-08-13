const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, checkPermission } = require('../middleware/auth');

// Public
router.post('/login', adminController.login);

// All routes below require a valid admin token
router.use(protect);

// Dashboard & bookings
router.get('/stats', checkPermission('dashboard', 'read'), adminController.getDashboardStats);
router.get('/bookings', checkPermission('bookings', 'read'), adminController.getAllBookings);
router.put('/bookings/:id', checkPermission('bookings', 'write'), adminController.updateBookingStatus);
router.get('/users', checkPermission('users', 'read'), adminController.getAllUsers);

// Sub-admin management (super admin only via isSuperAdmin check inside checkPermission)
router.get('/sub-admins/resources', adminController.getResources);
router.get('/sub-admins', checkPermission('sub_admins', 'read'), adminController.getSubAdmins);
router.post('/sub-admins', checkPermission('sub_admins', 'write'), adminController.createSubAdmin);
router.put('/sub-admins/:id', checkPermission('sub_admins', 'write'), adminController.updateSubAdmin);
router.delete('/sub-admins/:id', checkPermission('sub_admins', 'write'), adminController.deleteSubAdmin);

module.exports = router;
