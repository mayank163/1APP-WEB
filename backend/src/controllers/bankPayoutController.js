const mongoose = require('mongoose');
const provider = require('../services/bankPayoutProvider');
const User = require('../models/User');
const Recipient = require('../models/TechnicianPayoutRecipient');
const Withdrawal = require('../models/TechnicianWithdrawal');
const { onboardingBank,fail } = require('../services/manualPayouts');
exports.linkRecipient = async (req,res,next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.technicianId)) throw fail('Invalid technician ID.');
    if (provider.mode() !== 'hyperwallet-sandbox') throw fail('Recipient linking is only available in Hyperwallet sandbox mode.',409);
    const user = await User.findOne({ _id:req.params.technicianId,role:'technician' });
    if (!user) throw fail('Technician not found.',404);
    const bank = onboardingBank(user);
    if (!bank) throw fail('Technician onboarding bank details are unavailable.');
    const bankFingerprint = provider.fingerprint(bank);
    const { userToken,bankToken } = req.body || {};
    await provider.verifyRecipient(user._id,userToken,bankToken,bank);
    await mongoose.connection.transaction(async session => {
      const current = await User.findOneAndUpdate({ _id:user._id },{ $inc:{ payoutVersion:1 } },{ new:true,session });
      if (provider.fingerprint(onboardingBank(current)) !== bankFingerprint) throw fail('Bank details changed during linking. Try again.',409);
      await Recipient.findOneAndUpdate({ technician:user._id,provider:provider.mode(),programToken:process.env.HYPERWALLET_PROGRAM_TOKEN },{ $set:{ userToken,bankToken,bankFingerprint,linkedBy:req.user._id,linkedAt:new Date() } },{ upsert:true,session });
    });
    res.json({ success:true,message:'Sandbox recipient verified and linked to the onboarding bank account.' });
  } catch(e) { next(e); }
};
exports.reconcile = async (req,res,next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw fail('Invalid withdrawal ID.');
    const w = await Withdrawal.findOneAndUpdate({ _id:req.params.id,status:{ $in:['processing','paid'] },'payout.provider':{ $in:['hyperwallet-mock','hyperwallet-sandbox'] } },{
      $set:{ 'payout.nextAttemptAt':new Date(),'payout.state':'unknown' },
      $push:{ auditHistory:{ action:'reconciliation_requested',actor:req.user._id,at:new Date() } }
    },{ new:true });
    if (!w) throw fail('Automatic payout not found.',404);
    res.json({ success:true,message:'Reconciliation queued. This does not create another payment.' });
  } catch(e) { next(e); }
};
exports.confirmReturned = async (req,res,next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw fail('Invalid withdrawal ID.');
    if (req.body?.fundsReturnedConfirmed !== true || typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.length > 1000) throw fail('Confirm non-delivery/return and provide a reason (1–1000 characters).');
    const w = await Withdrawal.findById(req.params.id);
    if (!w || !w.payout?.provider || !['processing','paid'].includes(w.status)) throw fail('Automatic payout is unavailable for return confirmation.',409);
    provider.assertConfigured();
    if (w.payout.provider !== provider.mode()) throw fail('Enable the original sandbox provider to reconcile this payout.',409);
    const payment = await provider.lookup(w);
    if (!payment) throw fail('Provider payment could not be found. Keep funds reserved.',409);
    provider.verifyPayment(payment,w);
    if (!['FAILED','RETURNED','CANCELLED','EXPIRED'].includes(payment.status)) throw fail('Provider has not confirmed a failed, returned, cancelled or expired payout.',409);
    await mongoose.connection.transaction(async session => {
      const current = await Withdrawal.findById(w._id).session(session);
      await User.updateOne({ _id:current.technician },{ $inc:{ payoutVersion:1 } },{ session });
      if (!['processing','paid'].includes(current.status)) throw fail('Payout has already been resolved.',409);
      if (current.status === 'paid') await User.updateOne({ _id:current.technician },{ $inc:{ totalWithdrawn:-current.amountCents/100 } },{ session });
      current.status = 'failed'; current.failureReason = req.body.reason.trim();
      current.payout.providerStatus = payment.status; current.payout.state = 'attention';
      current.payout.lastError = ''; current.payout.leaseOwner = null; current.payout.leaseUntil = null;
      current.auditHistory.push({ action:'provider_return_confirmed',actor:req.user._id,at:new Date(),note:current.failureReason });
      await current.save({ session });
    });
    res.json({ success:true,message:'Return confirmed and wallet funds released.' });
  } catch(e) { next(e); }
};
