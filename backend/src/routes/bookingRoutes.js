const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validation');

// All booking routes require authentication
router.use(protect);

router.post('/', validateBooking, bookingController.createBookingOrder);
router.post('/verify', bookingController.verifyPayment);
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/:id', bookingController.getBookingDetails);
router.post('/:id/cancel', bookingController.cancelBooking);
router.get('/:id/invoice', bookingController.downloadInvoice);

module.exports = router;
