const mongoose = require('mongoose');
module.exports = mongoose.model('TechnicianPayoutBank', new mongoose.Schema({
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  encryptedDetails: { type: String, required: true, select: false },
  accountHolder: String, bankName: String, accountType: String, last4: String,
  version: { type: Number, default: 1 }
}, { timestamps: true }));
