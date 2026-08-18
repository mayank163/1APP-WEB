const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not logged in.' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let currentUser;
        if (decoded.role === 'admin') {
            currentUser = await Admin.findById(decoded.id);
        }
        if (!currentUser) {
            currentUser = await User.findById(decoded.id);
        }
        if (!currentUser) {
            return res.status(401).json({ success: false, message: 'User no longer exists.' });
        }
        req.user = currentUser;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role || 'admin')) {
            return res.status(403).json({ success: false, message: 'You do not have permission.' });
        }
        next();
    };
};

// RBAC: check if admin has access to a resource
// access: 'read' | 'write' | 'both'
const checkPermission = (resource, requiredAccess) => {
    return (req, res, next) => {
        const admin = req.user;
        // Super admins bypass all permission checks
        if (admin.isSuperAdmin) return next();

        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: 'Your account is inactive.' });
        }

        const perm = (admin.permissions || []).find(p => p.resource === resource);
        if (!perm) {
            return res.status(403).json({ success: false, message: `No access to ${resource}.` });
        }

        const allowed =
            perm.access === 'both' ||
            perm.access === requiredAccess ||
            (requiredAccess === 'read' && perm.access === 'both') ||
            (requiredAccess === 'write' && perm.access === 'both');

        if (!allowed) {
            return res.status(403).json({ success: false, message: `You only have ${perm.access} access to ${resource}.` });
        }
        next();
    };
};

module.exports = { protect, restrictTo, checkPermission };
