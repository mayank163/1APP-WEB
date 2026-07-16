'use strict';

const Review  = require('../models/Review');
const Booking = require('../models/Booking');
const Service = require('../models/Service');

// ─── POST /api/services/:serviceId/reviews ────────────────────────────────────
/**
 * Create a review for a service.
 * Rules:
 *  - User must have a Completed booking that contains this serviceId.
 *  - If the booking contains multiple services, the same rating/review is
 *    stored once per unique serviceId in that booking (upsert pattern).
 *  - A user can only hold one review per service (unique index on service+user).
 */
exports.createReview = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const userId = req.user._id;
        const { rating, review, bookingId } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Please provide a rating between 1 and 5' });
        }

        // Verify the service exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        // Find a completed booking owned by this user that includes this service
        const bookingQuery = {
            user: userId,
            status: 'Completed',
            'services.service': serviceId,
        };
        if (bookingId) bookingQuery._id = bookingId;

        const booking = await Booking.findOne(bookingQuery);
        if (!booking) {
            return res.status(403).json({
                success: false,
                message: 'You can only review a service after your booking is completed',
            });
        }

        // Upsert: update existing review or create new one
        const existing = await Review.findOne({ service: serviceId, user: userId });
        let savedReview;

        if (existing) {
            existing.rating   = rating;
            existing.review   = review?.trim() || '';
            existing.booking  = booking._id;
            savedReview = await existing.save();
        } else {
            savedReview = await Review.create({
                service: serviceId,
                user:    userId,
                booking: booking._id,
                rating,
                review: review?.trim() || '',
            });
        }

        await savedReview.populate('user', 'name');

        res.status(existing ? 200 : 201).json({
            success: true,
            message: existing ? 'Review updated successfully' : 'Review submitted successfully',
            data: { review: savedReview },
        });
    } catch (err) {
        // Duplicate key error (race condition fallback)
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this service' });
        }
        next(err);
    }
};

// ─── GET /api/services/:serviceId/reviews ─────────────────────────────────────
/**
 * Get all reviews for a service with:
 *  - Aggregated star breakdown (count per star 1-5)
 *  - Sorted by createdAt desc (newest first)
 *  - Pagination via ?page=1&limit=10
 */
exports.getServiceReviews = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip  = (page - 1) * limit;

        // Star breakdown (1-5)
        const breakdown = await Review.aggregate([
            { $match: { service: require('mongoose').Types.ObjectId.createFromHexString(serviceId) } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
        ]);

        const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        breakdown.forEach(b => { starCounts[b._id] = b.count; });
        const totalReviews = Object.values(starCounts).reduce((a, b) => a + b, 0);

        // Paginated reviews
        const reviews = await Review.find({ service: serviceId })
            .populate('user', 'name')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: {
                totalReviews,
                starCounts,
                page,
                totalPages: Math.ceil(totalReviews / limit),
                reviews,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/services/:serviceId/reviews/can-review ─────────────────────────
/**
 * Check whether the logged-in user is eligible to review this service:
 *  - has a Completed booking containing this serviceId
 *  - has not already reviewed it (or has, so we return existing review for edit)
 */
exports.checkCanReview = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const userId = req.user._id;

        const completedBooking = await Booking.findOne({
            user: userId,
            status: 'Completed',
            'services.service': serviceId,
        }).select('_id services');

        if (!completedBooking) {
            return res.status(200).json({
                success: true,
                data: { canReview: false, existingReview: null, bookingId: null },
            });
        }

        const existingReview = await Review.findOne({ service: serviceId, user: userId });

        res.status(200).json({
            success: true,
            data: {
                canReview:      true,
                existingReview: existingReview || null,
                bookingId:      completedBooking._id,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/bookings/:bookingId/reviewable-services ────────────────────────
/**
 * For a completed booking, return which services the user has/hasn't reviewed yet.
 * Used on the booking history page to show "Write Review" buttons.
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
        const serviceIds = [...new Set(booking.services.map(s => s.service?._id?.toString()).filter(Boolean))];

        // Which ones has this user already reviewed?
        const existingReviews = await Review.find({
            user:    userId,
            service: { $in: serviceIds },
        }).select('service rating review');

        const reviewedMap = {};
        existingReviews.forEach(r => { reviewedMap[r.service.toString()] = r; });

        const services = booking.services
            .filter((s, idx, arr) => {
                // deduplicate by service id
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
