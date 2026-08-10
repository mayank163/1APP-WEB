const mongoose = require('mongoose');

const technicianWithdrawalSchema = new mongoose.Schema({
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'rejected'],
    default: 'pending',
  },
  method: {
    type: String,
    enum: ['bank-transfer', 'upi', 'wallet'],
    default: 'bank-transfer',
  },
  details: {
    type: String,
    default: '',
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TechnicianWithdrawal', technicianWithdrawalSchema);
