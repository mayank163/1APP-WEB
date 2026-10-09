const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const invoiceController = require('../controllers/invoiceController');
const reviewController  = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validation');

// All booking routes require authentication
router.use(protect);

router.post('/',               validateBooking, bookingController.createBookingOrder);
router.post('/payment-attempts/:id/cancel', bookingController.cancelPaymentAttempt);
router.post('/verify',                          bookingController.verifyPayment);
router.get('/my-bookings',                      bookingController.getMyBookings);
router.get('/:id',                              bookingController.getBookingDetails);
router.post('/:id/cancel',                      bookingController.cancelBooking);
router.get('/:id/invoice',                      bookingController.downloadInvoice);
router.get('/:id/invoice/details',              invoiceController.getInvoice);
router.get('/:bookingId/reviewable-services',   reviewController.getReviewableServices);

router.post('/:bookingId/technician-review', reviewController.submitTechnicianReview);

module.exports = router;
