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
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
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
        unique: true,
        trim: true
    },
    address: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'technician'],
        default: 'user'
    },
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
        drivingLicense: {
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
    cart: [
        {
            service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
            quantity: { type: Number, default: 1, min: 1 }
        }
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true
});

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
