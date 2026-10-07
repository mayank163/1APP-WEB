const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Admin = require('../models/Admin');
const { buildBookingInvoice } = require('../utils/bookingInvoiceData');

exports.getInvoice = async (req, res, next) => {
    try {
        if (!mongoose.isObjectIdOrHexString(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('services.service', 'name');
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        const ownerId = booking.user?._id || booking.user;
        const isAdmin = req.user instanceof Admin && req.user.isActive !== false;
        const isOwner = ownerId != null && String(ownerId) === String(req.user.id || req.user._id);
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized access' });
        }
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).json({ success: true, data: { invoice: buildBookingInvoice(booking) } });
    } catch (error) {
        next(error);
    }
};
