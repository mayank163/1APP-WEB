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
  city: {
    type: String,
    default: '',
    trim: true,
  },
  state: {
    type: String,
    default: '',
    trim: true,
  },
  zipCode: {
    type: String,
    default: '',
    trim: true,
  },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  pay: {
    type: {
      type: String,
      enum: ['fixed', 'hourly', 'perDevice', 'blended'],
      default: 'fixed',
    },
    fixedAmount: { type: Number, min: 0, default: 0 },
    hourlyRate: { type: Number, min: 0, default: 0 },
    maxHours: { type: Number, min: 0, default: 0 },
    perDeviceRate: { type: Number, min: 0, default: 0 },
    maxDevices: { type: Number, min: 0, default: 0 },
    blendedFixedAmount: { type: Number, min: 0, default: 0 },
    blendedFixedHours: { type: Number, min: 0, default: 0 },
    blendedHourlyRate: { type: Number, min: 0, default: 0 },
    blendedMaxAddlHours: { type: Number, min: 0, default: 0 },
    approxHours: { type: String, default: '', trim: true },
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
  requestedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['open', 'assigned', 'ontheway', 'visited', 'inprogress', 'in-progress', 'completed', 'checkout', 'closed', 'cancelled'],
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
  reachedAt: {
    type: Date,
    default: null,
  },
  reachedStatus: {
    at: { type: Date, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
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
  completedStatus: {
    at: { type: Date, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
  },
  jobDurationMinutes: {
    type: Number,
    default: null,
    min: 0,
  },
  finalPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  payment: {
    basePrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['unpaid', 'paid', 'pending', 'refunded'],
      default: 'unpaid',
    },
    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
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
  scheduledDate: {
    type: Date,
    default: null,
  },
  jobDate: {
    from: { type: Date, default: null },
    to: { type: Date, default: null },
  },
  workType: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  additionalWorkType: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  serviceType: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  statusHistory: [{
    status: { type: String, trim: true },
    note: { type: String, default: '', trim: true },
    changedAt: { type: Date, default: Date.now },
  }],
  rescheduleHistory: [{
    previousDate: { type: Date, default: null },
    newDate: { type: Date, default: null },
    reason: { type: String, default: '', trim: true },
    rescheduledAt: { type: Date, default: Date.now },
  }],
  preferredSkills: [{
    type: String,
    trim: true,
  }],
  tasks: [{
    title: { type: String, default: '', trim: true },
    group: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
    isDone: { type: Boolean, default: false },
    requiresNote: { type: Boolean, default: false },
    requiresImage: { type: Boolean, default: false },
    requiresSignature: { type: Boolean, default: false },
    requirementReason: { type: String, default: '', trim: true },
    checkedAt: { type: Date, default: null },
    technicianLat: { type: Number, default: null },
    technicianLng: { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
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
