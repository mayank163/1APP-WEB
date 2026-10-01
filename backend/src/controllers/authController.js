const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpService = require('../utils/otpService');
const { normalizePhone, phoneQuery } = require('../utils/phone');
const { uploadFile, deleteFile } = require('../utils/s3Upload');
const {
    sendWelcomeEmail,
    sendLoginNotification,
    sendForgotPasswordEmail,
    sendPasswordResetSuccess,
} = require('../utils/emailService');

const pendingRegistrations = new Map();
const PENDING_REGISTRATION_TTL = 5 * 60 * 1000;

exports.logout = async (req, res, next) => {
    try {
        const token = String(req.body?.fcmToken || '').trim();
        const update = { $inc: { tokenVersion: 1 } };
        if (token) update.$pull = { fcmTokens: token };
        await req.user.constructor.findByIdAndUpdate(req.user._id, update);
        res.json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
        next(error);
    }
};
const signAccessToken = (id, role, tokenVersion = 0) => {
    return jwt.sign(
        { id, role, type: 'access', tokenVersion },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE || '7d'
        }
    );
};

const signRefreshToken = (id, role, tokenVersion = 0) => {
    return jwt.sign(
        { id, role, type: 'refresh', tokenVersion },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d'
        }
    );
};

const sendTokenResponse = (user, statusCode, res) => {
    if (user.accountStatus === 'inactive') return res.status(403).json({ success: false, message: 'This account is inactive. Please create a new account.' });
    if (user.role === 'technician' && ['invited', 'suspended', 'blocked'].includes(user.accountStatus)) return res.status(403).json({ success: false, message: 'Account is pending activation or suspended.' });
    const accessToken = signAccessToken(user._id, user.role, user.tokenVersion);
    const refreshToken = signRefreshToken(user._id, user.role, user.tokenVersion);

    // Hide password
    user.password = undefined;

    res.status(statusCode).json({
        success: true,
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRE || '15m',
        data: {
            user
        }
    });
};

/**
 * @desc    Start user registration and send OTP before creating account
 * @route   POST /api/auth/start-register
 */
exports.startRegister = async (req, res, next) => {
    try {
        const { name, email, password, phone, address } = req.body;

        const emailExists = await User.findOne({ email, accountStatus: { $ne: 'inactive' } });
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const phoneExists = await User.findOne({ phone, accountStatus: { $ne: 'inactive' } });
        if (phoneExists) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }

        pendingRegistrations.set(phone, {
            userData: { name, email, password, phone, address },
            expires: Date.now() + PENDING_REGISTRATION_TTL
        });

        await otpService.sendOTP(phone);

        const otp = otpService.getLastOTP ? otpService.getLastOTP(phone) : null;

        res.status(200).json({
            success: true,
            message: `OTP sent to ${phone}`,
            phone,
            ...(otpService.simulationEnabled() && otp && { devOtp: otp }),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Verify registration OTP and create account
 * @route   POST /api/auth/verify-register
 */
exports.verifyRegister = async (req, res, next) => {
    try {
        const { phone, code, fcmToken } = req.body;

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                message: 'Please provide phone and OTP code'
            });
        }

        const pending = pendingRegistrations.get(phone);
        if (!pending) {
            return res.status(400).json({
                success: false,
                message: 'No pending registration found. Please sign up again.'
            });
        }

        if (Date.now() > pending.expires) {
            pendingRegistrations.delete(phone);
            return res.status(400).json({
                success: false,
                message: 'Registration OTP expired. Please sign up again.'
            });
        }

        const isValid = otpService.verifyOTP(phone, code);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP code'
            });
        }

        const { userData } = pending;

        const emailExists = await User.findOne({ email: userData.email, accountStatus: { $ne: 'inactive' } });
        if (emailExists) {
            pendingRegistrations.delete(phone);
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const phoneExists = await User.findOne({ phone, accountStatus: { $ne: 'inactive' } });
        if (phoneExists) {
            pendingRegistrations.delete(phone);
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }

        const user = await User.create({
            ...userData,
            isPhoneVerified: true,
            ...(fcmToken && { fcmTokens: [String(fcmToken).trim()] })
        });

        pendingRegistrations.delete(phone);

        sendWelcomeEmail(user).catch(err =>
            console.error('Welcome email failed:', err.message)
        );

        sendTokenResponse(user, 201, res);
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 */
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, phone, address } = req.body;

        // Check if user already exists
        const emailExists = await User.findOne({ email, accountStatus: { $ne: 'inactive' } });
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const phoneExists = await User.findOne({ phone, accountStatus: { $ne: 'inactive' } });
        if (phoneExists) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }


        

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            address
        });

        // Trigger SMS verification code
        try {
            await otpService.sendOTP(phone);
        } catch (smsError) {
            console.error('Failed to trigger initial OTP:', smsError.message);
        }

        // Send welcome email (non-blocking)
        sendWelcomeEmail(user).catch(err =>
            console.error('Welcome email failed:', err.message)
        );

        sendTokenResponse(user, 201, res);
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 */
exports.login = async (req, res, next) => {
    try {
        const { email, phone, password, fcmToken } = req.body;

        if ((!email && !phone) || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email or phone and password'
            });
        }

        const query = email
            ? { email: email.trim().toLowerCase() }
            : phoneQuery(normalizePhone(phone));
        const user = await User.findOne(query).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email/phone or password'
            });
        }

        if (user.accountStatus === 'inactive') {
            return res.status(403).json({ success: false, message: 'This account is inactive. Please create a new account.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email/phone or password'
            });
        }

        // Send login notification email (non-blocking)
        sendLoginNotification(user).catch(err =>
            console.error('Login notification email failed:', err.message)
        );

        if (fcmToken && String(fcmToken).length <= 4096) {
            await User.findByIdAndUpdate(user._id, {
                $addToSet: { fcmTokens: String(fcmToken).trim() },
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            success: true,
            data: {
                user
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Deactivate the current account without deleting its data
 * @route   DELETE /api/auth/me
 */
exports.deleteMe = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { accountStatus: 'inactive', isOnline: false }, $inc: { tokenVersion: 1 } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'Account deactivated successfully.' });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Update user profile (name, phone, addresses array)
 * @route   PUT /api/auth/me
 *
 * addresses operations (all optional, applied in order):
 *   addAddress    – { label, addressLine, city, state, zipcode, isDefault? }
 *   updateAddress – { id, label?, addressLine?, city?, state?, zipcode?, isDefault? }
 *   removeAddress – addressId string
 *   setDefaultAddress – addressId string
 */
exports.updateMe = async (req, res, next) => {
    try {
        const { name, phone, dateOfBirth, dob, gender, alternateContact, addAddress, updateAddress, removeAddress, setDefaultAddress } = req.body;

        const user = await User.findById(req.user.id);

        if (name) user.name = name;

        if (dateOfBirth !== undefined || dob !== undefined) user.dateOfBirth = (dateOfBirth ?? dob) || null;
        if (gender !== undefined) user.gender = String(gender).trim();
        if (alternateContact !== undefined) user.alternateContact = String(alternateContact).trim();

        if (phone && phone !== user.phone) {
            const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already in use by another account'
                });
            }
            user.phone = phone;
            user.isPhoneVerified = false;
            try {
                await otpService.sendOTP(phone);
            } catch (smsError) {
                console.error(smsError.message);
            }
        }

        // --- Address management ---

        // ADD a new address
        if (addAddress) {
            const { label = 'Home', addressLine, city = '', state = '', zipcode = '', isDefault = false, coordinates } = addAddress;
            if (!addressLine || !addressLine.trim()) {
                return res.status(400).json({ success: false, message: 'addressLine is required when adding an address' });
            }
            if (isDefault) {
                // Clear existing default flag
                user.addresses.forEach(a => { a.isDefault = false; });
            }
            user.addresses.push({
                label, addressLine: addressLine.trim(), city, state, zipcode,
                isDefault: isDefault || user.addresses.length === 0,
                coordinates: coordinates?.lat ? { lat: coordinates.lat, lng: coordinates.lng } : { lat: null, lng: null }
            });
        }

        // UPDATE an existing address by _id
        if (updateAddress) {
            const { id, coordinates, ...fields } = updateAddress;
            const addr = user.addresses.id(id);
            if (!addr) {
                return res.status(404).json({ success: false, message: 'Address not found' });
            }
            if (fields.isDefault) {
                user.addresses.forEach(a => { a.isDefault = false; });
            }
            Object.assign(addr, fields);
            if (coordinates?.lat) {
                addr.coordinates = { lat: coordinates.lat, lng: coordinates.lng };
            }
        }

        // REMOVE an address by _id
        if (removeAddress) {
            const idx = user.addresses.findIndex(a => a._id.toString() === removeAddress);
            if (idx !== -1) {
                const wasDefault = user.addresses[idx].isDefault;
                user.addresses.splice(idx, 1);
                // Promote first remaining address as default if deleted one was default
                if (wasDefault && user.addresses.length > 0) {
                    user.addresses[0].isDefault = true;
                }
            }
        }

        // SET default address by _id
        if (setDefaultAddress) {
            user.addresses.forEach(a => {
                a.isDefault = a._id.toString() === setDefaultAddress;
            });
        }

        await user.save();

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Upload / replace user profile image
 * @route   POST /api/auth/me/avatar
 */
exports.uploadProfileImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an image file' });
        }

        const user = await User.findById(req.user.id);

        // Delete old image from S3 if one exists
        if (user.profileImage?.s3Key) {
            await deleteFile(user.profileImage.s3Key).catch(err =>
                console.error('Failed to delete old profile image:', err.message)
            );
        }

        const { key } = await uploadFile(req.file, 'profile-images');
        const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        user.profileImage = { url: imageUrl, s3Key: key };
        await user.save();

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Forgot password - send OTP to phone or email
 * @route   POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
    try {
        const { identifier } = req.body; // phone or email
        if (!identifier) {
            return res.status(400).json({ success: false, message: 'Please provide email or phone number' });
        }

        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
            accountStatus: { $ne: 'inactive' }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with this email or phone' });
        }

        await otpService.sendOTP(user.phone);

        // Also send OTP via email if user has an email (non-blocking)
        if (user.email) {
            const otp = otpService.getLastOTP ? otpService.getLastOTP(user.phone) : null;
            if (otp) {
                sendForgotPasswordEmail(user, otp).catch(err =>
                    console.error('Forgot password email failed:', err.message)
                );
            }
        }

        // Only expose simulated codes in explicitly enabled local development.
        const devOtp = otpService.getLastOTP ? otpService.getLastOTP(user.phone) : null;

        res.status(200).json({
            success: true,
            message: `OTP sent to registered phone ${user.phone}`,
            phone: user.phone,
            ...(otpService.simulationEnabled() && devOtp && { devOtp }),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Reset password - verify OTP and set new password
 * @route   POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
    try {
        const { phone, otp, newPassword } = req.body;

        if (!phone || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide phone, otp and newPassword' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const isValid = otpService.verifyOTP(phone, otp);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.accountStatus === 'inactive') {
            return res.status(403).json({ success: false, message: 'This account is inactive. Please create a new account.' });
        }

        user.password = newPassword;
        await user.save();

        // Send password reset success email (non-blocking)
        sendPasswordResetSuccess(user).catch(err =>
            console.error('Password reset success email failed:', err.message)
        );

        res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Change password for the authenticated account
 * @route   PUT /api/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (typeof oldPassword !== 'string' || !oldPassword || typeof newPassword !== 'string' || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide your old and new passwords.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }
        if (oldPassword === newPassword) {
            return res.status(400).json({ success: false, message: 'New password must be different from your old password.' });
        }

        const account = await req.user.constructor.findById(req.user._id).select('+password');
        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }
        if (!await account.comparePassword(oldPassword)) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        account.password = newPassword;
        await account.save();
        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Google OAuth login — finds existing account by email
 * @route   POST /api/auth/google
 */
exports.googleLogin = async (req, res, next) => {
    try {
        const { accessToken, fcmToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'Access token is required' });
        }

        // Verify the token with Google and get user info
        const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!googleRes.ok) {
            return res.status(401).json({ success: false, message: 'Invalid Google access token' });
        }

        const googleData = await googleRes.json();
        const { email, name } = googleData;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Could not retrieve email from Google' });
        }

        // Find existing user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this Google email. Please sign up first.',
            });
        }

        if (user.accountStatus === 'inactive') {
            return res.status(403).json({ success: false, message: 'This account is inactive. Please create a new account.' });
        }

        if (fcmToken && String(fcmToken).length <= 4096) {
            await User.findByIdAndUpdate(user._id, { $addToSet: { fcmTokens: String(fcmToken).trim() } });
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Request phone verification OTP
 * @route   POST /api/auth/send-otp
 */
exports.sendVerificationOTP = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isPhoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already verified'
            });
        }

        await otpService.sendOTP(user.phone);

        res.status(200).json({
            success: true,
            message: `OTP sent to ${user.phone}`
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Verify phone number using OTP code
 * @route   POST /api/auth/verify-otp
 */
exports.verifyVerificationOTP = async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Please provide the OTP code'
            });
        }

        const user = await User.findById(req.user.id);
        const isValid = otpService.verifyOTP(user.phone, code);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP code'
            });
        }

        user.isPhoneVerified = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Phone number verified successfully',
            data: { user }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Generate new access token using refresh token
 * @route   POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET || 'your_super_secret_refresh_key'
            );
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token expired. Please login again.'
                });
            }

            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Make sure this is actually a refresh token
        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token type'
            });
        }

        // Check that user still exists
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }

        if (user.accountStatus === 'inactive') return res.status(403).json({ success: false, message: 'This account is inactive. Please create a new account.' });
        if (user.role === 'technician' && ['invited', 'suspended', 'blocked'].includes(user.accountStatus)) return res.status(403).json({ success: false, message: 'Account is pending activation or suspended.' });
        if ((user.tokenVersion || 0) > 0 && decoded.tokenVersion !== user.tokenVersion) return res.status(401).json({ success: false, message: 'Refresh token has been revoked.' });

        // Generate new access token
        const accessToken = signAccessToken(user._id, user.role, user.tokenVersion);

        res.status(200).json({
            success: true,
            accessToken,
            expiresIn: process.env.JWT_EXPIRE || '15m'
        });

    } catch (err) {
        next(err);
    }
};
