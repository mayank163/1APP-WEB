const mongoose = require('mongoose');
const User = require('../models/User');
const Bank = require('../models/TechnicianPayoutBank');
const Withdrawal = require('../models/TechnicianWithdrawal');
const { onboardingBank, fail, encrypt, decrypt, validateBank, amountCents, balance } = require('../services/manualPayouts');
const wrap = fn => async (req,res,next) => { try {
  if (req.body === undefined) req.body = {};
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw fail('Request body must be a JSON object.');
  await fn(req,res);
} catch(e) { next(e); } };
const bankProvider = require('../services/bankPayoutProvider');
const validId = id => { if (!mongoose.isValidObjectId(id)) throw fail('Invalid withdrawal ID.'); };
const masked = bank => bank ? { accountHolder: bank.accountHolder, bankName: bank.bankName, accountType: bank.accountType, last4: bank.last4, version: bank.version, updatedAt: bank.updatedAt } : null;
async function lockUser(id, session) {
  const user = await User.findOneAndUpdate({ _id: id, role: 'technician' }, { $inc: { payoutVersion: 1 } }, { returnDocument: 'after', session });
  if (!user) throw fail('Technician not found.', 404);
  return user;
}
exports.getBank = wrap(async (req,res) => {
  const user = await User.findById(req.user._id);
  const details = onboardingBank(user);
  const bank = details ? { ...details, last4: details.accountNumber.slice(-4), version: user.bankDetails.version || 1, updatedAt: user.updatedAt } : await Bank.findOne({ technician: req.user._id });
  res.json({ success: true, data: { bank: masked(bank) } });
});
exports.saveBank = wrap(async (req,res) => {
  const details = validateBank(req.body);
  const encryptedDetails = encrypt(details);
  let bank;
  await mongoose.connection.transaction(async session => {
    await lockUser(req.user._id, session);
    bank = await Bank.findOneAndUpdate({ technician: req.user._id }, {
      $set: { encryptedDetails, accountHolder: details.accountHolder, bankName: details.bankName, accountType: details.accountType, last4: details.accountNumber.slice(-4) },
      $inc: { version: 1 }
    }, { upsert: true, returnDocument: 'after', session, setDefaultsOnInsert: false });
  });
  res.json({ success: true, data: { bank: masked(bank) } });
});
exports.wallet = wrap(async (req,res) => {
  // Use one transaction snapshot so concurrent settlement cannot produce a mixed balance.
  let wallet;
  await mongoose.connection.transaction(async session => {
    const user = await User.findById(req.user._id).session(session);
    const withdrawals = await Withdrawal.find({ technician: req.user._id }).session(session).lean();
    if (!user) throw fail('Technician not found.', 404);
    wallet = balance(user, withdrawals);
  }, { readConcern: { level: 'snapshot' } });
  res.json({ success: true, data: { wallet } });
});
exports.request = wrap(async (req,res) => {
  const value = amountCents(req.body);
  const requestKey = req.get('Idempotency-Key');
  if (!requestKey || !/^[A-Za-z0-9_-]{8,100}$/.test(requestKey)) throw fail('Idempotency-Key header is required (8–100 letters, numbers, underscores or hyphens).');
  let withdrawal, created = false;
  await mongoose.connection.transaction(async session => {
    const user = await lockUser(req.user._id, session);
    withdrawal = await Withdrawal.findOne({ technician: user._id, requestKey }).session(session);
    if (withdrawal) {
      if (withdrawal.amountCents !== value) throw fail('Idempotency key already used for a different amount.', 409);
      return;
    }
    const details = onboardingBank(user);
    const bank = details ? {
      ...details, last4: details.accountNumber.slice(-4), version: user.bankDetails.version || 1,
      encryptedDetails: encrypt(details)
    } : await Bank.findOne({ technician: user._id }).select('+encryptedDetails').session(session);
    if (!bank) throw fail('Your onboarding bank details are unavailable. Contact support to update your profile before requesting a withdrawal.');
    const withdrawals = await Withdrawal.find({ technician: user._id }).session(session).lean();
    if (value > balance(user, withdrawals).availableCents) throw fail('Withdrawal amount exceeds available balance.');
    [withdrawal] = await Withdrawal.create([{
      technician: user._id, amount: value/100, amountCents: value, currency: 'USD', requestKey,
      method: 'bank-transfer', bankSnapshot: masked(bank), encryptedBankSnapshot: bank.encryptedDetails,
      auditHistory: [{ action: 'requested', actor: user._id, at: new Date() }]
    }], { session });
    created = true;
  });
  // Never serialize encrypted fields even when present on a newly created document.
  const safe = withdrawal.toObject(); delete safe.encryptedBankSnapshot;
  res.status(created ? 201 : 200).json({ success: true, data: { withdrawal: safe } });
});
exports.history = wrap(async (req,res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!Number.isSafeInteger(page)) throw fail('Invalid page.');
  const filter = { technician: req.user._id };
  const [withdrawals,total] = await Promise.all([Withdrawal.find(filter).sort('-createdAt').skip((page-1)*20).limit(20), Withdrawal.countDocuments(filter)]);
  res.json({ success: true, data: { withdrawals, pagination: { page, limit: 20, total } } });
});
exports.list = wrap(async (req,res) => {
  const filter = {};
  if (req.query.status) {
    if (!['pending','approved','processing','sent','paid','rejected','cancelled','failed'].includes(req.query.status)) throw fail('Invalid status.');
    filter.status = req.query.status;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!Number.isSafeInteger(page)) throw fail('Invalid page.');
  const [withdrawals,total] = await Promise.all([Withdrawal.find(filter).populate('technician','name email phone technicianId').sort('-createdAt').skip((page-1)*20).limit(20), Withdrawal.countDocuments(filter)]);
  res.json({ success: true, data: { withdrawals, pagination: { page, limit: 20, total }, payoutMode: bankProvider.mode() } });
});
exports.bankDestination = wrap(async (req,res) => {
  validId(req.params.id);
  const w = await Withdrawal.findById(req.params.id).select('+encryptedBankSnapshot');
  if (!w) throw fail('Withdrawal not found.',404);
  if (!['pending','approved'].includes(w.status)) throw fail('Bank destination is only available before sending.',409);
  if (!w.encryptedBankSnapshot) throw fail('Legacy request has no bank snapshot. Reject it and ask the technician to submit a new request.',409);
  const bank = decrypt(w.encryptedBankSnapshot);
  await Withdrawal.updateOne({ _id: w._id }, { $push: { auditHistory: { action: 'bank_details_viewed', actor: req.user._id, at: new Date() } } });
  res.set('Cache-Control','no-store').json({ success: true, data: { bank } });
});
exports.transition = wrap(async (req,res) => {
  validId(req.params.id);
  const rules = { approve: ['pending','approved'], reject: ['pending','rejected'], cancel: ['approved','cancelled'], 'mark-sent': ['approved','sent'], 'mark-paid': ['sent','paid'], 'mark-failed': ['sent','failed'] };
  const rule = rules[req.params.action];
  if (!rule) throw fail('Unknown payout action.',404);
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const reference = typeof req.body.transferReference === 'string' ? req.body.transferReference.trim() : '';
  if (['reject','cancel','mark-failed'].includes(req.params.action) && (!reason || reason.length > 1000)) throw fail('A reason of 1–1000 characters is required.');
  if (req.params.action === 'mark-sent' && (!reference || reference.length > 200)) throw fail('A bank transfer reference of 1–200 characters is required.');
  if (req.params.action === 'mark-paid' && req.body.paymentCompletedConfirmed !== true) throw fail('Confirm the bank transfer completed successfully.');
  if (req.params.action === 'mark-failed' && req.body.fundsReturnedConfirmed !== true) throw fail('Confirm funds were not delivered or have been returned before releasing the reservation.');
  let withdrawal;
  await mongoose.connection.transaction(async session => {
    withdrawal = await Withdrawal.findById(req.params.id).select('+encryptedBankSnapshot').session(session);
    if (!withdrawal) throw fail('Withdrawal not found.',404);
    await lockUser(withdrawal.technician,session);
    if (withdrawal.payout?.provider && req.params.action !== 'approve') throw fail('Automatic payouts must be reconciled with the provider. Manual payment actions are disabled.',409);
    if (req.params.action === 'approve' && withdrawal.payout?.provider && ['processing','paid'].includes(withdrawal.status)) return;
    if (withdrawal.status === rule[1]) {
      if (req.params.action === 'mark-sent' && withdrawal.transferReference !== reference) throw fail('A different bank reference is already recorded.',409);
      return;
    }
    if (withdrawal.status !== rule[0]) throw fail(`Cannot ${req.params.action} a ${withdrawal.status} withdrawal.`,409);
    if (req.params.action === 'approve' && !withdrawal.encryptedBankSnapshot) throw fail('Legacy request has no US bank snapshot. Reject it and request a new withdrawal.',409);
    withdrawal.status = rule[1];
    const now = new Date();
    if (req.params.action === 'approve') {
      withdrawal.approvedBy = req.user._id; withdrawal.approvedAt = now;
      if (bankProvider.mode() !== 'manual') await require('../services/bankPayoutWorker').prepareApproval(withdrawal,session);
    }
    if (req.params.action === 'reject' || req.params.action === 'cancel') withdrawal.rejectionReason = reason;
    if (req.params.action === 'mark-sent') { withdrawal.transferReference = reference; withdrawal.sentAt = now; }
    if (req.params.action === 'mark-failed') withdrawal.failureReason = reason;
    if (req.params.action === 'mark-paid') {
      withdrawal.paidAt = now;
      await User.updateOne({ _id: withdrawal.technician }, { $inc: { totalWithdrawn: withdrawal.amountCents/100 } }, { session });
    }
    withdrawal.auditHistory.push({ action: req.params.action, actor: req.user._id, at: now, note: reason || reference });
    await withdrawal.save({ session });
  });
  const safe = withdrawal.toObject(); delete safe.encryptedBankSnapshot;
  res.json({ success: true, data: { withdrawal: safe } });
});
