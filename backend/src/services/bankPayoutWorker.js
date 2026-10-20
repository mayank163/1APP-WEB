const crypto = require('crypto');
const mongoose = require('mongoose');
const Withdrawal = require('../models/TechnicianWithdrawal');
const User = require('../models/User');
const provider = require('./bankPayoutProvider');
const { decrypt } = require('./manualPayouts');
const RETRY_MS = 60000;
async function prepareApproval(w, session) {
  provider.assertConfigured();
  const mode = provider.mode();
  const bank = decrypt(w.encryptedBankSnapshot);
  const fingerprint = provider.fingerprint(bank); // Requires complete US bank fields.
  let recipient;
  if (mode === 'hyperwallet-mock') recipient = { userToken:`usr-mock-${w.technician}`,bankToken:`trm-mock-${w._id}`,programToken:'mock-program' };
  else {
    recipient = await require('../models/TechnicianPayoutRecipient').findOne({ technician:w.technician,provider:mode,programToken:process.env.HYPERWALLET_PROGRAM_TOKEN }).select('+bankFingerprint').session(session);
    if (!recipient || recipient.bankFingerprint !== fingerprint) throw Object.assign(new Error('Link a verified sandbox bank recipient matching this withdrawal before approval.'),{ statusCode:409 });
  }
  w.status = 'processing';
  w.payout = { provider:mode,programToken:recipient.programToken,userToken:recipient.userToken,bankToken:recipient.bankToken,state:'queued',attempts:0,nextAttemptAt:new Date() };
}
async function settle(w, payment, owner) {
  provider.verifyPayment(payment,w);
  await mongoose.connection.transaction(async session => {
    const current = await Withdrawal.findOne({ _id:w._id,'payout.leaseOwner':owner }).session(session);
    if (!current) return;
    const user = await User.findOneAndUpdate({ _id:current.technician },{ $inc:{ payoutVersion:1 } },{ session,returnDocument: 'after' });
    if (!user) throw new Error('Technician is unavailable.');
    const now = new Date();
    current.payout.paymentToken = payment.token;
    current.payout.providerStatus = payment.status;
    current.payout.reconciledAt = now;
    current.payout.leaseUntil = null;
    current.payout.leaseOwner = null;
    current.payout.lastError = '';
    if (payment.status === 'COMPLETED') {
      if (current.status !== 'paid') {
        current.status = 'paid'; current.paidAt = now; current.transferReference = payment.token;
        await User.updateOne({ _id:user._id },{ $inc:{ totalWithdrawn:current.amountCents/100 } },{ session });
        current.auditHistory.push({ action:'provider_paid',at:now,note:current.payout.provider === 'hyperwallet-mock' ? 'SIMULATED payout; no funds moved.' : 'Sandbox bank payout completed; no live funds moved.' });
      }
      current.payout.state = 'completed';
      // Continue monitoring completed payouts for later returns.
      current.payout.nextAttemptAt = new Date(Date.now()+3600000);
    } else if (['FAILED','RETURNED','CANCELLED','EXPIRED'].includes(payment.status) || current.status === 'paid') {
      current.payout.state = 'attention';
      current.payout.lastError = `Provider status ${payment.status}. Reconcile funds before releasing or reversing wallet accounting.`;
      current.auditHistory.push({ action:'provider_attention',at:now,note:current.payout.lastError });
    } else {
      current.payout.state = 'submitted';
      current.payout.nextAttemptAt = new Date(Date.now()+RETRY_MS);
    }
    await current.save({ session });
  });
}
async function processOne() {
  if (provider.mode() === 'manual') return false;
  provider.assertConfigured();
  const now = new Date(), owner = crypto.randomUUID();
  const w = await Withdrawal.findOneAndUpdate({
    status:{ $in:['processing','paid'] },'payout.provider':provider.mode(),
    'payout.state':{ $in:['queued','working','unknown','submitted','completed'] },
    'payout.nextAttemptAt':{ $lte:now },
    $or:[{ 'payout.leaseUntil':null },{ 'payout.leaseUntil':{ $lte:now } }]
  },{ $set:{ 'payout.leaseOwner':owner,'payout.leaseUntil':new Date(Date.now()+120000),'payout.state':'working' } },{ returnDocument: 'after',sort:{ 'payout.nextAttemptAt':1 } }).select('+encryptedBankSnapshot');
  if (!w) return false;
  try {
    let payment = await provider.lookup(w);
    if (!payment) {
      // An earlier POST may have succeeded even when its response was lost.
      // Never create a second payment after an uncertain attempt.
      if (w.payout.attempts > 0) throw new Error('Previous submission has an uncertain outcome. No new payment was created; reconcile using the client payment ID.');
      if (w.payout.provider === 'hyperwallet-sandbox') {
        if (w.payout.programToken !== process.env.HYPERWALLET_PROGRAM_TOKEN) throw new Error('Payout program configuration changed.');
        await provider.verifyRecipient(w.technician,w.payout.userToken,w.payout.bankToken,decrypt(w.encryptedBankSnapshot));
      }
      const recorded = await Withdrawal.updateOne({ _id:w._id,'payout.leaseOwner':owner },{ $inc:{ 'payout.attempts':1 },$set:{ 'payout.attemptedAt':new Date() } });
      if (!recorded.modifiedCount) return true;
      payment = await provider.submit(w);
    }
    await settle(w,payment,owner);
  } catch(e) {
    // No provider payload, credentials or bank data are logged or persisted.
    const message = e.statusCode ? e.message : 'Payout outcome uncertain or provider unavailable. Reconciliation will retry; reserved funds are retained.';
    await Withdrawal.updateOne({ _id:w._id,'payout.leaseOwner':owner },{ $set:{ 'payout.state':'unknown','payout.lastError':message,'payout.nextAttemptAt':new Date(Date.now()+RETRY_MS),'payout.leaseOwner':null,'payout.leaseUntil':null } });
  }
  return true;
}
let running = false;
function start() {
  if (provider.mode() === 'manual') return;
  provider.assertConfigured();
  const tick = async () => {
    if (running) return;
    running = true;
    try { for (let i=0;i<10;i++) if (!await processOne()) break; }
    catch { console.error('Sandbox bank payout worker could not reconcile. Check database and provider configuration.'); }
    finally { running = false; }
  };
  tick();
  const timer = setInterval(tick,10000); timer.unref();
  return timer;
}
module.exports = { prepareApproval,processOne,settle,start };
