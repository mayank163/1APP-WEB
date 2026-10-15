const crypto = require('crypto');
const ACTIVE = ['pending', 'approved', 'processing', 'sent'];
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
function key() {
  const value = process.env.PAYOUT_BANK_ENCRYPTION_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value)) throw fail('Payout bank encryption is not configured.', 503);
  return Buffer.from(value, 'hex');
}
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
function decrypt(value) {
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'));
}
function validateBank(body) {
  const { accountHolder, bankName, routingNumber, accountNumber, accountType } = body;
  if (![accountHolder, bankName].every(v => typeof v === 'string' && v.trim().length >= 2 && v.length <= 120)) throw fail('Account holder and bank name are required (2–120 characters).');
  if (typeof routingNumber !== 'string' || !/^\d{9}$/.test(routingNumber)) throw fail('Routing number must contain nine digits.');
  const n = [...routingNumber].map(Number);
  if (n.every(v => v === 0) || (3*(n[0]+n[3]+n[6])+7*(n[1]+n[4]+n[7])+n[2]+n[5]+n[8]) % 10 !== 0) throw fail('Invalid routing number checksum.');
  if (typeof accountNumber !== 'string' || !/^\d{4,17}$/.test(accountNumber)) throw fail('Account number must contain 4–17 digits.');
  if (!['checking', 'savings'].includes(accountType)) throw fail('Account type must be checking or savings.');
  return { accountHolder: accountHolder.trim(), bankName: bankName.trim(), routingNumber, accountNumber, accountType };
}
function amountCents(body) {
  if (body.amountCents !== undefined) {
    if (!Number.isSafeInteger(body.amountCents) || body.amountCents < 1) throw fail('amountCents must be a positive integer.');
    return body.amountCents;
  }
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 || !Number.isSafeInteger(Math.round(body.amount * 100)) || Math.abs(body.amount * 100 - Math.round(body.amount * 100)) > 0.000001) throw fail('amount must be a positive USD amount with at most two decimal places.');
  return Math.round(body.amount * 100);
}
const cents = w => w.amountCents ?? Math.round(Number(w.amount || 0) * 100);
function balance(user, withdrawals) {
  const reservedCents = withdrawals.filter(w => ACTIVE.includes(w.status)).reduce((n,w) => n+cents(w),0);
  const earnedCents = Math.round(Number(user.totalEarnings || 0)*100);
  const withdrawnCents = Math.round(Number(user.totalWithdrawn || 0)*100);
  return { currency: 'USD', earnedCents, withdrawnCents, reservedCents, availableCents: Math.max(earnedCents-withdrawnCents-reservedCents,0) };
}
// Onboarding is the source of truth. Older profiles may not yet include US routing/type fields.
function onboardingBank(user) {
  const bank = user?.bankDetails;
  if (!bank || ![bank.accountHolder, bank.bankName, bank.accountNumber].every(v => typeof v === 'string' && v.trim())) return null;
  return { accountHolder: bank.accountHolder.trim(), bankName: bank.bankName.trim(), accountNumber: bank.accountNumber.trim(), routingNumber: bank.routingNumber || '', accountType: bank.accountType || '', ...(bank.ifscCode ? { ifscCode: bank.ifscCode } : {}) };
}
module.exports = { onboardingBank, ACTIVE, fail, encrypt, decrypt, validateBank, amountCents, cents, balance };
