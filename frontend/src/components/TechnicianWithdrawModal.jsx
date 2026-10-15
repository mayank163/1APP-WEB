import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
function pendingStorageKey() {
  try { return `technician-withdrawal-${JSON.parse(atob(localStorage.getItem('1App_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id}`; }
  catch { return 'technician-withdrawal-pending'; }
}
function savedRequest() {
  try { return JSON.parse(localStorage.getItem(pendingStorageKey())) || null; } catch { return null; }
}
export default function TechnicianWithdrawModal({ availableBalance, onClose, onSuccess }) {
  const [bank,setBank] = useState(null), [loading,setLoading] = useState(true);
  const [amount,setAmount] = useState(() => savedRequest() ? String(savedRequest().amount/100) : ''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const request = useRef(savedRequest());
  useEffect(() => { API.get('/technician/bank-details').then(({ data }) => { setBank(data.data.bank); }).catch(e => setError(e.response?.data?.message || 'Could not load bank details.')).finally(() => setLoading(false)); },[]);
  const withdraw = async e => {
    e.preventDefault(); if (busy) return;
    const value = Math.round(Number(amount)*100);
    if (!Number.isSafeInteger(value) || value <= 0 || (value > Math.round(availableBalance*100) && request.current?.amount !== value)) { setError('Enter an amount within your available balance.'); return; }
    if (!request.current || request.current.amount !== value) request.current = { amount: value, key: crypto.randomUUID() };
    try { localStorage.setItem(pendingStorageKey(),JSON.stringify(request.current)); } catch { setError('Enable browser storage before submitting a withdrawal.'); return; }
    setBusy(true); setError('');
    try { await API.post('/technician/withdraw',{ amountCents: value },{ headers: { 'Idempotency-Key': request.current.key } }); localStorage.removeItem(pendingStorageKey()); request.current = null; onSuccess('Withdrawal requested'); onClose(); }
    catch(e) { if (e.response?.status === 400) { localStorage.removeItem(pendingStorageKey()); request.current = null; } setError(e.response?.data?.message || 'Could not request withdrawal. Retry with the same amount.'); }
    finally { setBusy(false); }
  };
  return <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1100, display: 'grid', placeItems: 'center', padding: 20 }}><div role="dialog" aria-modal="true" aria-label="Withdraw funds" style={{ background: 'white', padding: 24, borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
    <div className="d-flex justify-content-between"><h4>Withdraw funds</h4><button disabled={busy} onClick={onClose} aria-label="Close">×</button></div>
    <p>Available: {new Intl.NumberFormat('en-US',{ style:'currency',currency:'USD' }).format(availableBalance)}</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {loading ? <p>Loading bank account…</p> : <form onSubmit={withdraw}>
      {bank ? <p>Payment will go to your onboarding bank account: {bank.bankName} · Account ending {bank.last4}.</p> : <p role="alert">Your onboarding bank details are unavailable. Contact support to update your profile before requesting a withdrawal.</p>}
      <label className="d-block mb-3">Amount (USD)<input className="form-control" type="number" min="0.01" step="0.01" max={request.current ? undefined : availableBalance} disabled={busy || !!request.current} required value={amount} onChange={e => setAmount(e.target.value)}/></label>
      <p>{request.current ? 'A submission is pending confirmation. Retry to retrieve its result before starting another request.' : ''}</p><p>The amount is reserved while your request is reviewed and paid manually by the admin.</p><button disabled={busy || !bank} className="btn btn-primary">{busy ? 'Submitting…' : 'Request withdrawal'}</button>
    </form>}
  </div></div>;
}
