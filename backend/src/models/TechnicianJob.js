const mongoose = require('mongoose');

const technicianJobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
  },
  categoryInfo: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    name: { type: String, default: '', trim: true },
    subcategory: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', default: null },
      name: { type: String, default: '', trim: true },
      service: {
        _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
        name: { type: String, default: '', trim: true },
      },
    },
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true,
  },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
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
    enum: ['open', 'assigned', 'visited', 'inprogress', 'completed', 'cancelled'],
    default: 'open',
  },
  // Full audit trail of every status change with optional admin note
  statusHistory: [{
    status:    { type: String, trim: true },
    note:      { type: String, default: '', trim: true },
    changedAt: { type: Date, default: Date.now },
  }],
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
  // All reached-event data in one object
  reachedStatus: {
    at:             { type: Date,   default: null },
    lat:            { type: Number, default: null },
    lng:            { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
  },
  jobStartedAt: {
    type: Date,
    default: null,
  },
  jobCompletedAt: {
    type: Date,
    default: null,
  },
  // All completed-event data in one object
  completedStatus: {
    at:             { type: Date,   default: null },
    lat:            { type: Number, default: null },
    lng:            { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
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
  serviceDate: {
    type: Date,
    default: null,
  },
  scheduledDate: {
    type: Date,
    default: null,
  },
  rescheduleHistory: [{
    previousDate: { type: Date },
    newDate: { type: Date },
    reason: { type: String, default: '' },
    rescheduledAt: { type: Date, default: Date.now },
  }],
  preferredSkills: [{
    type: String,
    trim: true,
  }],
  // Technician IDs who have sent a request for this job
  requestedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  conversation: [{
    sender: { type: String, enum: ['admin', 'technician', 'system'], default: 'system' },
    message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
  tasks: [{
    title:          { type: String, required: true, trim: true },
    group:          { type: String, default: '', trim: true },
    order:          { type: Number, default: 0 },
    isDone:         { type: Boolean, default: false },
    checkedAt:      { type: Date, default: null },
    technicianLat:  { type: Number, default: null },
    technicianLng:  { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('TechnicianJob', technicianJobSchema);
