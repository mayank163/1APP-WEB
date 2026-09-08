const mongoose = require('mongoose');

// e.g. "Installation", "Maintenance", "Diagnosis", "Repair", "Replacement"
const serviceTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Service type name is required'],
        trim: true,
        unique: true
    },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ServiceType', serviceTypeSchema);
