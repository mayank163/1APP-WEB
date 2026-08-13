const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RESOURCES = [
    'dashboard', 'bookings', 'categories', 'subcategories',
    'services', 'users', 'offers', 'technician_jobs',
    'technician_verification', 'blogs', 'sub_admins'
];

const permissionSchema = new mongoose.Schema({
    resource: { type: String, enum: RESOURCES, required: true },
    access: { type: String, enum: ['read', 'write', 'both'], required: true }
}, { _id: false });

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    permissions: [permissionSchema]
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
