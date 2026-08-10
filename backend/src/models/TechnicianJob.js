const mongoose = require('mongoose');

const technicianJobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
  },
  category: {
    type: String,
    default: 'General Service',
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true,
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: 0,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  requirements: [{
    type: String,
    trim: true,
  }],
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'visited', 'in-progress', 'completed', 'closed'],
    default: 'open',
  },
  assignedTechnician: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  assignedRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnicianJobRequest',
    default: null,
  },
  estimatedTime: {
    type: String,
    default: '',
    trim: true,
  },
  reachedAt: {
    type: Date,
    default: null,
  },
  jobStartedAt: {
    type: Date,
    default: null,
  },
  jobCompletedAt: {
    type: Date,
    default: null,
  },
  jobDurationMinutes: {
    type: Number,
    default: null,
  },
  finalPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  visibleTo: {
    type: String,
    enum: ['all', 'technicians'],
    default: 'technicians',
  },
  deadline: {
    type: Date,
    default: null,
  },
  preferredSkills: [{
    type: String,
    trim: true,
  }],
  conversation: [{
    sender: { type: String, enum: ['admin', 'technician', 'system'], default: 'system' },
    message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('TechnicianJob', technicianJobSchema);
