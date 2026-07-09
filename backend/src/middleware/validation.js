const { body, validationResult } = require('express-validator');

// Helper to handle validation errors
const checkValidationResult = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
        });
    }
    next();
};

const validateRegister = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    checkValidationResult
];

const validateVerifyRegister = [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Please provide a valid 6-digit OTP'),
    checkValidationResult
];

const validateLogin = [
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    checkValidationResult
];

const validateBooking = [
    body('services').isArray({ min: 1 }).withMessage('At least one service must be selected'),
    body('services.*.service').notEmpty().withMessage('Service ID is required'),
    body('services.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('serviceDate').notEmpty().withMessage('Service date is required'),
    body('timeSlot').notEmpty().withMessage('Time slot is required'),
    checkValidationResult
];

const validateService = [
    body('name').trim().notEmpty().withMessage('Service name is required'),
    body('description').trim().notEmpty().withMessage('Service description is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('subcategory').trim().notEmpty().withMessage('Subcategory is required'),
    checkValidationResult
];

module.exports = {
    validateRegister,
    validateVerifyRegister,
    validateLogin,
    validateBooking,
    validateService
};
