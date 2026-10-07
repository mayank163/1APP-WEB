const Booking = require('../models/Booking');
const User = require('../models/User');
const Admin = require('../models/Admin');
const PlanPurchase = require('../models/PlanPurchase');
const Review = require('../models/Review');
const Service = require('../models/Service');
const TechnicianJob = require('../models/TechnicianJob');
const AdditionalCharge = require('../models/AdditionalCharge');
const { RESOURCES, ADMIN_ROLES } = require('../models/Admin');
const jwt = require('jsonwebtoken');
const { sendBookingStatusUpdated } = require('../utils/emailService');
const notificationService = require('../services/notificationService');
const { ensureTechnicianJobForBooking } = require('../services/bookingTechnicianJobSync');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const signToken = (id, role) => {
    return jwt.sign(
        { id, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

/**
 * @desc    Admin login
 * @route   POST /api/admin/login
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password, fcmToken } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check if admin exists
        const admin = await Admin.findOne({ email }).select('+password');
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        // Check password matches
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        // Store FCM token if provided (web or mobile login)
        if (fcmToken && String(fcmToken).length <= 4096) {
            await Admin.findByIdAndUpdate(admin._id, {
                $addToSet: { fcmTokens: String(fcmToken).trim() }
            });
        }

        const token = signToken(admin._id, 'admin');

        res.status(200).json({
            success: true,
            token,
            data: {
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    isSuperAdmin: admin.isSuperAdmin,
                    isActive: admin.isActive,
                    permissions: admin.permissions
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get Admin Dashboard Stats
 * @route   GET /api/admin/stats
 */
exports.getDashboardStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = {};

        if (startDate) {
            const parsedStartDate = new Date(startDate);
            if (Number.isNaN(parsedStartDate.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid startDate' });
            }
            dateFilter.$gte = parsedStartDate;
        }

        if (endDate) {
            const parsedEndDate = new Date(endDate);
            if (Number.isNaN(parsedEndDate.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid endDate' });
            }
            dateFilter.$lt = parsedEndDate;
        }

        const bookingFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
        const [totalUsers, totalBookings, revenueResult, bookingStatusCounts] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            Booking.countDocuments(bookingFilter),
            Booking.aggregate([
                { $match: { ...bookingFilter, paymentStatus: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
            ]),
            Booking.aggregate([
                { $match: bookingFilter },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);

        const statusCounts = bookingStatusCounts.reduce((counts, item) => {
            counts[item._id] = item.count;
            return counts;
        }, { Pending: 0, Confirmed: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 });

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    totalBookings,
                    totalRevenue: revenueResult[0]?.total || 0,
                    paidBookings: revenueResult[0]?.count || 0,
                    statusCounts
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get all bookings (Admin filterable)
 * @route   GET /api/admin/bookings
 */
exports.getAllBookings = async (req, res, next) => {
    try {
        const { status, paymentStatus, search, sort = 'newest' } = req.query;
        const { page, limit, skip } = getPagination(req.query);
        const query = {};

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        if (search) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const matchingUsers = await User.find({ role: 'user', $or: [{ name: searchRegex }, { email: searchRegex }] }).select('_id');
            const matchingServices = await Service.find({ name: searchRegex }).select('_id');
            const searchConditions = [
                { 'address.addressLine': searchRegex },
                { 'address.city': searchRegex },
                { 'services.service': { $in: matchingServices.map(service => service._id) } },
                { phone: searchRegex },
                { user: { $in: matchingUsers.map(user => user._id) } }
            ];
            if (/^[a-f\d]{24}$/i.test(search.trim())) searchConditions.push({ _id: search.trim() });
            query.$or = searchConditions;
        }

        const total = await Booking.countDocuments(query);
        const bookings = await Booking.find(query)
            .populate('user')
            .populate('services.service')
            .sort(({ oldest: { createdAt: 1 }, appointment: { serviceDate: 1 }, 'amount-desc': { totalAmount: -1 }, 'amount-asc': { totalAmount: 1 } })[sort] || { createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const jobs = await TechnicianJob.find({ sourceBooking: { $in: bookings.map(b => b._id) } }).select('sourceBooking statusHistory jobDate');
        const charges = await AdditionalCharge.find({ job: { $in: jobs.map(job => job._id) } }).select('job label description requestedAmount agreedAmount status');
        const jobByBooking = new Map(jobs.map(job => [String(job.sourceBooking), job]));
        const bookingData = bookings.map(booking => {
            const job = jobByBooking.get(String(booking._id));
            return { ...booking.toObject(), tracking: job || null, additionalCharges: job ? charges.filter(charge => String(charge.job) === String(job._id)) : [] };
        });
        res.status(200).json({
            success: true,
            count: total,
            data: { bookings: bookingData },
            pagination: getPaginationMeta({ page, limit, total })
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Update Booking status and technician assignment
 * @route   PUT /api/admin/bookings/:id
 */
exports.updateBookingStatus = async (req, res, next) => {
    try {
        const { status, paymentStatus, technicianName, technicianPhone } = req.body;

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const previouslyAssigned = Boolean(
            booking.assignedTechnician?.name || booking.assignedTechnician?.phone
        );
        const assigningTechnician = Boolean(technicianName || technicianPhone);
        const statusChanged = Boolean(status && status !== booking.status);
        const updates = {};

        if (status) updates.status = status;
        if (paymentStatus) updates.paymentStatus = paymentStatus;
        if (assigningTechnician) updates.assignedTechnician = {
            name: technicianName || booking.assignedTechnician?.name || '',
            phone: technicianPhone || booking.assignedTechnician?.phone || ''
        };

        await Booking.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

        const updatedBooking = await Booking.findById(req.params.id)
            .populate('user')
            .populate('services.service');

        if (updatedBooking.status === 'Confirmed') {
            try {
                await ensureTechnicianJobForBooking(updatedBooking, req.user._id, req.user);
            } catch (error) {
                console.error('Confirmed booking work order creation failed:', error.message);
            }
        }

        if (updatedBooking.user?._id) {
            let notification = null;

            if (statusChanged) {
                const statusMessages = {
                    Pending: 'Your booking is pending confirmation.',
                    Confirmed: 'Your booking has been confirmed.',
                    Assigned: `A technician has been assigned to your booking${updatedBooking.assignedTechnician?.name ? `: ${updatedBooking.assignedTechnician.name}` : ''}.`,
                    'On the Way': 'Your technician is on the way.',
                    'In Progress': 'Your service is now in progress.',
                    Checkout: 'Your technician has completed the work and it is awaiting checkout.',
                    Completed: 'Your booking has been completed.',
                    Cancelled: 'Your booking has been cancelled.',
                };
                notification = {
                    type: 'booking_status_updated',
                    title: `Booking ${updatedBooking.status}`,
                    message: statusMessages[updatedBooking.status] || `Your booking status is now ${updatedBooking.status}.`,
                };
            } else if (!previouslyAssigned && assigningTechnician) {
                notification = {
                    type: 'technician_assigned',
                    title: 'Technician Assigned',
                    message: `${updatedBooking.assignedTechnician.name || 'A technician'} has been assigned to your booking.`,
                };
            }

            if (notification) {
                notificationService.sendToUser(updatedBooking.user._id, {
                    ...notification,
                    data: {
                        bookingId: String(updatedBooking._id),
                        status: updatedBooking.status,
                        technicianName: updatedBooking.assignedTechnician?.name || '',
                        technicianPhone: updatedBooking.assignedTechnician?.phone || '',
                    },
                }, req.user).catch(err =>
                    console.error('Customer booking notification failed:', err.message)
                );
            }
        }

        // Send status update email to user (non-blocking)
        sendBookingStatusUpdated(updatedBooking).catch(err =>
            console.error('Booking status update email failed:', err.message)
        );

        res.status(200).json({
            success: true,
            message: 'Booking updated successfully',
            data: { booking: updatedBooking }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get all registered users
 * @route   GET /api/admin/users
 */
exports.getAllUsers = async (req, res, next) => {
    try {
        const { search, sort = 'newest', status, registration, activity, membership } = req.query;
        const { page, limit, skip } = getPagination(req.query);
        const query = { role: 'user' };
        if (status === 'active') query.accountStatus = 'active';
        if (status === 'blocked') query.accountStatus = { $in: ['inactive', 'blocked', 'suspended'] };
        if (['30', '90', '365'].includes(registration)) query.createdAt = { $gte: new Date(Date.now() - Number(registration) * 86400000) };
        if (activity === 'has' || activity === 'none') {
            const ids = await Booking.distinct('user');
            query._id = activity === 'has' ? { $in: ids } : { $nin: ids };
        }
        if (['active', 'expired', 'none'].includes(membership)) {
            const planQuery = membership === 'active' ? { status: 'active', $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }] } : membership === 'expired' ? { $or: [{ status: 'expired' }, { expiresAt: { $lte: new Date() } }] } : {};
            const ids = await PlanPurchase.distinct('user', planQuery);
            query.$and = [{ _id: membership === 'none' ? { $nin: ids } : { $in: ids } }];
        }
        if (search) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
            if (/^[a-f\d]{24}$/i.test(search.trim())) query.$or.push({ _id: search.trim() });
        }
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .sort(sort === 'asc' ? { name: 1 } : sort === 'desc' ? { name: -1 } : { createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const userIds = users.map(user => user._id);
        const purchases = await PlanPurchase.find({ user: { $in: userIds } }).sort({ createdAt: -1 });
        const purchasesByUser = new Map();
        purchases.forEach(purchase => {
            const key = String(purchase.user);
            if (!purchasesByUser.has(key)) purchasesByUser.set(key, []);
            purchasesByUser.get(key).push(purchase);
        });
        const bookings = await Booking.find({ user: { $in: userIds } }).populate('services.service', 'name image').sort({ serviceDate: -1 });
        const bookingsByUser = new Map();
        bookings.forEach(booking => {
            const key = String(booking.user);
            if (!bookingsByUser.has(key)) bookingsByUser.set(key, []);
            bookingsByUser.get(key).push(booking);
        });
        const reviews = await Review.find({ user: { $in: userIds } }).populate('service', 'name').sort({ createdAt: -1 });
        const reviewsByUser = new Map();
        reviews.forEach(review => {
            const key = String(review.user);
            if (!reviewsByUser.has(key)) reviewsByUser.set(key, []);
            reviewsByUser.get(key).push(review);
        });
        const usersWithPlans = users.map(user => ({
            ...user.toObject(),
            planPurchases: purchasesByUser.get(String(user._id)) || [],
            bookings: bookingsByUser.get(String(user._id)) || [],
            reviews: reviewsByUser.get(String(user._id)) || []
        }));
        res.status(200).json({
            success: true,
            count: total,
            data: { users: usersWithPlans },
            pagination: getPaginationMeta({ page, limit, total })
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Change a customer's account status
 * @route   PATCH /api/admin/users/:id/status
 */
exports.createCustomer = async (req, res, next) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name?.trim() || !email?.trim() || !phone?.trim() || !password || password.length < 6) return res.status(400).json({ success: false, message: 'Name, email, phone and a password of at least six characters are required.' });
        if (await User.exists({ email: email.trim().toLowerCase() })) return res.status(409).json({ success: false, message: 'Email already in use.' });
        const user = await User.create({ name, email, phone, password, role: 'user', accountStatus: 'active' });
        const safeUser = user.toObject();
        delete safeUser.password;
        res.status(201).json({ success: true, data: { user: safeUser } });
    } catch (err) { next(err); }
};

exports.updateCustomer = async (req, res, next) => {
    try {
        const updates = {};
        for (const key of ['name', 'email', 'phone', 'dateOfBirth', 'addresses']) {
            if (req.body[key] !== undefined) updates[key] = key === 'dateOfBirth' ? req.body[key] || null : req.body[key];
        }
        if (updates.email) {
            updates.email = updates.email.trim().toLowerCase();
            if (await User.exists({ email: updates.email, _id: { $ne: req.params.id } })) return res.status(409).json({ success: false, message: 'Email already in use.' });
        }
        const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'user' }, { $set: updates }, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ success: false, message: 'Customer not found.' });
        res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
};

exports.updateUserAccountStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
        }

        const user = await User.findOneAndUpdate(
            { _id: req.params.id, role: 'user' },
            { $set: { accountStatus: status, ...(status === 'inactive' ? { isOnline: false } : {}) }, $inc: { tokenVersion: 1 } },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'Customer not found.' });

        res.json({ success: true, message: `Customer account ${status}.`, data: { user } });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Create a sub-admin with RBAC permissions
 * @route   POST /api/admin/sub-admins
 */
exports.createSubAdmin = async (req, res, next) => {
    try {
        const { name, email, password, role, permissions } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
        }

        if (await Admin.findOne({ email })) {
            return res.status(400).json({ success: false, message: 'Email already in use.' });
        }

        const selectedRole = ADMIN_ROLES.includes(role) ? role : 'read_only_analyst';
        const validPerms = (permissions || []).filter(
            p => RESOURCES.includes(p.resource) && ['read', 'write', 'both'].includes(p.access)
        );

        const admin = await Admin.create({ name, email, password, role: selectedRole, isSuperAdmin: false, permissions: validPerms });

        res.status(201).json({
            success: true,
            message: 'Sub-admin created successfully.',
            data: { admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, isActive: admin.isActive, permissions: admin.permissions } }
        });
    } catch (err) { next(err); }
};

/**
 * @desc    Get all sub-admins
 * @route   GET /api/admin/sub-admins
 */
exports.getSubAdmins = async (req, res, next) => {
    try {
        const admins = await Admin.find({ isSuperAdmin: false }).sort('-createdAt');
        const normalizedAdmins = admins.map(admin => {
            const data = admin.toObject();
            if (data.role === 'verification') data.role = 'admin';
            return data;
        });
        res.status(200).json({ success: true, data: { admins: normalizedAdmins } });
    } catch (err) { next(err); }
};

/**
 * @desc    Update sub-admin permissions / status
 * @route   PUT /api/admin/sub-admins/:id
 */
exports.updateSubAdmin = async (req, res, next) => {
    try {
        const { permissions, isActive, name, role, password } = req.body;
        const admin = await Admin.findById(req.params.id);
        if (!admin || admin.isSuperAdmin) {
            return res.status(404).json({ success: false, message: 'Sub-admin not found.' });
        }

        if (admin.role === 'verification') admin.role = 'admin';
        if (name) admin.name = name;
        if (role && ADMIN_ROLES.includes(role)) admin.role = role;
        if (password) admin.password = password;
        if (typeof isActive === 'boolean') admin.isActive = isActive;
        if (permissions) {
            admin.permissions = permissions.filter(
                p => RESOURCES.includes(p.resource) && ['read', 'write', 'both'].includes(p.access)
            );
        }

        await admin.save();
        res.status(200).json({ success: true, message: 'Sub-admin updated.', data: { admin } });
    } catch (err) { next(err); }
};

/**
 * @desc    Delete sub-admin
 * @route   DELETE /api/admin/sub-admins/:id
 */
exports.deleteSubAdmin = async (req, res, next) => {
    try {
        const admin = await Admin.findById(req.params.id);
        if (!admin || admin.isSuperAdmin) {
            return res.status(404).json({ success: false, message: 'Sub-admin not found.' });
        }
        await admin.deleteOne();
        res.status(200).json({ success: true, message: 'Sub-admin deleted.' });
    } catch (err) { next(err); }
};

/**
 * @desc    Get available RBAC resources
 * @route   GET /api/admin/sub-admins/resources
 */
exports.getResources = (req, res) => {
    res.status(200).json({ success: true, data: { resources: RESOURCES } });
};
