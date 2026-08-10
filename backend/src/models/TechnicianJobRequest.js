const mongoose = require('mongoose');

const technicianJobRequestSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnicianJob',
    required: true,
  },
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  note: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'counter-offer'],
    default: 'pending',
  },
  adminMessage: {
    type: String,
    default: '',
    trim: true,
  },
  counterOffer: {
    type: Number,
    default: 0,
    min: 0,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'pending'],
    default: 'unpaid',
  },
  amountEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TechnicianJobRequest', technicianJobRequestSchema);
