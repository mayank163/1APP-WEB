const { test } = require('node:test');
const assert = require('node:assert/strict');
const Withdrawal = require('../src/models/TechnicianWithdrawal');
const provider = require('../src/services/bankPayoutProvider');
const worker = require('../src/services/bankPayoutWorker');
async function withJob(job, fn) {
  const saved = { claim:Withdrawal.findOneAndUpdate,update:Withdrawal.updateOne,lookup:provider.lookup,submit:provider.submit };
  const previous = process.env.PAYOUT_PROVIDER;
  process.env.PAYOUT_PROVIDER = 'hyperwallet-mock';
  const writes = [];
  Withdrawal.findOneAndUpdate = () => ({ select:async () => job });
  Withdrawal.updateOne = async (filter,change) => { writes.push(change); return { modifiedCount:1 }; };
  provider.lookup = async () => null;
  try { await fn(writes); }
  finally {
    Withdrawal.findOneAndUpdate = saved.claim; Withdrawal.updateOne = saved.update;
    provider.lookup = saved.lookup; provider.submit = saved.submit;
    if (previous === undefined) delete process.env.PAYOUT_PROVIDER; else process.env.PAYOUT_PROVIDER = previous;
  }
}
test('worker never resubmits a payment after a previous uncertain attempt', async () => {
  await withJob({ _id:'withdrawal-test',payout:{ provider:'hyperwallet-mock',attempts:1 } },async writes => {
    let submitted = false;
    provider.submit = async () => { submitted = true; throw new Error('unexpected submit'); };
    await worker.processOne();
    assert.equal(submitted,false);
    assert.equal(writes.at(-1).$set['payout.state'],'unknown');
    assert.equal(writes.at(-1).$set['payout.leaseOwner'],null);
  });
});
test('worker durably records the attempt before POST and retains funds after timeout', async () => {
  await withJob({ _id:'withdrawal-test',payout:{ provider:'hyperwallet-mock',attempts:0 } },async writes => {
    provider.submit = async () => {
      assert.equal(writes[0].$inc['payout.attempts'],1);
      throw new Error('network timeout with sensitive provider data');
    };
    await worker.processOne();
    assert.equal(writes.at(-1).$set['payout.state'],'unknown');
    assert.ok(!writes.at(-1).$set['payout.lastError'].includes('sensitive'));
    assert.ok(writes.every(change => change.$set?.status !== 'failed'));
  });
});
