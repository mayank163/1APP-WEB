const mongoose = require('mongoose');

// Sub-work-type (e.g. "Access Control", "Burglar Alarm")
const workSubTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Sub-work-type name is required'],
        trim: true
    },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Top-level work type (e.g. "Camera & Alarms", "Access Control Systems")
const workTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Work type name is required'],
        trim: true,
        unique: true
    },
    description: { type: String, trim: true, default: '' },
    subTypes: [workSubTypeSchema],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WorkType', workTypeSchema);
