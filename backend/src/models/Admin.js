const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RESOURCES = [
    'dashboard', 'bookings', 'categories', 'subcategories',
    'services', 'users', 'offers', 'technician_jobs',
    'technician_verification', 'blogs', 'sub_admins',
    'work_types', 'service_types'
];

const ADMIN_ROLES = [
    'admin',
    'operations_dispatch',
    'support_agents',
    'read_only_analyst'
];

const permissionSchema = new mongoose.Schema({
    resource: { type: String, enum: RESOURCES, required: true },
    access: { type: String, enum: ['read', 'write', 'both'], required: true }
}, { _id: false });

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, default: 'read_only_analyst' },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    permissions: [permissionSchema],
    walletBalance: { type: Number, default: 0, min: 0 },
    walletTransactions: [{
        type: { type: String, enum: ['technician_payment'], required: true },
        job: { type: mongoose.Schema.Types.ObjectId, ref: 'TechnicianJob', required: true },
        amount: { type: Number, required: true, min: 0 },
        note: { type: String, default: '', trim: true },
        createdAt: { type: Date, default: Date.now },
    }]
}, { timestamps: true });

// Hash password before saving
adminSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

adminSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
module.exports.RESOURCES = RESOURCES;
module.exports.ADMIN_ROLES = ADMIN_ROLES;
