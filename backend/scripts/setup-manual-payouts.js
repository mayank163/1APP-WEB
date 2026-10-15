// Run from the backend directory: node scripts/setup-manual-payouts.js
// Creates additive indexes only. It does not change existing wallet totals.
require('dotenv').config();
const mongoose = require('mongoose');
const Bank = require('../src/models/TechnicianPayoutBank');
const Withdrawal = require('../src/models/TechnicianWithdrawal');
(async () => {
  try {
    if (!/^[a-f\d]{64}$/i.test(process.env.PAYOUT_BANK_ENCRYPTION_KEY || '')) throw new Error('Set PAYOUT_BANK_ENCRYPTION_KEY to 64 hex characters.');
    if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI.');
    await mongoose.connect(process.env.MONGODB_URI);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Manual payouts require a MongoDB replica set or sharded cluster.');
    await Bank.createIndexes();
    await Withdrawal.createIndexes();
    await require('../src/models/TechnicianPayoutRecipient').createIndexes();
    const legacy = await Withdrawal.countDocuments({ status:'pending',encryptedBankSnapshot:{ $exists:false } });
    console.log(`Payout indexes ready. Legacy pending requests requiring review/resubmission: ${legacy}. Existing wallet totals were not modified.`);
  } catch(e) {
    console.error(`Payout setup failed (${e.name}). Check encryption configuration, MongoDB transaction support, connectivity, and index conflicts.`);
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
})();
