const Booking = require('../models/Booking');
const User = require('../models/User');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const { sendBookingStatusUpdated } = require('../utils/emailService');

const signToken = (id, role) => {
    return jwt.sign(
        { id, role },
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

/**
 * @desc    Admin login
 * @route   POST /api/admin/login
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

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
        const query = {};

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        let bookings = await Booking.find(query)
            .populate('user')
            .populate('services.service')
            .sort('-createdAt');

        // Manual search filtering if search term is provided
        if (search) {
            const searchLower = search.toLowerCase();
            bookings = bookings.filter(b => {
                const userMatch = b.user && (b.user.name.toLowerCase().includes(searchLower) || b.user.email.toLowerCase().includes(searchLower));
                const addressMatch = b.address.toLowerCase().includes(searchLower);
                const phoneMatch = b.phone.includes(searchLower);
                const idMatch = b._id.toString().includes(searchLower);
                return userMatch || addressMatch || phoneMatch || idMatch;
            });
        }

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

        if (status) booking.status = status;
        if (paymentStatus) booking.paymentStatus = paymentStatus;

        if (technicianName || technicianPhone) {
            booking.assignedTechnician = {
                name: technicianName || booking.assignedTechnician.name,
                phone: technicianPhone || booking.assignedTechnician.phone
            };
        }

        await booking.save();

        const updatedBooking = await Booking.findById(req.params.id)
            .populate('user')
            .populate('services.service');

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
        const users = await User.find({ role: 'user' }).sort('-createdAt');
        res.status(200).json({
            success: true,
            count: users.length,
            data: { users }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Create a secondary admin
 * @route   POST /api/admin/register
 */
exports.registerAdmin = async (req, res, next) => {
    try {
        const { name, email, password, permissions } = req.body;

        const emailExists = await Admin.findOne({ email });
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use by another admin'
            });
        }

        const admin = await Admin.create({
            name,
            email,
            password,
            permissions: permissions || ['manage_bookings', 'manage_services']
        });

        res.status(201).json({
            success: true,
            message: 'Secondary Admin created successfully',
            data: {
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    permissions: admin.permissions
                }
            }
        });
    } catch (err) {
        next(err);
    }
};
