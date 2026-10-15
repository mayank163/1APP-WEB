const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt, validateBank, amountCents, balance } = require('../src/services/manualPayouts');
const bank = { accountHolder: 'Test Technician', bankName: 'Test Bank', routingNumber: '021000021', accountNumber: '000123456789', accountType: 'checking' };
test('US bank validation preserves leading zeros and rejects invalid routing checksum', () => {
  assert.equal(validateBank(bank).accountNumber, '000123456789');
  assert.throws(() => validateBank({ ...bank, routingNumber: '021000022' }));
  assert.throws(() => validateBank({ ...bank, routingNumber: '000000000' }));
  assert.throws(() => validateBank({ ...bank, accountNumber: 12345 }));
  assert.throws(() => validateBank({ ...bank, accountType: 'wallet' }));
});
test('bank details are encrypted with authenticated randomized ciphertext', () => {
  process.env.PAYOUT_BANK_ENCRYPTION_KEY = 'ab'.repeat(32);
  const encoded = encrypt(bank);
  assert.deepEqual(decrypt(encoded),bank);
  assert.ok(!encoded.includes(bank.accountNumber));
  assert.notEqual(encrypt(bank),encoded);
  const parts = encoded.split('.'); parts[1] = Buffer.alloc(16).toString('base64');
  assert.throws(() => decrypt(parts.join('.')));
  delete process.env.PAYOUT_BANK_ENCRYPTION_KEY;
  assert.throws(() => encrypt(bank), /not configured/);
});
test('amount validation rejects subcent, nonfinite and unsafe values', () => {
  assert.equal(amountCents({ amount: 12.34 }),1234);
  assert.equal(amountCents({ amountCents: 1 }),1);
  for (const amount of [0,-1,NaN,Infinity,1.001,'20']) assert.throws(() => amountCents({ amount }));
  for (const amountCents of [0,1.1,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => amountCents({ amountCents }));
});
test('all active requests reserve funds, including legacy pending requests', () => {
  const wallet = balance({ totalEarnings: 500, totalWithdrawn: 50 },[
    { status:'pending',amount:25 }, { status:'approved',amountCents:10000 }, { status:'sent',amountCents:5000 },
    { status:'paid',amount:50 }, { status:'rejected',amount:100 }, { status:'failed',amount:100 }
  ]);
  assert.equal(wallet.reservedCents,17500);
  assert.equal(wallet.availableCents,27500);
});
test('settlement and rejection produce correct remaining balances', () => {
  assert.equal(balance({ totalEarnings:500,totalWithdrawn:200 },[{ status:'paid',amountCents:20000 }]).availableCents,30000);
  assert.equal(balance({ totalEarnings:500 },[{ status:'rejected',amountCents:20000 }]).availableCents,50000);
});
test('withdrawal schema accepts one cent and excludes ciphertext by default', async () => {
  const mongoose = require('mongoose');
  const Withdrawal = require('../src/models/TechnicianWithdrawal');
  const doc = new Withdrawal({ technician:new mongoose.Types.ObjectId(),amount:0.01,amountCents:1 });
  await doc.validate();
  assert.equal(Withdrawal.schema.path('encryptedBankSnapshot').options.select,false);
});

test('withdrawals reuse onboarding bank details without requiring re-registration', () => {
  const { onboardingBank } = require('../src/services/manualPayouts');
  assert.deepEqual(onboardingBank({ bankDetails: bank }), bank);
  const legacy = onboardingBank({ bankDetails: { accountHolder:'Alex', bankName:'Example', accountNumber:'00012345', ifscCode:'LEGACY' } });
  assert.equal(legacy.accountNumber,'00012345');
  assert.equal(legacy.routingNumber,'');
  assert.equal(legacy.ifscCode,'LEGACY');
  assert.equal(onboardingBank({ bankDetails:{ accountHolder:'Alex' } }),null);
});
