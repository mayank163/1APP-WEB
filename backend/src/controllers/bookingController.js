const offerService = require('../services/offerService');
const Booking = require('../models/Booking');
const Admin = require('../models/Admin');
const PaymentAttempt = require('../models/PaymentAttempt');
const Service = require('../models/Service');
const razorpayInstance = require('../config/razorpay');
const stripe = require('../config/stripe');
const paypal = require('../config/paypal');
const { generateTextInvoice } = require('../utils/invoiceService');
const { sendBookingConfirmed, sendBookingCancelled } = require('../utils/emailService');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const resolveServiceDate = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    return date;
};

const resolveAddressLine = (address) => {
    if (typeof address === 'string') return address.trim();
    if (!address || typeof address !== 'object') return '';

    const addressLine = address.addressLine;
    if (typeof addressLine === 'string') return addressLine.trim();

    return [address.houseNumber, address.street, address.route, address.city, address.state, address.zipcode]
        .filter((part) => typeof part === 'string' && part.trim())
        .map((part) => part.trim())
        .join(', ');
};

/**
 * @desc    Create a payment attempt without creating a booking
 * @route   POST /api/bookings
 */
exports.createBookingOrder = async (req, res, next) => {
    let reservedAttempt;
    let providerCreated = false;
    try {
        const { services, address, phone, specialInstructions, paymentProvider } = req.body;
        if (paymentProvider && !['stripe', 'paypal'].includes(paymentProvider)) {
            return res.status(400).json({ success: false, message: 'Choose Stripe or PayPal.' });
        }
        if (paymentProvider === 'stripe' && !stripe) {
            return res.status(503).json({ success: false, message: 'Stripe payments are not configured.' });
        }
        if (paymentProvider === 'paypal' && !paypal.isConfigured()) {
            return res.status(503).json({ success: false, message: 'PayPal payments are not configured.' });
        }
        const bookingAddress = typeof address === 'string'
            ? { addressLine: address }
            : address;
        const addressLine = resolveAddressLine(bookingAddress);

        // Validate structured address
        if (!addressLine) {
            return res.status(400).json({ success: false, message: 'Please provide a valid address (addressLine is required)' });
        }
        const serviceDate = resolveServiceDate();

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
            const activeVariants = (dbService.variants || []).filter(variant => variant.isActive !== false);
            const selectedVariant = item.variantId
                ? activeVariants.find(variant => String(variant._id) === String(item.variantId))
                : (dbService.hasVariants ? activeVariants[0] : null);
            if (item.variantId && !selectedVariant) {
                return res.status(400).json({ success: false, message: `The selected variant for ${dbService.name} is no longer available.` });
            }
            if (dbService.hasVariants && activeVariants.length === 0) {
                return res.status(400).json({ success: false, message: `${dbService.name} has no available variants.` });
            }
            const price = selectedVariant
                ? Number(selectedVariant.offerPrice || selectedVariant.actualPrice)
                : Number(dbService.price);
            const addonIds = Array.isArray(item.addonIds) ? [...new Set(item.addonIds.map(String))] : [];
            const selectedAddons = [];
            for (const addonId of addonIds) {
                const addon = (dbService.addons || []).find(candidate => String(candidate._id) === addonId && candidate.isActive !== false);
                if (!addon) {
                    return res.status(400).json({ success: false, message: `One or more selected add-ons for ${dbService.name} are no longer available.` });
                }
                selectedAddons.push({ addonId: addon._id, name: addon.name, price: addon.price });
            }
            const addonTotal = selectedAddons.reduce((total, addon) => total + addon.price, 0);
            const quantity = item.quantity || 1;
            calculatedTotal += (price + addonTotal) * quantity;

            populatedServices.push({
                service: dbService._id,
                quantity,
                variantId: selectedVariant?._id || null,
                variantName: selectedVariant?.name || '',
                selectedAddons,
                price: price + addonTotal
            });
        }

        if (stripe && paymentProvider !== 'paypal' && !(process.env.STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_')) return res.status(503).json({ success: false, message: 'Stripe is not configured.' });
        const paymentAttemptId = new PaymentAttempt()._id.toString();
        let coupon;
        if (req.body.couponCode) {
            const lines = await offerService.priceLines(services);
            coupon = await offerService.reserve(req.body.couponCode, req.user._id, lines, paymentAttemptId, paymentProvider === 'paypal' ? paypal.currency() : stripe ? (process.env.STRIPE_CURRENCY || 'usd').toUpperCase() : 'USD');
            reservedAttempt = paymentAttemptId;
            calculatedTotal = Math.round((coupon.subtotal - coupon.discount) * 100) / 100;
            if (calculatedTotal <= 0) { await offerService.settle(paymentAttemptId); reservedAttempt = null; return res.status(400).json({ success: false, message: 'The discount must leave a positive payment amount.' }); }
        }
        const amountInSmallestUnit = Math.round(calculatedTotal * 100);
        await PaymentAttempt.create({
            _id: paymentAttemptId,
            user: req.user.id,
            services: populatedServices,
            totalAmount: calculatedTotal,
            coupon,
            address: {
                label:       bookingAddress.label       || 'Home',
                name:        bookingAddress.name        || '',
                addressLine,
                city:        bookingAddress.city        || '',
                state:       bookingAddress.state       || '',
                zipcode:     bookingAddress.zipcode     || '',
                coordinates: bookingAddress.coordinates?.lat
                    ? { lat: bookingAddress.coordinates.lat, lng: bookingAddress.coordinates.lng }
                    : { lat: null, lng: null }
            },
            phone,
            serviceDate,
            specialInstructions,
            paymentDetails: {
                provider: paymentProvider === 'paypal' ? 'paypal' : stripe ? 'stripe' : 'razorpay',
                orderId: `initializing_${paymentAttemptId}`,
                currency: paymentProvider === 'paypal' ? paypal.currency() : stripe ? (process.env.STRIPE_CURRENCY || 'usd').toUpperCase() : 'USD'
            }
        });
        let paymentOrder;

        if (paymentProvider === 'paypal') {
            try {
                const order = await paypal.createOrder({ attemptId: paymentAttemptId, amount: amountInSmallestUnit });
                providerCreated = true;
                paymentOrder = {
                    provider: 'paypal', id: order.id, amount: amountInSmallestUnit,
                    currency: paypal.currency(), clientId: process.env.PAYPAL_CLIENT_ID
                };
            } catch (error) {
                return res.status(502).json({ success: false, message: error.message });
            }
        } else if (stripe) {
            const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
            if (!publishableKey.startsWith('pk_')) {
                return res.status(500).json({
                    success: false,
                    message: 'Stripe publishable key is not configured on the server'
                });
            }

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInSmallestUnit,
                    currency: process.env.STRIPE_CURRENCY || 'usd',
                    payment_method_types: ['card'],
                    metadata: {
                        userId: req.user.id,
                        paymentAttemptId,
                        receipt: `receipt_${Date.now()}`
                    }
                });

                providerCreated = true;
                paymentOrder = {
                    provider: 'stripe',
                    id: paymentIntent.id,
                    clientSecret: paymentIntent.client_secret,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    publishableKey
                };
            } catch (paymentError) {
                console.error('Stripe PaymentIntent Creation Failed:', paymentError.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create Stripe payment. Try again.'
                });
            }
        } else {
            try {
                const order = await razorpayInstance.orders.create({
                    amount: amountInSmallestUnit,
                    currency: 'USD',
                    receipt: `receipt_${Date.now()}`,
                    notes: { paymentAttemptId }
                });

                providerCreated = true;
                paymentOrder = {
                    provider: 'razorpay',
                    ...order
                };
            } catch (paymentError) {
                console.error('Razorpay Order Creation Failed:', paymentError.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create payment order. Try again.'
                });
            }
        }

        if (!paymentOrder) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment order. Try again.'
            });
        }

        providerCreated = true;
        const paymentAttempt = await PaymentAttempt.findByIdAndUpdate(paymentAttemptId, { $set: { paymentDetails: { provider: paymentOrder.provider, orderId: paymentOrder.id, currency: paymentOrder.currency.toUpperCase() } } }, { new: true });

        res.status(201).json({
            success: true,
            data: {
                paymentAttempt: {
                    _id: paymentAttempt._id,
                    totalAmount: paymentAttempt.totalAmount,
                    coupon: paymentAttempt.coupon,
                    serviceDate: paymentAttempt.serviceDate
                },
                paymentOrder
            }
        });
    } catch (err) {
        next(err);
    } finally {
        if (reservedAttempt && !providerCreated) {
            await PaymentAttempt.updateOne({ _id: reservedAttempt }, { $set: { status: 'Cancelled' } }).catch(() => {});
            await offerService.settle(reservedAttempt).catch(error => console.error('Coupon reservation release failed:', error.message));
        }
    }
};

/**
 * @desc    Verify payment and confirm booking
 * @route   POST /api/bookings/verify
 */
exports.verifyPayment = async (req, res, next) => {
    let lease;
    try {
        const { paymentAttemptId, razorpayOrderId, razorpayPaymentId, stripePaymentIntentId, paypalOrderId } = req.body;
        if (!paymentAttemptId) {
            return res.status(400).json({ success: false, message: 'Payment attempt ID is required' });
        }

        const paymentAttempt = await PaymentAttempt.findOne({
            _id: paymentAttemptId,
            user: req.user.id
        });
        if (!paymentAttempt) {
            return res.status(404).json({
                success: false,
                message: 'Payment attempt not found'
            });
        }

        const savedBooking = await Booking.findOne({ 'paymentDetails.orderId': paymentAttempt.paymentDetails.orderId });
        if (savedBooking) {
            if (paymentAttempt.coupon?.offer) await offerService.settle(paymentAttempt._id, savedBooking._id);
            paymentAttempt.status = 'Completed';
            paymentAttempt.booking = savedBooking._id;
            await paymentAttempt.save();
            const existingBooking = await Booking.findById(savedBooking._id)
                .populate('user')
                .populate('services.service');
            return res.status(200).json({
                success: true,
                message: 'Payment was already verified',
                data: { booking: existingBooking }
            });
        }

        const claimedAttempt = await PaymentAttempt.findOneAndUpdate(
            {
                _id: paymentAttempt._id,
                $or: [
                    { status: 'Pending' },
                    { status: 'Processing', updatedAt: { $lt: new Date(Date.now() - 60_000) } }
                ]
            },
            { $set: { status: 'Processing' } },
            { new: true }
        );
        if (!claimedAttempt) {
            const latestAttempt = await PaymentAttempt.findById(paymentAttempt._id);
            if (latestAttempt?.status === 'Completed' && latestAttempt.booking) {
                const existingBooking = await Booking.findById(latestAttempt.booking)
                    .populate('user')
                    .populate('services.service');
                return res.status(200).json({
                    success: true,
                    message: 'Payment was already verified',
                    data: { booking: existingBooking }
                });
            }
            return res.status(409).json({ success: false, message: 'Payment verification is already in progress' });
        }

        lease = { _id: claimedAttempt._id, updatedAt: claimedAttempt.updatedAt };
        let paymentId;
        const orderId = paymentAttempt.paymentDetails.orderId;

        if (paypalOrderId) {
            if (paymentAttempt.paymentDetails.provider !== 'paypal' || paypalOrderId !== orderId) {
                return res.status(400).json({ success: false, message: 'Payment does not match this payment attempt' });
            }
            let order = await paypal.getOrder(orderId);
            const unit = order.purchase_units?.[0];
            const expectedAmount = Math.round(paymentAttempt.totalAmount * 100);
            const expectedCurrency = paymentAttempt.paymentDetails.currency;
            if (order.id !== orderId || order.intent !== 'CAPTURE' || order.purchase_units?.length !== 1 ||
                unit?.custom_id !== paymentAttempt._id.toString() ||
                unit?.amount?.currency_code !== expectedCurrency ||
                Math.round(Number(unit?.amount?.value) * 100) !== expectedAmount) {
                return res.status(400).json({ success: false, message: 'Payment does not match this payment attempt' });
            }
            if (order.status === 'APPROVED') {
                order = await paypal.captureOrder(orderId, paymentAttempt._id.toString());
            }
            const captures = order.purchase_units?.[0]?.payments?.captures || [];
            const capture = captures[0];
            if (order.status !== 'COMPLETED' || captures.length !== 1 || capture?.status !== 'COMPLETED' ||
                !capture.id || capture.amount?.currency_code !== expectedCurrency ||
                Math.round(Number(capture.amount?.value) * 100) !== expectedAmount) {
                return res.status(409).json({ success: false, message: 'Payment is not completed. No booking has been created.' });
            }
            paymentId = capture.id;
        } else if (stripePaymentIntentId) {
            if (!stripe || paymentAttempt.paymentDetails.provider !== 'stripe') {
                return res.status(500).json({
                    success: false,
                    message: 'Stripe is unavailable for this payment attempt'
                });
            }

            if (stripePaymentIntentId !== orderId) {
                return res.status(400).json({ success: false, message: 'Payment does not match this payment attempt' });
            }

            const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
            if (
                paymentIntent.metadata?.paymentAttemptId !== paymentAttempt._id.toString() ||
                paymentIntent.metadata?.userId !== req.user.id
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Payment does not match this payment attempt'
                });
            }

            paymentId = paymentIntent.latest_charge || paymentIntent.id;
            const expectedAmount = Math.round(paymentAttempt.totalAmount * 100);
            if (
                paymentIntent.status !== 'succeeded' ||
                paymentIntent.amount !== expectedAmount ||
                paymentIntent.amount_received !== expectedAmount
            ) {
                return res.status(409).json({
                    success: false,
                    message: 'Payment is not completed. No booking has been created.'
                });
            }
        } else {
            if (paymentAttempt.paymentDetails.provider !== 'razorpay' || razorpayOrderId !== orderId || !razorpayPaymentId) {
                return res.status(400).json({ success: false, message: 'Payment does not match this payment attempt' });
            }

            const payment = await razorpayInstance.payments.fetch(razorpayPaymentId);
            const expectedAmount = Math.round(paymentAttempt.totalAmount * 100);
            if (
                payment.order_id !== orderId ||
                payment.status !== 'captured' ||
                payment.amount !== expectedAmount
            ) {
                return res.status(409).json({
                    success: false,
                    message: 'Payment is not completed. No booking has been created.'
                });
            }
            paymentId = payment.id;
        }

        let booking;
        try {
            booking = await Booking.create({
                user: claimedAttempt.user,
                services: claimedAttempt.services,
                totalAmount: claimedAttempt.totalAmount,
                coupon: claimedAttempt.coupon,
                address: claimedAttempt.address,
                phone: claimedAttempt.phone,
                serviceDate: claimedAttempt.serviceDate,
                specialInstructions: claimedAttempt.specialInstructions,
                paymentStatus: 'Paid',
                status: 'Pending',
                paymentDetails: {
                    provider: claimedAttempt.paymentDetails.provider,
                    orderId,
                    paymentId,
                    transactionId: paymentId
                }
            });
            if (claimedAttempt.coupon?.offer) await offerService.settle(claimedAttempt._id, booking._id);
            claimedAttempt.status = 'Completed';
            claimedAttempt.booking = booking._id;
            await claimedAttempt.save();
        } catch (error) {
            claimedAttempt.status = 'Pending';
            await claimedAttempt.save();
            throw error;
        }

        const populatedBooking = await Booking.findById(booking._id)
            .populate('user')
            .populate('services.service');
        sendBookingConfirmed(populatedBooking).catch(err =>
            console.error('Booking confirmed email failed:', err.message)
        );

        return res.status(201).json({
            success: true,
            message: 'Payment verified and booking created',
            data: { booking: populatedBooking }
        });
    } catch (err) {
        next(err);
    } finally {
        if (lease) await PaymentAttempt.updateOne({ ...lease, status: 'Processing' }, { $set: { status: 'Pending' } }).catch(error => console.error('Payment lease release failed:', error.message));
    }
};

/**
 * @desc    Get current user's bookings
 * @route   GET /api/bookings/my-bookings
 */
exports.getMyBookings = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const { status } = req.query;
        const allowedStatuses = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
        if (status && status !== 'all' && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid booking status. Allowed values: ${allowedStatuses.join(', ')}.`
            });
        }

        const query = { user: req.user.id };
        if (status && status !== 'all') query.status = status;
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('services.service', 'name featuredImage')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Booking.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: total,
            data: { bookings },
            pagination: getPaginationMeta({ page, limit, total })
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
        if (
            booking.user.toString() !== req.user.id &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to cancel this booking'
            });
        }

        // Active technician assignments cannot be cancelled from the customer app.
        if (['Assigned', 'On the Way', 'In Progress', 'Checkout', 'Completed', 'Cancelled'].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: `Booking cannot be cancelled now. Current status is ${booking.status}`
            });
        }

        // Cancellation note entered by admin
        const { statusNote } = req.body;

        // Cancel booking
        booking.status = 'Cancelled';
        await booking.save();

        // Update Job status and status note
        if (booking.job) {
            await Job.findByIdAndUpdate(
                booking.job,
                {
                    $set: {
                        status: 'Cancelled',
                        statusNote: statusNote || 'Booking cancelled'
                    }
                },
                { new: true }
            );
        }

        // Send cancellation email with invoice summary
        const populatedBooking = await Booking.findById(booking._id)
            .populate('user')
            .populate('services.service');

        sendBookingCancelled(populatedBooking).catch(err =>
            console.error(
                'Booking cancelled email failed:',
                err.message
            )
        );

        return res.status(200).json({
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

        const ownerId = booking.user?._id || booking.user;
        const isAdmin = req.user instanceof Admin && req.user.isActive !== false;
        const isOwner = ownerId != null && String(ownerId) === String(req.user.id || req.user._id);
        if (!isOwner && !isAdmin) {
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

// Cancel the provider intent before releasing coupon capacity. A paid intent
// retains its claim so delayed verification can still create the booking.
exports.cancelPaymentAttempt = async (req, res, next) => {
    let attempt;
    try {
        attempt = await PaymentAttempt.findOneAndUpdate({ _id: req.params.id, user: req.user._id, $or: [{ status: 'Pending' }, { status: 'Cancelling', updatedAt: { $lt: new Date(Date.now() - 60000) } }] }, { $set: { status: 'Cancelling' } }, { new: true });
        if (!attempt) {
            const existing = await PaymentAttempt.findOne({ _id: req.params.id, user: req.user._id });
            if (existing?.status === 'Cancelled') { if (existing.coupon?.offer) await offerService.settle(existing._id); return res.json({ success: true }); }
            return res.status(409).json({ success: false, message: 'Payment is completed or verification is in progress. Please verify the payment before continuing.' });
        }
        const orderId = attempt.paymentDetails.orderId;
        if (attempt.paymentDetails.provider === 'stripe') {
            const intent = await stripe.paymentIntents.retrieve(orderId);
            if (intent.status !== 'canceled') await stripe.paymentIntents.cancel(orderId);
        } else if (attempt.paymentDetails.provider === 'paypal') {
            const order = await paypal.getOrder(orderId);
            if (order.status === 'COMPLETED' || order.purchase_units?.some(unit => unit.payments?.captures?.length)) throw new Error('Payment has been captured. Please verify it.');
            // PayPal captures happen only in verifyPayment, guarded by the attempt lease.
        } else {
            throw new Error('This payment provider does not support cancellation. Please contact support.');
        }
        attempt.status = 'Cancelled';
        await attempt.save();
        if (attempt.coupon?.offer) await offerService.settle(attempt._id);
        res.json({ success: true });
    } catch (error) {
        if (attempt && attempt.status !== 'Cancelled') await PaymentAttempt.updateOne({ _id: attempt._id, status: 'Cancelling' }, { $set: { status: 'Pending' } });
        error.statusCode = error.statusCode || 409;
        next(error);
    }
};
