const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpService = require('../utils/otpService');
const {
    sendWelcomeEmail,
    sendLoginNotification,
    sendForgotPasswordEmail,
    sendPasswordResetSuccess,
} = require('../utils/emailService');

const pendingRegistrations = new Map();
const PENDING_REGISTRATION_TTL = 5 * 60 * 1000;

const signToken = (id, role) => {
    return jwt.sign(
        { id, role },
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const sendTokenResponse = (user, statusCode, res) => {
    const token = signToken(user._id, user.role);

    // Hide password
    user.password = undefined;

    res.status(statusCode).json({
        success: true,
        token,
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

        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const phoneExists = await User.findOne({ phone });
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

        res.status(200).json({
            success: true,
            message: `OTP sent to ${phone}`,
            phone
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
        const { phone, code } = req.body;

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

        const emailExists = await User.findOne({ email: userData.email });
        if (emailExists) {
            pendingRegistrations.delete(phone);
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const phoneExists = await User.findOne({ phone });
        if (phoneExists) {
            pendingRegistrations.delete(phone);
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }

        const user = await User.create({
            ...userData,
            isPhoneVerified: true
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
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const phoneExists = await User.findOne({ phone });
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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if password matches
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Send login notification email (non-blocking)
        sendLoginNotification(user).catch(err =>
            console.error('Login notification email failed:', err.message)
        );

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
 * @desc    Update user profile
 * @route   PUT /api/auth/me
 */
exports.updateMe = async (req, res, next) => {
    try {
        const { name, phone, address } = req.body;

        const user = await User.findById(req.user.id);

        if (name) user.name = name;

        if (phone && phone !== user.phone) {
            // Check if phone already registered by another user
            const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already in use by another account'
                });
            }
            user.phone = phone;
            user.isPhoneVerified = false; // Reset verification

            // Trigger OTP for new phone
            try {
                await otpService.sendOTP(phone);
            } catch (smsError) {
                console.error(smsError.message);
            }
        }

        if (address !== undefined) user.address = address;

        await user.save();

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
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }]
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

        res.status(200).json({
            success: true,
            message: `OTP sent to registered phone ${user.phone}`,
            phone: user.phone
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
