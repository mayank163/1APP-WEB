'use strict';

const Review  = require('../models/Review');
const Booking = require('../models/Booking');
const Service = require('../models/Service');

// ─── POST /api/services/:serviceId/reviews ────────────────────────────────────
/**
 * Create or update a review.
 * Unique constraint is (service + user + booking) so the same user can
 * leave independent reviews for the same service across different bookings.
 */
exports.createReview = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const userId = req.user._id;
        const { rating, review, bookingId } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Please provide a rating between 1 and 5' });
        }

        if (!bookingId) {
            return res.status(400).json({ success: false, message: 'bookingId is required' });
        }

        // Verify service exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        // Verify this specific booking is Completed, belongs to this user,
        // and actually contains this service
        const booking = await Booking.findOne({
            _id:                bookingId,
            user:               userId,
            status:             'Completed',
            'services.service': serviceId,
        });

        if (!booking) {
            return res.status(403).json({
                success: false,
                message: 'You can only review a service from a completed booking that belongs to you',
            });
        }

        // Upsert scoped to this specific booking
        const existing = await Review.findOne({
            service: serviceId,
            user:    userId,
            booking: bookingId,
        });

        let savedReview;
        if (existing) {
            existing.rating = rating;
            existing.review = review?.trim() || '';
            savedReview = await existing.save();
        } else {
            savedReview = await Review.create({
                service: serviceId,
                user:    userId,
                booking: bookingId,
                rating,
                review:  review?.trim() || '',
            });
        }

        await savedReview.populate('user', 'name');

        res.status(existing ? 200 : 201).json({
            success: true,
            message: existing ? 'Review updated successfully' : 'Review submitted successfully',
            data: { review: savedReview },
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this service for this booking' });
        }
        next(err);
    }
};

// ─── GET /api/services/:serviceId/reviews ─────────────────────────────────────
exports.getServiceReviews = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip  = (page - 1) * limit;

        const breakdown = await Review.aggregate([
            { $match: { service: require('mongoose').Types.ObjectId.createFromHexString(serviceId) } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
        ]);

        const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        breakdown.forEach(b => { starCounts[b._id] = b.count; });
        const totalReviews = Object.values(starCounts).reduce((a, b) => a + b, 0);

        const reviews = await Review.find({ service: serviceId })
            .populate('user', 'name')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: { totalReviews, starCounts, page, totalPages: Math.ceil(totalReviews / limit), reviews },
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/services/:serviceId/reviews/can-review ─────────────────────────
/**
 * Used by ServiceDetail page.
 * Returns the FIRST completed booking for this service that has no review yet.
 * If all bookings are reviewed it returns the latest review for editing.
 */
exports.checkCanReview = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const userId = req.user._id;

        // All completed bookings that include this service
        const completedBookings = await Booking.find({
            user:               userId,
            status:             'Completed',
            'services.service': serviceId,
        }).select('_id').sort('-createdAt');

        if (!completedBookings.length) {
            return res.status(200).json({
                success: true,
                data: { canReview: false, existingReview: null, bookingId: null },
            });
        }

        const bookingIds = completedBookings.map(b => b._id);

        // Find which bookings already have a review from this user
        const existingReviews = await Review.find({
            service: serviceId,
            user:    userId,
            booking: { $in: bookingIds },
        }).select('booking rating review');

        const reviewedBookingIds = new Set(existingReviews.map(r => r.booking.toString()));

        // Prefer the first unreviewed booking
        const unreviewedBooking = completedBookings.find(b => !reviewedBookingIds.has(b._id.toString()));

        if (unreviewedBooking) {
            return res.status(200).json({
                success: true,
                data: { canReview: true, existingReview: null, bookingId: unreviewedBooking._id },
            });
        }

        // All bookings reviewed — return latest review for editing
        const latestReview = existingReviews[0];
        return res.status(200).json({
            success: true,
            data: {
                canReview:      true,
                existingReview: latestReview,
                bookingId:      latestReview.booking,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/bookings/:bookingId/reviewable-services ────────────────────────
/**
 * Returns services in a completed booking with each service's review status
 * SCOPED TO THIS BOOKING — so re-booking the same service shows a fresh form.
 */
exports.getReviewableServices = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const booking = await Booking.findById(req.params.bookingId)
            .populate('services.service', 'name featuredImage ratingsAverage');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (booking.status !== 'Completed') {
            return res.status(200).json({ success: true, data: { services: [] } });
        }

        // Unique service ids in this booking
        const serviceIds = [...new Set(
            booking.services.map(s => s.service?._id?.toString()).filter(Boolean)
        )];

        // Reviews scoped to THIS booking only
        const existingReviews = await Review.find({
            user:    userId,
            booking: booking._id,          // ← scoped to this booking
            service: { $in: serviceIds },
        }).select('service rating review');

        const reviewedMap = {};
        existingReviews.forEach(r => { reviewedMap[r.service.toString()] = r; });

        // Deduplicate services within the booking
        const services = booking.services
            .filter((s, idx, arr) => {
                const sid = s.service?._id?.toString();
                return sid && arr.findIndex(x => x.service?._id?.toString() === sid) === idx;
            })
            .map(s => ({
                service:        s.service,
                existingReview: reviewedMap[s.service?._id?.toString()] || null,
            }));

        res.status(200).json({ success: true, data: { services, bookingId: booking._id } });
    } catch (err) {
        next(err);
    }
};
