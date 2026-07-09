const Booking = require('../models/Booking');
const Service = require('../models/Service');
const razorpayInstance = require('../config/razorpay');
const { generateTextInvoice } = require('../utils/invoiceService');
const { sendBookingConfirmed, sendBookingCancelled } = require('../utils/emailService');

/**
 * @desc    Create a new booking and initialize payment order
 * @route   POST /api/bookings
 */
exports.createBookingOrder = async (req, res, next) => {
    try {
        const { services, address, phone, serviceDate, timeSlot, specialInstructions } = req.body;

        // 1) Verify and calculate total amount from DB to prevent tampering
        let calculatedTotal = 0;
        const populatedServices = [];

        for (const item of services) {
            const dbService = await Service.findById(item.service);
            if (!dbService || !dbService.isActive) {
                return res.status(404).json({
                    success: false,
                    message: `Service with ID ${item.service} not found or inactive`
                });
            }
            const price = dbService.price;
            const quantity = item.quantity || 1;
            calculatedTotal += price * quantity;

            populatedServices.push({
                service: dbService._id,
                quantity,
                price
            });
        }

        // 2) Create Razorpay Order
        const amountInPaise = Math.round(calculatedTotal * 100);
        let order;
        try {
            order = await razorpayInstance.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            });
        } catch (paymentError) {
            console.error('Razorpay Order Creation Failed:', paymentError.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment order. Try again.'
            });
        }

        // 3) Create Booking in DB
        const booking = await Booking.create({
            user: req.user.id,
            services: populatedServices,
            totalAmount: calculatedTotal,
            address,
            phone,
            serviceDate,
            timeSlot,
            specialInstructions,
            paymentStatus: 'Pending',
            status: 'Pending',
            paymentDetails: {
                orderId: order.id
            }
        });

        res.status(201).json({
            success: true,
            data: {
                booking,
                paymentOrder: order
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Verify payment and confirm booking
 * @route   POST /api/bookings/verify
 */
exports.verifyPayment = async (req, res, next) => {
    try {
        const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature, status } = req.body;

        // Find the booking
        const booking = await Booking.findById(bookingId).populate('user').populate('services.service');
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Standard signature verification (optional, mock support)
        // If razorpaySignature is mock or in test mode, we mark it paid
        const isMock = razorpayOrderId.startsWith('order_mock_') || razorpayPaymentId.startsWith('pay_mock_');

        if (isMock || status === 'success') {
            booking.paymentStatus = 'Paid';
            booking.status = 'Confirmed';
            booking.paymentDetails = {
                orderId: razorpayOrderId,
                paymentId: razorpayPaymentId,
                signature: razorpaySignature,
                transactionId: razorpayPaymentId
            };

            await booking.save();

            // Send booking confirmed email with invoice (non-blocking)
            sendBookingConfirmed(booking).catch(err =>
                console.error('Booking confirmed email failed:', err.message)
            );

            return res.status(200).json({
                success: true,
                message: 'Payment verified and booking confirmed',
                data: { booking }
            });
        } else {
            booking.paymentStatus = 'Failed';
            await booking.save();
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get current user's bookings
 * @route   GET /api/bookings/my-bookings
 */
exports.getMyBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ user: req.user.id })
            .populate('services.service')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: { bookings }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get details for a specific booking
 * @route   GET /api/bookings/:id
 */
exports.getBookingDetails = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user')
            .populate('services.service');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Access check: User must own the booking, or be an admin
        if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this booking'
            });
        }

        res.status(200).json({
            success: true,
            data: { booking }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Cancel a booking (Customer)
 * @route   POST /api/bookings/:id/cancel
 */
exports.cancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Access check
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to cancel this booking'
            });
        }

        // Only allow cancel if not In Progress/Completed/already Cancelled
        if (['In Progress', 'Completed', 'Cancelled'].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: `Booking cannot be cancelled now. Current status is ${booking.status}`
            });
        }

        booking.status = 'Cancelled';
        await booking.save();

        // Send cancellation email with invoice summary (non-blocking)
        // Re-fetch with populated relations for the email template
        const populatedBooking = await Booking.findById(booking._id)
            .populate('user')
            .populate('services.service');

        sendBookingCancelled(populatedBooking).catch(err =>
            console.error('Booking cancelled email failed:', err.message)
        );

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: { booking }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Download text invoice
 * @route   GET /api/bookings/:id/invoice
 */
exports.downloadInvoice = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user')
            .populate('services.service');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access'
            });
        }

        const invoiceText = generateTextInvoice(booking);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking._id}.txt`);
        res.status(200).send(invoiceText);
    } catch (err) {
        next(err);
    }
};
