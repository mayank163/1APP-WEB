const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

// Public route for Admin Login
router.post('/login', adminController.login);

// Protected routes (Only Admins)
router.use(protect);
router.use(restrictTo('admin'));

router.post('/register', adminController.registerAdmin);
router.get('/stats', adminController.getDashboardStats);
router.get('/bookings', adminController.getAllBookings);
router.put('/bookings/:id', adminController.updateBookingStatus);
router.get('/users', adminController.getAllUsers);

module.exports = router;
