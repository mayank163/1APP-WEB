const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true
    },
    email: {
        type: String,
        required: function () { return this.role !== 'technician'; },
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false
    },
    phone: {
        type: String,
        required: [true, 'Please provide a phone number'],
        trim: true
    },
    // Legacy single address (kept for backward compat, no longer primary)
    address: {
        type: String,
        default: ''
    },
    // Structured multi-address list
    addresses: [
        {
            label: { type: String, default: 'Home', trim: true },    // type category: Home / Office / Work / Other
            name: { type: String, default: '', trim: true },         // custom nickname: "My Home", "Friend's Home", etc.
            addressLine: { type: String, default: '', trim: true },  // street / flat / building
            city: { type: String, default: '', trim: true },
            state: { type: String, default: '', trim: true },
            zipcode: { type: String, default: '', trim: true },
            isDefault: { type: Boolean, default: false },
            coordinates: {
                lat: { type: Number, default: null },
                lng: { type: Number, default: null }
            }
        }
    ],
    role: {
        type: String,
        enum: ['user', 'admin', 'technician'],
        default: 'user'
    },
    technicianId: { type: String, unique: true, sparse: true },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    accountStatus: { type: String, enum: ['active', 'inactive', 'invited', 'suspended', 'blocked'], default: 'active' },
    tokenVersion: { type: Number, default: 0 },
    technicianAdminNote: { type: String, default: '', maxlength: 1000, select: false },
    dateOfBirth: Date,
    gender: {
        type: String,
        trim: true,
        default: ''
    },
    alternateContact: {
        type: String,
        trim: true,
        default: ''
    },
    primaryService: { type: String, default: '' },
    serviceArea: { type: String, default: '' },
    serviceRadius: { type: Number, min: 1, max: 500, default: 15 },
    isOnline: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    skills: [{
        type: String,
        trim: true
    }],
    experienceLevel: {
        type: String,
        default: 'Beginner'
    },
    certifications: [{
        type: String,
        trim: true
    }],
    bankDetails: {
        accountHolder: { type: String, default: '' },
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        upiId: { type: String, default: '' },
        blankCheque: { type: String, default: '' }
    },
    profileCompleted: {
        type: Boolean,
        default: false
    },
    technicianProfile: {
        skills: [{ type: String, trim: true }],
        experienceLevel: { type: String, default: 'Beginner' },
        yearsOfExperience: { type: Number, default: 0 },
        certifications: [{ type: String, trim: true }],
        photoUrl: { type: String, default: '' },
        portfolioPhotos: [{ type: String, trim: true }],
        previousCompanyName: { type: String, default: '' },
        certificateImages: [{ type: String, trim: true }],
        professionalBio: { type: String, default: '' },
        drivingLicense: {
            issuedDate: { type: Date, default: null },
            expiryDate: { type: Date, default: null },
            front: { type: String, default: '' },
            back:  { type: String, default: '' },
        },
        residentialProof: { type: String, default: '' },
        taxInformation: {
            w9Form:   { type: String, default: '' },
            form1099: { type: String, default: '' },
        },
        cvResume: { type: String, default: '' },
        backgroundVerification: { type: String, default: '' },
        verificationStatus: {
            type: String,
            enum: ['not-started', 'pending', 'approved', 'rejected'],
            default: 'not-started'
        },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
        verificationNotes: { type: String, default: '' },
        submittedAt: { type: Date, default: null },
        documents: [{
            documentId: { type: String, required: true },   // e.g. 'panCard', 'aadhaar'
            label:      { type: String, default: '' },
            s3Key:      { type: String, default: '' },
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected'],
                default: 'pending'
            },
            rejectionReason: { type: String, default: null }
        }]
    },
    rating: { type: Number, default: null },
    ratingCount: { type: Number, default: 0 },
    workOrderRatings: [{
        job: { type: mongoose.Schema.Types.ObjectId, ref: 'TechnicianJob' },
        score: { type: Number, min: 1, max: 5 },
        ratedAt: Date
    }],
    customerBookingRatings: [{
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        score: { type: Number, min: 1, max: 5 },
        review: { type: String, default: '', maxlength: 500 },
        ratedAt: Date
    }],
    totalJobsDone: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    profileImage: {
        url: { type: String, default: '' },
        s3Key: { type: String, default: '' }
    },
    fcmTokens: {
    type: [String],
    default: [],    
    },
    cart: [
        {
            service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
            quantity: { type: Number, default: 1, min: 1 },
            variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
            variantName: { type: String, default: '', trim: true },
            variantPrice: { type: Number, default: null, min: 0 },
            selectedAddons: [{
                addonId: { type: mongoose.Schema.Types.ObjectId, default: null },
                name: { type: String, default: '', trim: true },
                price: { type: Number, default: 0, min: 0 }
            }]
        }
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true
});

// Inactive accounts retain their data but release email and phone for signup.
const usableAccountStatuses = ['active', 'invited', 'suspended', 'blocked'];
userSchema.index(
    { email: 1 },
    { unique: true, sparse: true, partialFilterExpression: { accountStatus: { $in: usableAccountStatuses } } }
);
userSchema.index(
    { phone: 1 },
    { unique: true, partialFilterExpression: { accountStatus: { $in: usableAccountStatuses } } }
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
