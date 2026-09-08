const mongoose = require('mongoose');

const technicianJobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true,
  },
  city:    { type: String, default: '', trim: true },
  state:   { type: String, default: '', trim: true },
  zipCode: { type: String, default: '', trim: true },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  // ── Structured pay ────────────────────────────────────────────────────────
  // type: 'hourly' | 'fixed' | 'perDevice' | 'blended'
  pay: {
    type: {
      type: String,
      enum: ['hourly', 'fixed', 'perDevice', 'blended'],
      default: 'fixed',
    },
    // ── Fixed ──────────────────────────────────────────────────────────────
    fixedAmount:          { type: Number, default: 0, min: 0 },
    // ── Hourly ─────────────────────────────────────────────────────────────
    hourlyRate:           { type: Number, default: 0, min: 0 },
    maxHours:             { type: Number, default: 0, min: 0 },
    // ── Per Device ─────────────────────────────────────────────────────────
    perDeviceRate:        { type: Number, default: 0, min: 0 },
    maxDevices:           { type: Number, default: 0, min: 0 },
    // ── Blended ────────────────────────────────────────────────────────────
    blendedFixedAmount:   { type: Number, default: 0, min: 0 },
    blendedFixedHours:    { type: Number, default: 0, min: 0 },
    blendedHourlyRate:    { type: Number, default: 0, min: 0 },
    blendedMaxAddlHours:  { type: Number, default: 0, min: 0 },
    // ── Shared optional ────────────────────────────────────────────────────
    approxHours:          { type: String, default: '', trim: true },
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
  reachedAt: { type: Date, default: null },
  reachedStatus: {
    at:             { type: Date,   default: null },
    lat:            { type: Number, default: null },
    lng:            { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
  },
  jobStartedAt:   { type: Date, default: null },
  jobCompletedAt: { type: Date, default: null },
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
  completedAt:  { type: Date, default: null },
  scheduledDate:{ type: Date, default: null },
  visibleTo: {
    type: String,
    enum: ['all', 'technicians'],
    default: 'technicians',
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

  // ── Work type (primary) ────────────────────────────────────────────────────
  workType: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'WorkType', default: null },
    name: { type: String, default: '', trim: true },
    subType: {
      _id:  { type: mongoose.Schema.Types.ObjectId, default: null },
      name: { type: String, default: '', trim: true },
    },
  },

  // ── Additional / secondary work type ──────────────────────────────────────
  additionalWorkType: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'WorkType', default: null },
    name: { type: String, default: '', trim: true },
    subType: {
      _id:  { type: mongoose.Schema.Types.ObjectId, default: null },
      name: { type: String, default: '', trim: true },
    },
  },

  // ── Service type (e.g. Installation, Maintenance, Diagnosis) ──────────────
  serviceType: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceType', default: null },
    name: { type: String, default: '', trim: true },
  },

  // ── Job Date window ────────────────────────────────────────────────────────
  // Admin sets a date/time range during which the technician should arrive.
  // e.g. from: 2026-09-10T09:00Z  to: 2026-09-10T17:00Z
  jobDate: {
    from: { type: Date, default: null },  // window start (arrive after)
    to:   { type: Date, default: null },  // window end   (arrive before)
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TechnicianJob', technicianJobSchema);
