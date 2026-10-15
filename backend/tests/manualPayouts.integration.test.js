const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const controller = require('../src/controllers/manualPayoutController');
const User = require('../src/models/User');
const Bank = require('../src/models/TechnicianPayoutBank');
const Withdrawal = require('../src/models/TechnicianWithdrawal');
const uri = process.env.PAYOUT_TEST_MONGO_URI;
function call(handler, user, { body = {}, params = {}, key = 'test-request-0001', query = {} } = {}) {
  return new Promise((resolve,reject) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(data) { resolve({ status: this.statusCode, ...data }); } };
    handler({ user,body,params,query,get: () => key },res,reject);
  });
}
test('real MongoDB withdrawal reservation and payout lifecycle', { skip: !uri }, async t => {
  // Refuse any database that is not explicitly named for disposable payout tests.
  const name = new URL(uri).pathname.slice(1);
  assert.match(name, /_payout_test$/);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.ok(hello.setName || hello.msg === 'isdbgrid', 'Transactions require a replica set or sharded cluster');
  const originalMode = process.env.PAYOUT_PROVIDER;
  process.env.PAYOUT_PROVIDER = 'manual';
  process.env.PAYOUT_BANK_ENCRYPTION_KEY = 'ac'.repeat(32);
  const user = await User.create({ name:'Payout test',phone:'5550000000',role:'technician',password:'test-password-only',totalEarnings:500,totalWithdrawn:0 });
  const admin = { _id: new mongoose.Types.ObjectId() };
  try {
    await Promise.all([Withdrawal.init(),Bank.init()]);
    const bank = { accountHolder:'Payout test',bankName:'Example Bank',routingNumber:'021000021',accountNumber:'000123456789',accountType:'checking' };
    await User.updateOne({ _id:user._id },{ $set:{ bankDetails:bank } });
    const saved = await call(controller.getBank,user);
    assert.equal(saved.data.bank.last4,'6789');
    assert.equal(saved.data.bank.accountNumber,undefined);
    await t.test('simultaneous withdrawals cannot overspend', async () => {
      const results = await Promise.allSettled([
        call(controller.request,user,{ body:{ amountCents:40000 }, key:'concurrent-key-0001' }),
        call(controller.request,user,{ body:{ amountCents:40000 }, key:'concurrent-key-0002' })
      ]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
      assert.match(results.find(r => r.status === 'rejected').reason.message,/available balance/);
    });
    let w = await Withdrawal.findOne({ technician:user._id });
    await t.test('same idempotency key does not reserve twice', async () => {
      const replay = await call(controller.request,user,{ body:{ amountCents:40000 },key:w.requestKey });
      assert.equal(replay.status,200);
      assert.equal(await Withdrawal.countDocuments({ technician:user._id }),1);
      await assert.rejects(call(controller.request,user,{ body:{ amountCents:1 },key:w.requestKey }), /different amount/);
    });
    await t.test('bank replacement preserves the original request destination', async () => {
      await User.updateOne({ _id:user._id },{ $set:{ bankDetails:{ ...bank,accountNumber:'999987654321' } } });
      const destination = await call(controller.bankDestination,admin,{ params:{ id:String(w._id) } });
      assert.equal(destination.data.bank.accountNumber,bank.accountNumber);
    });
    const params = action => ({ id:String(w._id),action });
    await t.test('invalid transitions and confirmations are rejected', async () => {
      await assert.rejects(call(controller.transition,admin,{ params:params('mark-paid'),body:{ paymentCompletedConfirmed:true } }), /Cannot/);
      await assert.rejects(call(controller.transition,admin,{ params:params('mark-failed'),body:{ reason:'test' } }), /Confirm funds/);
    });
    await t.test('repeated approval and settlement only withdraw once', async () => {
      await call(controller.transition,admin,{ params:params('approve') });
      await call(controller.transition,admin,{ params:params('approve') });
      await call(controller.transition,admin,{ params:params('mark-sent'),body:{ transferReference:'TEST-REF-123' } });
      const responses = await Promise.all([
        call(controller.transition,admin,{ params:params('mark-paid'),body:{ paymentCompletedConfirmed:true } }),
        call(controller.transition,admin,{ params:params('mark-paid'),body:{ paymentCompletedConfirmed:true } })
      ]);
      assert.equal(responses[0].data.withdrawal.encryptedBankSnapshot,undefined);
      assert.equal((await User.findById(user._id)).totalWithdrawn,400);
      assert.equal((await call(controller.wallet,user)).data.wallet.availableCents,10000);
    });
    await t.test('rejection releases funds once', async () => {
      const result = await call(controller.request,user,{ body:{ amountCents:10000 },key:'rejection-key-0001' });
      const args = { params:{ id:String(result.data.withdrawal._id),action:'reject' },body:{ reason:'Test rejection' } };
      assert.equal((await call(controller.wallet,user)).data.wallet.availableCents,0);
      await call(controller.transition,admin,args); await call(controller.transition,admin,args);
      assert.equal((await call(controller.wallet,user)).data.wallet.availableCents,10000);
    });
    await t.test('automatic mock approval queues, settles once and retains reservations until completion', async () => {
      const previous = process.env.PAYOUT_PROVIDER;
      process.env.PAYOUT_PROVIDER = 'hyperwallet-mock';
      try {
        const response = await call(controller.request,user,{ body:{ amountCents:2500 },key:'automatic-mock-0001' });
        const id = response.data.withdrawal._id;
        const args = { params:{ id:String(id),action:'approve' } };
        const approval = await call(controller.transition,admin,args);
        assert.equal(approval.data.withdrawal.status,'processing');
        await call(controller.transition,admin,args);
        assert.equal((await call(controller.wallet,user)).data.wallet.reservedCents,2500);
        const worker = require('../src/services/bankPayoutWorker');
        await Promise.all([worker.processOne(),worker.processOne()]);
        await Withdrawal.updateOne({ _id:id },{ $set:{ 'payout.nextAttemptAt':new Date(0) } });
        await worker.processOne();
        assert.equal((await Withdrawal.findById(id)).status,'paid');
        assert.equal((await User.findById(user._id)).totalWithdrawn,425);
        await Withdrawal.updateOne({ _id:id },{ $set:{ 'payout.nextAttemptAt':new Date(0) } });
        await worker.processOne();
        assert.equal((await User.findById(user._id)).totalWithdrawn,425);
        assert.equal((await call(controller.wallet,user)).data.wallet.availableCents,7500);
      } finally { if (previous === undefined) delete process.env.PAYOUT_PROVIDER; else process.env.PAYOUT_PROVIDER = previous; }
    });
  } finally {
    await Withdrawal.deleteMany({ technician:user._id });
    await Bank.deleteMany({ technician:user._id });
    await User.deleteOne({ _id:user._id });
    await mongoose.disconnect();
    if (originalMode === undefined) delete process.env.PAYOUT_PROVIDER; else process.env.PAYOUT_PROVIDER = originalMode;
  }
});
