const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const provider = require('../src/services/bankPayoutProvider');
const original = { ...process.env };
beforeEach(() => {
  process.env.PAYOUT_PROVIDER = 'hyperwallet-sandbox';
  process.env.HYPERWALLET_USERNAME = 'sandbox-test'; process.env.HYPERWALLET_PASSWORD = 'test-password';
  process.env.HYPERWALLET_PROGRAM_TOKEN = 'prg-test'; process.env.HYPERWALLET_STRAIGHT_THROUGH = 'true';
  process.env.PAYOUT_BANK_ENCRYPTION_KEY = 'ac'.repeat(32);
});
afterEach(() => { for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env,original); });
const bank = { accountHolder:'Test Technician',bankName:'Test Bank',accountNumber:'000123456789',routingNumber:'021000021',accountType:'checking' };
const remote = { status:'ACTIVATED',type:'BANK_ACCOUNT',transferMethodCountry:'US',transferMethodCurrency:'USD',bankAccountId:bank.accountNumber,branchId:bank.routingNumber,bankAccountPurpose:'CHECKING' };
const withdrawal = () => ({ _id:'test-withdrawal',technician:'technician-1',amountCents:12345,payout:{ provider:'hyperwallet-sandbox',bankToken:'trm-bank',attempts:0 } });
test('live provider modes cannot be enabled', () => { process.env.PAYOUT_PROVIDER = 'hyperwallet-live'; assert.throws(() => provider.mode(), /Live payouts are not enabled/); });
test('sandbox requires an explicit Straight-Through program configuration', () => { delete process.env.HYPERWALLET_STRAIGHT_THROUGH; assert.throws(() => provider.assertConfigured(), /Straight-Through/); });
test('bank matching compares full account, routing, type, country and activation', () => {
  provider.verifyBank(remote,bank);
  for (const change of [{ bankAccountId:'999123456789' },{ branchId:'111000025' },{ status:'DE_ACTIVATED' },{ bankAccountPurpose:'SAVINGS' },{ transferMethodCountry:'CA' }]) assert.throws(() => provider.verifyBank({ ...remote,...change },bank));
});
test('recipient must belong to the correct technician and program', async () => {
  const api = async path => path.includes('bank-accounts') ? remote : { clientUserId:'technician-1',programToken:'prg-test',status:'ACTIVATED' };
  await provider.verifyRecipient('technician-1','usr-test','trm-bank',bank,api);
  await assert.rejects(provider.verifyRecipient('another-technician','usr-test','trm-bank',bank,api));
});
test('payment IDs and integer-cent amounts stay stable across retries', () => {
  const w = withdrawal(); const body = provider.paymentBody(w);
  assert.equal(body.amount,'123.45'); assert.equal(body.clientPaymentId,'withdrawal-test-withdrawal');
  assert.deepEqual(provider.paymentBody(w),body);
  provider.verifyPayment({ ...body,token:'pmt-test',status:'COMPLETED' },w);
  for (const change of [{ amount:'123.46' },{ currency:'EUR' },{ destinationToken:'trm-other' },{ clientPaymentId:'different' },{ programToken:'prg-other' }]) assert.throws(() => provider.verifyPayment({ ...body,token:'pmt-test',...change },w));
});
test('lookup reconciles by the stable client ID without issuing a POST', async () => {
  const w = withdrawal(); let path;
  assert.equal(await provider.lookup(w,async p => { path = p; return { data:[] }; }),null);
  assert.equal(path,'payments?clientPaymentId=withdrawal-test-withdrawal');
  await assert.rejects(provider.lookup(w,async () => ({ data:[{},{}] })), /Multiple/);
});
test('HTTP requests are restricted to sandbox and suppress provider error payloads', async () => {
  let url,options;
  await provider.request('payments',{ body:{ amount:'1.00' } },async (u,o) => { url = u; options = o; return { ok:true,status:201,json:async () => ({ token:'pmt-test' }) }; });
  assert.equal(url,'https://api.sandbox.hyperwallet.com/rest/v4/payments');
  assert.equal(options.redirect,'error'); assert.equal(options.method,'POST');
  await assert.rejects(provider.request('payments',{},async () => ({ ok:false,status:401,json:async () => ({ secret:'must-not-leak' }) })),e => !e.message.includes('must-not-leak'));
});
test('mock mode simulates completion and never needs credentials or network', async () => {
  process.env.PAYOUT_PROVIDER = 'hyperwallet-mock'; delete process.env.HYPERWALLET_USERNAME;
  const w = withdrawal(); w.payout.provider = 'hyperwallet-mock';
  const submitted = await provider.submit(w,() => { throw new Error('network called'); });
  assert.equal(submitted.status,'IN_PROGRESS');
  w.payout.paymentToken = submitted.token;
  assert.equal((await provider.lookup(w)).status,'COMPLETED');
});
test('bank fingerprint changes when the account destination changes', () => {
  assert.equal(provider.fingerprint(bank),provider.fingerprint(bank));
  assert.notEqual(provider.fingerprint(bank),provider.fingerprint({ ...bank,accountNumber:'000123456788' }));
});
