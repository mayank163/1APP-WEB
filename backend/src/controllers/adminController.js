const Booking = require('../models/Booking');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { RESOURCES, ADMIN_ROLES } = require('../models/Admin');
const jwt = require('jsonwebtoken');
const { sendBookingStatusUpdated } = require('../utils/emailService');
const notificationService = require('../services/notificationService');
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
        // 1) General metrics
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalBookings = await Booking.countDocuments();
        
        // Revenue (sum totalAmount for paid bookings)
        const revenueResult = await Booking.aggregate([
            { $match: { paymentStatus: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Bookings count by status
        const pendingCount = await Booking.countDocuments({ status: 'Pending' });
        const confirmedCount = await Booking.countDocuments({ status: 'Confirmed' });
        const inProgressCount = await Booking.countDocuments({ status: 'In Progress' });
        const completedCount = await Booking.countDocuments({ status: 'Completed' });
        const cancelledCount = await Booking.countDocuments({ status: 'Cancelled' });

        // 2) Aggregated data for Recharts (last 7 days of sales)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const chartDataResult = await Booking.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo },
                    paymentStatus: 'Paid'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$totalAmount' },
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format chart data to ensure we have entries (fill in gaps if no bookings on some days)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            
            const existingDay = chartDataResult.find(item => item._id === dateString);
            chartData.push({
                date: dateString,
                revenue: existingDay ? existingDay.revenue : 0,
                bookings: existingDay ? existingDay.bookings : 0
            });
        }

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    totalBookings,
                    totalRevenue,
                    statusCounts: {
                        Pending: pendingCount,
                        Confirmed: confirmedCount,
                        InProgress: inProgressCount,
                        Completed: completedCount,
                        Cancelled: cancelledCount
                    }
                },
                chartData
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
        const { status, paymentStatus, search } = req.query;
        const { page, limit, skip } = getPagination(req.query);
        const query = {};

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        if (search) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const matchingUsers = await User.find({ role: 'user', $or: [{ name: searchRegex }, { email: searchRegex }] }).select('_id');
            const searchConditions = [
                { address: searchRegex },
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
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

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

        if (updatedBooking.user?._id) {
            let notification = null;

            if (statusChanged) {
                const statusMessages = {
                    Pending: 'Your booking is pending confirmation.',
                    Confirmed: 'Your booking has been confirmed.',
                    'In Progress': 'Your service is now in progress.',
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
        const { search, sort = 'newest' } = req.query;
        const { page, limit, skip } = getPagination(req.query);
        const query = { role: 'user' };
        if (search) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
        }
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .sort(sort === 'asc' ? { name: 1 } : sort === 'desc' ? { name: -1 } : { createdAt: -1 })
            .skip(skip)
            .limit(limit);
        res.status(200).json({
            success: true,
            count: total,
            data: { users },
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
