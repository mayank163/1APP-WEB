const crypto = require('crypto');
const { fail, validateBank } = require('./manualPayouts');
const SANDBOX = 'https://api.sandbox.hyperwallet.com/rest/v4';
function mode() {
  const value = process.env.PAYOUT_PROVIDER || 'manual';
  if (!['manual','hyperwallet-mock','hyperwallet-sandbox'].includes(value)) throw fail('Unsupported payout provider. Live payouts are not enabled.',503);
  return value;
}
function assertConfigured() {
  if (mode() === 'manual') throw fail('Automatic bank payouts are disabled.',409);
  if (mode() === 'hyperwallet-sandbox' && (!process.env.HYPERWALLET_USERNAME || !process.env.HYPERWALLET_PASSWORD || !/^prg-[\w-]+$/.test(process.env.HYPERWALLET_PROGRAM_TOKEN || '') || process.env.HYPERWALLET_STRAIGHT_THROUGH !== 'true')) throw fail('Configure sandbox credentials and confirm an Embedded Straight-Through bank payout program.',503);
}
function fingerprint(bank) {
  const b = validateBank(bank);
  const secret = process.env.PAYOUT_BANK_ENCRYPTION_KEY;
  if (!/^[a-f\d]{64}$/i.test(secret || '')) throw fail('Payout bank encryption is not configured.',503);
  return crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(JSON.stringify([b.accountHolder,b.routingNumber,b.accountNumber,b.accountType])).digest('hex');
}
async function request(path, { body } = {}, fetcher = fetch) {
  assertConfigured();
  const response = await fetcher(`${SANDBOX}/${path}`, {
    method: body ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(20000),
    headers:{ Authorization:`Basic ${Buffer.from(`${process.env.HYPERWALLET_USERNAME}:${process.env.HYPERWALLET_PASSWORD}`).toString('base64')}`, Accept:'application/json', ...(body ? { 'Content-Type':'application/json' } : {}) },
    ...(body ? { body:JSON.stringify(body) } : {})
  });
  if (response.status === 204) return { data:[] };
  if (!response.ok) throw fail(`Sandbox payout provider returned HTTP ${response.status}. Reconcile before retrying a payment.`,502);
  return response.json();
}
function verifyBank(remote, bank) {
  const local = validateBank(bank);
  if (remote.status !== 'ACTIVATED' || remote.type !== 'BANK_ACCOUNT' || remote.transferMethodCountry !== 'US' || remote.transferMethodCurrency !== 'USD' || String(remote.bankAccountId) !== local.accountNumber || String(remote.branchId) !== local.routingNumber || remote.bankAccountPurpose !== local.accountType.toUpperCase()) throw fail('Provider bank destination is inactive or does not match the registered US bank account.',409);
}
async function verifyRecipient(technician, userToken, bankToken, bank, api = request) {
  assertConfigured();
  if (!/^usr-[\w-]+$/.test(userToken || '') || !/^trm-[\w-]+$/.test(bankToken || '')) throw fail('Valid provider user and bank tokens are required.');
  const user = await api(`users/${encodeURIComponent(userToken)}`);
  if (user.clientUserId !== String(technician) || user.programToken !== process.env.HYPERWALLET_PROGRAM_TOKEN || user.status !== 'ACTIVATED') throw fail('Provider recipient must be active and belong to this technician and program.',409);
  verifyBank(await api(`users/${encodeURIComponent(userToken)}/bank-accounts/${encodeURIComponent(bankToken)}`),bank);
}
function paymentBody(w) {
  if (!Number.isSafeInteger(w.amountCents) || w.amountCents <= 0) throw fail('Invalid payout amount.');
  return { amount:(w.amountCents/100).toFixed(2),currency:'USD',clientPaymentId:`withdrawal-${w._id}`,destinationToken:w.payout.bankToken,programToken:process.env.HYPERWALLET_PROGRAM_TOKEN,purpose:'OTHER' };
}
function verifyPayment(payment,w) {
  const expected = paymentBody(w);
  if (!/^pmt-[\w-]+$/.test(payment.token || '') || payment.clientPaymentId !== expected.clientPaymentId || payment.destinationToken !== expected.destinationToken || payment.currency !== 'USD' || Math.round(Number(payment.amount)*100) !== w.amountCents || (w.payout.provider === 'hyperwallet-sandbox' && payment.programToken !== expected.programToken)) throw fail('Provider payment does not match the approved withdrawal. Manual reconciliation required.',409);
}
async function lookup(w, api=request) {
  if (w.payout.provider === 'hyperwallet-mock') return (w.payout.paymentToken || w.payout.attempts > 0) ? { ...paymentBody(w),token:w.payout.paymentToken || `pmt-mock-${w._id}`,status:'COMPLETED' } : null;
  if (w.payout.paymentToken) return api(`payments/${encodeURIComponent(w.payout.paymentToken)}`);
  const result = await api(`payments?clientPaymentId=${encodeURIComponent(`withdrawal-${w._id}`)}`);
  if ((result.data || []).length > 1) throw fail('Multiple provider payments found. Manual reconciliation required.',409);
  return result.data?.[0] || null;
}
async function submit(w, api=request) {
  if (w.payout.provider === 'hyperwallet-mock') return { ...paymentBody(w),token:`pmt-mock-${w._id}`,status:'IN_PROGRESS' };
  return api('payments',{ body:paymentBody(w) });
}
module.exports = { mode,assertConfigured,fingerprint,request,verifyBank,verifyRecipient,paymentBody,verifyPayment,lookup,submit };
