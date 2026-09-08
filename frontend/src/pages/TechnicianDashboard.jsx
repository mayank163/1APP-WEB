import React, { useCallback, useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';

// ─── tiny helpers ──────────────────────────────────────────────────────────────
const formatDuration = (minutes) => {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const fmtDT = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const S = {
  card: {
    border: '1px solid #e9e0d5',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    background: '#fff',
    marginBottom: 12,
  },
  btn: (bg = '#1a1208', disabled = false) => ({
    background: disabled ? '#ccc' : bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  }),
  ghost: {
    background: 'transparent',
    border: '1.5px solid #e9e0d5',
    borderRadius: 8,
    padding: '6px 14px',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    color: '#495057',
  },
  badge: (color = '#6c757d', bg = 'rgba(108,117,125,0.1)') => ({
    padding: '3px 12px',
    borderRadius: 20,
    fontSize: '0.75rem',
    fontWeight: 700,
    background: bg,
    color,
  }),
};

// ─── charge status badge ───────────────────────────────────────────────────────
const chargeStatusBadge = (status) => {
  const map = {
    pending:   { color: '#b45309', bg: 'rgba(234,179,8,0.15)', label: '⏳ Pending Review' },
    accepted:  { color: '#16a34a', bg: 'rgba(22,163,74,0.12)', label: '✓ Accepted' },
    rejected:  { color: '#dc3545', bg: 'rgba(220,53,69,0.1)',  label: '✗ Rejected' },
    countered: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  label: '↔ Counter Offered' },
  };
  const s = map[status] || { color: '#6c757d', bg: 'rgba(108,117,125,0.1)', label: status };
  return <span style={S.badge(s.color, s.bg)}>{s.label}</span>;
};

// ─── request status badge ──────────────────────────────────────────────────────
const reqStatusBadge = (status) => {
  const map = {
    accepted:      { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    rejected:      { color: '#dc3545', bg: 'rgba(220,53,69,0.1)' },
    'counter-offer': { color: '#b45309', bg: 'rgba(234,179,8,0.15)' },
    pending:       { color: '#6c757d', bg: 'rgba(108,117,125,0.1)' },
  };
  const s = map[status] || map.pending;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';
  return <span style={S.badge(s.color, s.bg)}>{label}</span>;
};

// ─── CHARGE_LABELS ─────────────────────────────────────────────────────────────
const CHARGE_LABELS = ['Gas', 'Toll', 'Travel', 'Spare Parts', 'Extra Labor', 'Other'];

// ─── RequestJobModal ───────────────────────────────────────────────────────────
const RequestJobModal = ({ job, onClose, onSuccess }) => {
  const [note, setNote] = useState('');
  const [fixedPrice, setFixed] = useState('');
  const [charges, setCharges] = useState([]);
  const [saving, setSaving] = useState(false);

  const addCharge = () =>
    setCharges((p) => [...p, { label: CHARGE_LABELS[0], description: '', amount: '' }]);

  const updateCharge = (i, field, value) =>
    setCharges((p) => p.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const removeCharge = (i) =>
    setCharges((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    setSaving(true);
    try {
      const body = { note };
      if (fixedPrice && Number(fixedPrice) > 0) body.fixedPrice = Number(fixedPrice);
      if (charges.length > 0) {
        for (const c of charges) {
          if (!c.amount || Number(c.amount) <= 0) {
            alert(`Enter a valid amount for "${c.label}"`);
            setSaving(false);
            return;
          }
        }
        body.charges = charges.map((c) => ({
          label: c.label, description: c.description, amount: Number(c.amount),
        }));
      }
      const { data } = await API.post(`/technician/jobs/${job._id}/request`, body);
      if (data.success) { onSuccess(data.message); onClose(); }
      else alert(data.message || 'Failed');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h5 style={{ margin: 0, fontWeight: 800, color: '#1a1208' }}>Request: {job.title}</h5>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#6c757d', marginBottom: 16 }}>
          Job budget: <strong style={{ color: '#A5732F' }}>₹{job.budget}</strong> &nbsp;·&nbsp; {job.location}
        </div>

        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>
          Your Message (optional)
        </label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="E.g. I have 5 years of experience in this area"
          style={{ width: '100%', border: '1.5px solid #e9e0d5', borderRadius: 8, padding: '8px 12px',
            fontSize: '0.875rem', outline: 'none', marginBottom: 12, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>
          Your Proposed Fixed Price (optional — leave blank to accept job budget)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e9e0d5',
            borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          <span style={{ padding: '0 12px', fontWeight: 700, color: '#A5732F',
              background: 'rgba(165,115,47,0.07)', borderRight: '1.5px solid #e9e0d5',
              alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>₹</span>
          <input type="number" min="0" value={fixedPrice} onChange={(e) => setFixed(e.target.value)}
            placeholder={`${job.budget} (job budget)`}
            style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 12px', fontSize: '0.9rem', fontWeight: 600 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057' }}>Additional Charges (optional)</label>
          <button onClick={addCharge} style={{ ...S.btn('#A5732F'), padding: '5px 12px', fontSize: '0.78rem' }}>+ Add Charge</button>
        </div>

        {charges.map((c, i) => (
          <div key={i} style={{ background: '#fdf9f5', border: '1px solid #f0e8dc', borderRadius: 10,
              padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <select value={c.label} onChange={(e) => updateCharge(i, 'label', e.target.value)}
                style={{ border: '1.5px solid #e9e0d5', borderRadius: 7, padding: '6px 8px',
                  fontSize: '0.82rem', background: '#fff', flex: 1, minWidth: 120 }}>
                {CHARGE_LABELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e9e0d5',
                  borderRadius: 7, overflow: 'hidden' }}>
                <span style={{ padding: '0 8px', fontWeight: 700, color: '#A5732F',
                    background: 'rgba(165,115,47,0.07)', borderRight: '1.5px solid #e9e0d5',
                    alignSelf: 'stretch', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>₹</span>
                <input type="number" min="1" value={c.amount} onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  style={{ border: 'none', outline: 'none', padding: '6px 10px', fontSize: '0.9rem', fontWeight: 700, width: 90 }} />
              </div>
              <button onClick={() => removeCharge(i)}
                style={{ background: 'rgba(220,53,69,0.1)', color: '#dc3545', border: 'none',
                  borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
            <input value={c.description} onChange={(e) => updateCharge(i, 'description', e.target.value)}
              placeholder="Description (optional)"
              style={{ width: '100%', border: '1.5px solid #e9e0d5', borderRadius: 7,
                padding: '6px 10px', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={submit} disabled={saving} style={S.btn('#1a1208', saving)}>
            {saving ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SubmitChargesModal ────────────────────────────────────────────────────────
// POST /technician/requests/:requestId/charges
const SubmitChargesModal = ({ requestId, onClose, onSuccess }) => {
  const [charges, setCharges] = useState([{ label: CHARGE_LABELS[0], description: '', amount: '' }]);
  const [saving, setSaving] = useState(false);

  const addCharge = () =>
    setCharges((p) => [...p, { label: CHARGE_LABELS[0], description: '', amount: '' }]);

  const updateCharge = (i, field, value) =>
    setCharges((p) => p.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const removeCharge = (i) =>
    setCharges((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    for (const c of charges) {
      if (!c.amount || Number(c.amount) <= 0) {
        alert(`Enter a valid amount for "${c.label}"`);
        return;
      }
    }
    setSaving(true);
    try {
      const body = {
        charges: charges.map((c) => ({
          label: c.label, description: c.description || '', amount: Number(c.amount),
        })),
      };
      const { data } = await API.post(`/technician/requests/${requestId}/charges`, body);
      if (data.success) { onSuccess(data.message || 'Charges submitted!'); onClose(); }
      else alert(data.message || 'Failed');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit charges');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h5 style={{ margin: 0, fontWeight: 800, color: '#1a1208' }}>Submit Additional Charges</h5>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#6c757d', marginTop: 0, marginBottom: 14 }}>
          List any extra costs you incurred for this job. Admin will review and approve each charge.
        </p>

        {charges.map((c, i) => (
          <div key={i} style={{ background: '#fdf9f5', border: '1px solid #f0e8dc', borderRadius: 10,
              padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <select value={c.label} onChange={(e) => updateCharge(i, 'label', e.target.value)}
                style={{ border: '1.5px solid #e9e0d5', borderRadius: 7, padding: '6px 8px',
                  fontSize: '0.82rem', background: '#fff', flex: 1, minWidth: 120 }}>
                {CHARGE_LABELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e9e0d5',
                  borderRadius: 7, overflow: 'hidden' }}>
                <span style={{ padding: '0 8px', fontWeight: 700, color: '#A5732F',
                    background: 'rgba(165,115,47,0.07)', borderRight: '1.5px solid #e9e0d5',
                    alignSelf: 'stretch', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>₹</span>
                <input type="number" min="1" value={c.amount} onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  style={{ border: 'none', outline: 'none', padding: '6px 10px', fontSize: '0.9rem', fontWeight: 700, width: 90 }} />
              </div>
              {charges.length > 1 && (
                <button onClick={() => removeCharge(i)}
                  style={{ background: 'rgba(220,53,69,0.1)', color: '#dc3545', border: 'none',
                    borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
              )}
            </div>
            <input value={c.description} onChange={(e) => updateCharge(i, 'description', e.target.value)}
              placeholder="Description (optional)"
              style={{ width: '100%', border: '1.5px solid #e9e0d5', borderRadius: 7,
                padding: '6px 10px', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}

        <button onClick={addCharge} style={{ ...S.btn('#A5732F'), padding: '5px 12px', fontSize: '0.78rem', marginBottom: 16 }}>
          + Add Another Charge
        </button>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={submit} disabled={saving} style={S.btn('#1a1208', saving)}>
            {saving ? 'Submitting…' : 'Submit Charges'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── JobDetailModal ────────────────────────────────────────────────────────────
// GET /technician/details/:jobId
const JobDetailModal = ({ jobId, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await API.get(`/technician/details/${jobId}`);
        if (!cancelled && data.success) setDetail(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [jobId]);

  const job = detail?.job;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580,
          maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h5 style={{ margin: 0, fontWeight: 800, color: '#1a1208' }}>Job Details</h5>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '2rem', color: '#adb5bd' }}>Loading…</div>}

        {!loading && !job && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#dc3545' }}>Job not found.</div>
        )}

        {!loading && job && (
          <>
            <div style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1208', marginBottom: 4 }}>{job.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#6c757d', marginBottom: 8 }}>
                {job.category || '—'} · {job.location || '—'}
              </div>
              {job.description && (
                <p style={{ fontSize: '0.875rem', color: '#495057', margin: '0 0 10px' }}>{job.description}</p>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.82rem' }}>
                <span>💰 Budget: <strong style={{ color: '#A5732F' }}>₹{Number(job.budget || 0).toLocaleString()}</strong></span>
                {job.estimatedTime && <span>⏱ Est. time: <strong>{job.estimatedTime}</strong></span>}
                {job.serviceDate && <span>📅 Service: <strong>{fmtDT(job.serviceDate)}</strong></span>}
                <span>Status: {reqStatusBadge(job.status)}</span>
              </div>
            </div>

            {job.assignedTechnician && (
              <div style={{ ...S.card, marginBottom: 0 }}>
                <div style={{ fontWeight: 700, color: '#1a1208', marginBottom: 8 }}>Assigned Technician</div>
                <div style={{ fontSize: '0.83rem', color: '#495057' }}>
                  <strong>{job.assignedTechnician.name || 'Technician'}</strong>
                  {job.assignedTechnician.phone && <div>📞 {job.assignedTechnician.phone}</div>}
                  {job.assignedTechnician.email && <div>✉️ {job.assignedTechnician.email}</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── WithdrawModal ─────────────────────────────────────────────────────────────
const WithdrawModal = ({ availableBalance, onClose, onSuccess }) => {
  const [amount, setAmount] = useState(String(availableBalance || ''));
  const [method, setMethod] = useState('bank-transfer');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { alert('Enter a valid amount'); return; }
    if (amt > availableBalance) { alert('Amount exceeds available balance'); return; }
    setSaving(true);
    try {
      const { data } = await API.post('/technician/withdraw', { amount: amt, method, details });
      if (data.success) { onSuccess(data.message || 'Withdrawal requested'); onClose(); }
      else alert(data.message || 'Failed');
    } catch (err) {
      alert(err.response?.data?.message || 'Withdrawal failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: '1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h5 style={{ margin: 0, fontWeight: 800, color: '#1a1208' }}>Withdraw Funds</h5>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: 14 }}>
          Available balance: <strong style={{ color: '#16a34a' }}>₹{availableBalance.toLocaleString()}</strong>
        </div>

        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>Amount</label>
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e9e0d5',
            borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <span style={{ padding: '0 12px', fontWeight: 700, color: '#A5732F',
              background: 'rgba(165,115,47,0.07)', borderRight: '1.5px solid #e9e0d5',
              alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>₹</span>
          <input type="number" min="1" max={availableBalance} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 12px', fontSize: '0.9rem', fontWeight: 600 }} />
        </div>

        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          style={{ width: '100%', border: '1.5px solid #e9e0d5', borderRadius: 8, padding: '8px 12px',
            fontSize: '0.875rem', background: '#fff', marginBottom: 12, outline: 'none' }}>
          <option value="bank-transfer">Bank Transfer</option>
          <option value="upi">UPI</option>
          <option value="cash">Cash</option>
          <option value="wallet">Wallet</option>
        </select>

        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>
          Details / Notes (optional)
        </label>
        <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)}
          placeholder="E.g. Account number, UPI ID, etc."
          style={{ width: '100%', border: '1.5px solid #e9e0d5', borderRadius: 8, padding: '8px 12px',
            fontSize: '0.875rem', outline: 'none', marginBottom: 16, fontFamily: 'inherit', resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={submit} disabled={saving} style={S.btn('#1a1208', saving)}>
            {saving ? 'Requesting…' : 'Request Withdrawal'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── CounterOfferBubble — rich card inside the chat for counter-offer entries ──
const CounterOfferBubble = ({ msg, isMe }) => {
  const [chargesOpen, setChargesOpen] = useState(false);
  const hasCharges = Array.isArray(msg.charges) && msg.charges.length > 0;
  const chargesTotal = hasCharges
    ? msg.charges.reduce((s, c) => s + Number(c.amount || 0), 0)
    : 0;
  const fixedOnly = (msg.counterAmount || 0) - chargesTotal;

  const statusCfg = {
    pending:    { color: '#b45309',  bg: 'rgba(234,179,8,0.15)',    label: '⏳ Awaiting Response' },
    accepted:   { color: '#16a34a',  bg: 'rgba(22,163,74,0.12)',    label: '✓ Accepted' },
    rejected:   { color: '#dc3545',  bg: 'rgba(220,53,69,0.1)',     label: '✗ Rejected' },
    superseded: { color: '#6c757d',  bg: 'rgba(108,117,125,0.08)',  label: '↻ Superseded' },
  };
  const sc = statusCfg[msg.status] || statusCfg.pending;

  const bubbleBg    = isMe ? '#1a1208' : '#f0f4ff';
  const textColor   = isMe ? '#fff'    : '#1a1208';
  const accentColor = isMe ? '#d4a050' : '#2563eb';
  const borderColor = isMe ? 'transparent' : 'rgba(37,99,235,0.18)';
  const dividerColor= isMe ? 'rgba(255,255,255,0.12)' : 'rgba(37,99,235,0.12)';
  const mutedColor  = isMe ? 'rgba(255,255,255,0.6)'  : '#6c757d';

  return (
    <div style={{
      background: bubbleBg, border: `1px solid ${borderColor}`,
      borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
      padding: '12px 14px', color: textColor, fontSize: '0.83rem', lineHeight: 1.5,
      maxWidth: '85%',
    }}>
      {/* sender label */}
      <div style={{ fontWeight: 700, fontSize: '0.7rem', color: accentColor, marginBottom: 6 }}>
        {isMe ? '🔧 You' : '👤 Admin'} · Counter Offer
      </div>

      {/* fixed / base price — always shown prominently */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${dividerColor}`, paddingBottom: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: mutedColor }}>
          {hasCharges ? 'Base Fixed Price' : 'Counter Amount'}
        </span>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isMe ? '#d4a050' : '#2563eb' }}>
          ${Number(hasCharges ? fixedOnly : (msg.counterAmount || msg.counterOffer || 0)).toLocaleString()}
        </span>
      </div>

      {/* additional charges — collapsible toggle */}
      {hasCharges && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setChargesOpen((p) => !p)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', color: textColor,
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
              Additional Charges ({msg.charges.length})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: isMe ? '#d4a050' : '#2563eb' }}>
                +${chargesTotal.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.7rem', color: mutedColor }}>{chargesOpen ? '▲' : '▼'}</span>
            </span>
          </button>

          {chargesOpen && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {msg.charges.map((c, i) => {
                const chargeStatusMap = {
                  accepted:  { color: '#16a34a', label: '✓' },
                  rejected:  { color: '#dc3545', label: '✗' },
                  countered: { color: '#2563eb', label: '↔' },
                };
                const cs = chargeStatusMap[c.status] || null;
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 8px',
                    background: isMe ? 'rgba(255,255,255,0.07)' : 'rgba(37,99,235,0.05)',
                    borderRadius: 6, fontSize: '0.78rem',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{c.label}</span>
                      {c.description && (
                        <span style={{ color: mutedColor, marginLeft: 5, fontSize: '0.72rem' }}>
                          {c.description}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cs && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: cs.color }}>{cs.label}</span>
                      )}
                      {c.agreedAmount != null && c.agreedAmount !== c.amount ? (
                        <span>
                          <span style={{ textDecoration: 'line-through', color: mutedColor, fontSize: '0.72rem' }}>
                            ${Number(c.amount).toLocaleString()}
                          </span>
                          {' '}
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>
                            ${Number(c.agreedAmount).toLocaleString()}
                          </span>
                        </span>
                      ) : (
                        <span style={{ fontWeight: 700 }}>₹{Number(c.amount).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* total line */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `1px solid ${dividerColor}`, paddingTop: 8, marginTop: 4,
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Total</span>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: isMe ? '#d4a050' : '#2563eb' }}>
          ${Number(msg.counterAmount || msg.counterOffer || 0).toLocaleString()}
        </span>
      </div>

      {/* proposal text */}
      {msg.message && !msg.message.startsWith('Counter offer:') && (
        <div style={{
          marginTop: 8, fontSize: '0.78rem', color: mutedColor,
          borderTop: `1px solid ${dividerColor}`, paddingTop: 6, fontStyle: 'italic',
        }}>
          "{msg.message.replace(/Counter offer: \$[\d,]+\.?\s*/i, '').replace(/Additional charges:.*$/i, '').trim()}"
        </div>
      )}

      {/* entry status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700,
          background: isMe ? 'rgba(255,255,255,0.12)' : sc.bg, color: isMe ? sc.color : sc.color,
        }}>
          {sc.label}
        </span>
        <span style={{ fontSize: '0.65rem', color: mutedColor }}>
          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
    </div>
  );
};

// ─── AcceptRejectBubble — shows when one side accepted/rejected an entry ───────
const AcceptRejectBubble = ({ msg, isMe }) => {
  const isAccept = msg.type === 'accept';
  return (
    <div style={{
      maxWidth: '75%', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600,
      borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
      background: isAccept
        ? (isMe ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.1)')
        : (isMe ? 'rgba(220,53,69,0.15)' : 'rgba(220,53,69,0.08)'),
      border: `1px solid ${isAccept ? 'rgba(22,163,74,0.3)' : 'rgba(220,53,69,0.25)'}`,
      color: isAccept ? '#16a34a' : '#dc3545',
    }}>
      <div style={{ fontWeight: 700, fontSize: '0.7rem', marginBottom: 3, opacity: 0.8 }}>
        {isMe ? '🔧 You' : '👤 Admin'}
      </div>
      {isAccept ? '✓ Accepted the counter-offer' : '✗ Rejected the counter-offer'}
      {msg.message && msg.message !== 'Admin accepted the counter-offer.' &&
        msg.message !== 'Technician accepted the counter-offer.' && (
        <div style={{ marginTop: 3, fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.8 }}>
          {msg.message}
        </div>
      )}
      <div style={{ fontSize: '0.65rem', marginTop: 4, textAlign: 'right', opacity: 0.6 }}>
        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
    </div>
  );
};
const TechNegotiationHistory = ({ history }) => {
  const [open, setOpen] = useState(false);
  if (!history || history.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.72rem', fontWeight: 600, color: '#adb5bd',
          padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {open ? '▲' : '▼'} {open ? 'Hide' : 'View'} negotiation history ({history.length} rounds)
      </button>
      {open && (
        <div style={{
          marginTop: 6, borderLeft: '2px solid #e9e0d5',
          paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {history.map((h, i) => {
            const isMe = h.actor === 'technician';
            const actionColor = h.action === 'accept' ? '#16a34a'
              : h.action === 'reject' ? '#dc3545'
              : h.action === 'submit' ? '#A5732F'
              : '#2563eb';
            const actionLabel = h.action === 'submit'  ? '📤 You submitted'
              : h.action === 'accept'  ? '✓ Accepted'
              : h.action === 'reject'  ? '✕ Rejected'
              : isMe ? '↔ You countered' : '↔ Admin countered';
            return (
              <div key={i} style={{
                background: isMe ? 'rgba(165,115,47,0.05)' : 'rgba(37,99,235,0.04)',
                border: `1px solid ${isMe ? 'rgba(165,115,47,0.15)' : 'rgba(37,99,235,0.12)'}`,
                borderRadius: 6, padding: '6px 8px', fontSize: '0.75rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: isMe ? '#A5732F' : '#2563eb' }}>
                    {isMe ? '🔧 You' : '👤 Admin'}
                  </span>
                  <span style={{ color: '#adb5bd', fontSize: '0.68rem' }}>
                    {h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    }) : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: actionColor }}>{actionLabel}</span>
                  {h.amount != null && (
                    <span style={{ fontWeight: 800, color: '#1a1208' }}>
                      ${Number(h.amount).toLocaleString()}
                    </span>
                  )}
                </div>
                {h.note && (
                  <div style={{ marginTop: 2, color: '#6c757d', fontStyle: 'italic' }}>
                    "{h.note}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── ChargesInvoicePanel ───────────────────────────────────────────────────────
const ChargesInvoicePanel = ({ requestId, onUpdate, refreshKey = 0 }) => {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [responding, setResponding] = useState(null); // chargeId being responded to

  // Per-charge inline re-counter form state
  const [counterOpen, setCounterOpen]     = useState({}); // chargeId → bool
  const [counterAmounts, setCounterAmounts] = useState({}); // chargeId → string
  const [counterNotes, setCounterNotes]   = useState({}); // chargeId → string

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/technician/requests/${requestId}/status`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Submit accept or re-counter to backend
  const respond = async (chargeId, action, amount = null, note = '') => {
    setResponding(chargeId);
    try {
      const body = { action, note: note ? note.trim() : '' };
      if (action === 'counter') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          alert('Please enter a valid counter-offer amount.');
          setResponding(null);
          return;
        }
        body.amount = Number(amount);
      }
      const { data: res } = await API.patch(`/technician/charges/${chargeId}/respond`, body);
      if (res.success) {
        // Close inline form and reset inputs
        setCounterOpen((p) => ({ ...p, [chargeId]: false }));
        setCounterAmounts((p) => ({ ...p, [chargeId]: '' }));
        setCounterNotes((p) => ({ ...p, [chargeId]: '' }));
        await load();
        onUpdate?.();
      } else {
        alert(res.message || 'Failed');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#adb5bd', fontSize: '0.85rem' }}>
        Loading charges…
      </div>
    );
  }
  if (!data) return null;

  const { charges, summary, nextAction, invoice } = data;
  const allCharges = charges?.all || [];
  const hasInvoice = !!invoice;

  return (
    <div style={{ padding: '12px 0' }}>

      {/* ── Next-action hint ── */}
      {nextAction && (
        <div style={{
          padding: '8px 12px', background: 'rgba(165,115,47,0.08)',
          border: '1px solid rgba(165,115,47,0.2)', borderRadius: 8,
          fontSize: '0.82rem', fontWeight: 600, color: '#8c5f25', marginBottom: 12,
        }}>
          💡 {nextAction}
        </div>
      )}

      {/* ── Summary badges ── */}
      {allCharges.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {summary.pendingAdminReview > 0 && (
            <span style={S.badge('#b45309', 'rgba(234,179,8,0.15)')}>⏳ {summary.pendingAdminReview} pending review</span>
          )}
          {summary.awaitingYourReply > 0 && (
            <span style={S.badge('#2563eb', 'rgba(37,99,235,0.1)')}>↔ {summary.awaitingYourReply} need your reply</span>
          )}
          {summary.accepted > 0 && (
            <span style={S.badge('#16a34a', 'rgba(22,163,74,0.12)')}>✓ {summary.accepted} accepted</span>
          )}
          {summary.rejected > 0 && (
            <span style={S.badge('#dc3545', 'rgba(220,53,69,0.1)')}>✗ {summary.rejected} rejected</span>
          )}
        </div>
      )}

      {/* ── Charge cards ── */}
      {allCharges.length === 0 ? (
        <div style={{ color: '#adb5bd', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>
          No additional charges submitted.
        </div>
      ) : (
        allCharges.map((c) => {
          const myTurn  = c.status === 'countered' && c.pendingWith === 'technician';
          const adminTurn = c.status === 'countered' && c.pendingWith === 'admin';
          const busy    = responding === c._id;
          const showInlineCounter = counterOpen[c._id];

          return (
            <div key={c._id} style={{
              background: '#fdf9f5', border: '1px solid #f0e8dc',
              borderRadius: 10, padding: '10px 14px', marginBottom: 10,
            }}>

              {/* ── Charge header: label + original asked amount ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1208' }}>{c.label}</div>
                  {c.description && (
                    <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: 2 }}>{c.description}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: '#A5732F', fontSize: '0.9rem' }}>
                    Asked: ${Number(c.requestedAmount).toLocaleString()}
                  </div>
                  {c.status === 'accepted' && c.agreedAmount != null && (
                    <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, marginTop: 2 }}>
                      ✓ Final: ${Number(c.agreedAmount).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Status badge ── */}
              <div style={{ marginTop: 8 }}>{chargeStatusBadge(c.status)}</div>

              {/* ── Admin's active counter-offer (your turn to respond) ── */}
              {myTurn && c.adminCounterAmount > 0 && (
                <div style={{
                  marginTop: 8, padding: '10px 12px',
                  background: 'rgba(37,99,235,0.06)',
                  border: '1px solid rgba(37,99,235,0.18)', borderRadius: 8,
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb' }}>
                    Admin counter-offer: ${Number(c.adminCounterAmount).toLocaleString()}
                  </div>
                  {c.adminNote && (
                    <div style={{ fontSize: '0.78rem', color: '#6c757d', marginTop: 3, fontStyle: 'italic' }}>
                      "{c.adminNote}"
                    </div>
                  )}

                  {/* Accept / Re-counter buttons (hidden when inline form is open) */}
                  {!showInlineCounter && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button
                        disabled={busy}
                        onClick={() => respond(c._id, 'accept')}
                        style={S.btn('#16a34a', busy)}
                      >
                        {busy ? '…' : `✓ Accept $${Number(c.adminCounterAmount).toLocaleString()}`}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setCounterAmounts((p) => ({ ...p, [c._id]: String(c.adminCounterAmount || '') }));
                          setCounterOpen((p) => ({ ...p, [c._id]: true }));
                        }}
                        style={S.btn('#2563eb', busy)}
                      >
                        ↔ Re-counter
                      </button>
                    </div>
                  )}

                  {/* Inline re-counter form */}
                  {showInlineCounter && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>
                        Your counter-offer for "{c.label}"
                        <span style={{ color: '#adb5bd', fontWeight: 400, marginLeft: 6 }}>
                          (admin offered ${Number(c.adminCounterAmount).toLocaleString()})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center',
                            border: '1.5px solid #e9e0d5', borderRadius: 7, overflow: 'hidden', flex: 1, minWidth: 130 }}>
                          <span style={{ padding: '0 8px', fontWeight: 700, color: '#A5732F',
                              background: 'rgba(165,115,47,0.07)', borderRight: '1.5px solid #e9e0d5',
                              alignSelf: 'stretch', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>₹</span>
                          <input
                            type="number"
                            min="1"
                            placeholder="Your amount"
                            value={counterAmounts[c._id] || ''}
                            onChange={(e) => setCounterAmounts((p) => ({ ...p, [c._id]: e.target.value }))}
                            style={{ border: 'none', outline: 'none', padding: '6px 10px',
                              fontSize: '0.9rem', fontWeight: 700, width: '100%' }}
                          />
                        </div>
                        <button
                          disabled={busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0}
                          onClick={() => respond(c._id, 'counter', counterAmounts[c._id], counterNotes[c._id] || '')}
                          style={S.btn('#2563eb', busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0)}
                        >
                          {busy ? '…' : 'Send'}
                        </button>
                        <button
                          onClick={() => setCounterOpen((p) => ({ ...p, [c._id]: false }))}
                          style={S.ghost}
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional note…"
                        value={counterNotes[c._id] || ''}
                        onChange={(e) => setCounterNotes((p) => ({ ...p, [c._id]: e.target.value }))}
                        style={{
                          marginTop: 6, width: '100%', border: '1.5px solid #e9e0d5',
                          borderRadius: 7, padding: '6px 10px', fontSize: '0.8rem',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Waiting for admin (you already re-countered) ── */}
              {adminTurn && c.technicianCounterAmount > 0 && (
                <div style={{
                  marginTop: 8, padding: '8px 10px',
                  background: 'rgba(165,115,47,0.06)',
                  border: '1px solid rgba(165,115,47,0.18)', borderRadius: 8,
                  fontSize: '0.8rem', fontWeight: 600, color: '#8c5f25',
                }}>
                  ⏳ Your counter-offer of ${Number(c.technicianCounterAmount).toLocaleString()} is with admin.
                  Waiting for their response…
                </div>
              )}

              {/* ── Admin note on resolved charges ── */}
              {['accepted', 'rejected'].includes(c.status) && c.adminNote && (
                <div style={{
                  marginTop: 6, fontSize: '0.78rem', color: '#6c757d',
                  borderLeft: '3px solid #dee2e6', paddingLeft: 8, fontStyle: 'italic',
                }}>
                  Admin note: {c.adminNote}
                </div>
              )}

              {/* ── Negotiation history (collapsible) ── */}
              <TechNegotiationHistory history={c.counterHistory} />

            </div>
          );
        })
      )}

      {/* ── Invoice section ── */}
      {hasInvoice && (
        <div style={{ marginTop: 16, border: '1.5px solid #f0e8dc', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            background: '#fdf9f5', padding: '10px 14px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0e8dc',
          }}>
            <div style={{ fontWeight: 800, color: '#1a1208', fontSize: '0.95rem' }}>🧾 {invoice.invoiceNumber}</div>
            <span style={S.badge(
              invoice.status === 'paid' ? '#16a34a' : invoice.status === 'finalised' ? '#2563eb' : '#6c757d',
              invoice.status === 'paid' ? 'rgba(22,163,74,0.12)' : invoice.status === 'finalised' ? 'rgba(37,99,235,0.1)' : '#f3f4f6'
            )}>
              {invoice.status === 'paid' ? '💰 Paid' : invoice.status === 'finalised' ? '✓ Finalised' : 'Draft'}
            </span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginBottom: 10 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0e8dc' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: '#6c757d', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: '#6c757d', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f8f3ed' }}>
                  <td style={{ padding: '7px 0', fontWeight: 600 }}>{invoice.fixedJobLabel || 'Fixed Job Charge'}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#A5732F' }}>
                    ${Number(invoice.fixedJobCharge).toLocaleString()}
                  </td>
                </tr>
                {(invoice.additionalCharges || []).map((ch, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f3ed' }}>
                    <td style={{ padding: '7px 0' }}>
                      <div style={{ fontWeight: 600 }}>{ch.label}</div>
                      {ch.description && <div style={{ fontSize: '0.72rem', color: '#6c757d' }}>{ch.description}</div>}
                    </td>
                    <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#A5732F' }}>
                      ${Number(ch.agreedAmount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ background: '#fdf9f5', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: '#495057', marginBottom: 4 }}>
                <span>Fixed Charge</span>
                <span>₹{Number(invoice.fixedJobCharge).toLocaleString()}</span>
              </div>
              {invoice.subtotalAdditional > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: '#495057', marginBottom: 4 }}>
                  <span>Additional Charges</span>
                  <span>₹{Number(invoice.subtotalAdditional).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem',
                  color: '#1a1208', borderTop: '2px solid #f0e8dc', paddingTop: 8, marginTop: 4 }}>
                <span>Total</span>
                <span style={{ color: '#A5732F' }}>₹{Number(invoice.totalAmount).toLocaleString()}</span>
              </div>
            </div>
            {invoice.status === 'paid' && invoice.paidAt && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                ✓ Paid on {fmtDT(invoice.paidAt)} — Check your wallet
              </div>
            )}
            {invoice.status === 'finalised' && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}>
                ⏳ Invoice finalised — Waiting for admin to process payment
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const TechnicianDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [summary, setSummary] = useState({
    totalJobsDone: 0, totalEarnings: 0, totalWithdrawn: 0, availableBalance: 0,
  });

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');

  // modals / panels
  const [requestModal, setRequestModal] = useState(null);       // job object
  const [openChat, setOpenChat] = useState(null);               // requestId
  const [openChargesPanel, setOpenChargesPanel] = useState(null); // requestId
  const [submitChargesModal, setSubmitChargesModal] = useState(null); // requestId
  const [jobDetailModal, setJobDetailModal] = useState(null);   // jobId
  const [withdrawModal, setWithdrawModal] = useState(false);

  const [msgText, setMsgText] = useState({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingChat, setLoadingChat] = useState(null);
  const [reuploadingDoc, setReuploadingDoc] = useState(null);

  // profile image
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const imageInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // socket
  const { socket } = useSocket();
  const openChatReqIdRef = useRef(null);
  const openChargesPanelRef = useRef(null);
  const [chargesRefreshKey, setChargesRefreshKey] = useState(0);

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [dashRes, jobsRes, profileRes, withdrawalsRes, metricsRes, requestsRes] = await Promise.all([
        API.get('/technician/dashboard'),
        API.get('/technician/jobs'),
        API.get('/technician-auth/me'),
        API.get('/technician/withdrawals'),
        API.get('/technician/metrics'),
        API.get('/technician/requests'),      // GET /technician/requests — authoritative request list
      ]);

      if (dashRes.data.success) {
        const tech = dashRes.data.data.technician;
        setSummary({
          totalJobsDone: tech.totalJobsDone || 0,
          totalEarnings: tech.totalEarnings || 0,
          totalWithdrawn: tech.totalWithdrawn || 0,
          availableBalance: tech.availableBalance || 0,
        });
      }

      // Use /technician/requests as the source of truth for requests state
      if (requestsRes.data.success) {
        const reqs = requestsRes.data.data.requests || [];
        setRequests(reqs);
        setMyJobs(reqs.filter((r) => r.status === 'accepted' && r.job).map((r) => r.job));
      } else if (dashRes.data.success) {
        // Fallback to dashboard requests if dedicated endpoint fails
        const reqs = dashRes.data.data.requests || [];
        setRequests(reqs);
        setMyJobs(reqs.filter((r) => r.status === 'accepted' && r.job).map((r) => r.job));
      }

      if (jobsRes.data.success) {
        setJobs(jobsRes.data.data.jobs || []);
      }

      if (profileRes.data.success) {
        const u = profileRes.data.data.user;
        setProfile(u);
        const img = u.profileImage?.url || u.technicianProfile?.photoUrl || '';
        if (img) setProfileImagePreview(img);
      }

      if (withdrawalsRes.data.success) {
        setWithdrawals(withdrawalsRes.data.data.withdrawals || []);
      }

      if (metricsRes.data.success) {
        setMetrics(metricsRes.data.data.metrics);
      }
    } catch (err) {
      console.error('loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Use GET /technician/myjobs to independently refresh assigned jobs ─────────
  const refreshMyJobs = useCallback(async () => {
    try {
      const { data } = await API.get('/technician/jobs?filter=active');
      if (data.success) setMyJobs(data.data.jobs || []);
    } catch (err) {
      console.error('refreshMyJobs error:', err);
    }
  }, []);

  // ── Use GET /technician/requests to independently refresh requests ─────────────
  const refreshRequests = useCallback(async () => {
    try {
      const { data } = await API.get('/technician/requests');
      if (data.success) {
        const reqs = data.data.requests || [];
        setRequests(reqs);
        // keep myJobs in sync with accepted requests
        setMyJobs(reqs.filter((r) => r.status === 'accepted' && r.job).map((r) => r.job));
      }
    } catch (err) {
      console.error('refreshRequests error:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (openChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [openChat, requests]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onJobNew = ({ job }) => {
      if (job.status === 'open') {
        setJobs((prev) => {
          const exists = prev.some((j) => j._id === job._id);
          return exists ? prev : [job, ...prev];
        });
      }
    };

    const onRequestMessage = ({ requestId, message }) => {
      setRequests((prev) =>
        prev.map((r) => r._id === requestId
          ? { ...r, conversation: [...(r.conversation || []), message] }
          : r)
      );
    };

    const onRequestStatus = ({ requestId, status, counterOffer, counterOfferFrom }) => {
      setRequests((prev) =>
        prev.map((r) => r._id === requestId ? { ...r, status, counterOffer, counterOfferFrom } : r)
      );
      if (status === 'accepted') refreshRequests();
    };

    const onRequestUpdated = ({ request }) => {
      setRequests((prev) =>
        prev.map((r) => r._id === request._id ? { ...r, ...request } : r)
      );
      if (request.status === 'accepted') refreshRequests();
    };

    const onChargeReviewed = ({ requestId, requestChargesStatus }) => {
      setRequests((prev) =>
        prev.map((r) => r._id === requestId
          ? { ...r, chargesStatus: requestChargesStatus || r.chargesStatus }
          : r)
      );
      if (openChargesPanelRef.current === requestId) {
        setChargesRefreshKey((prev) => prev + 1);
      }
    };

    const onInvoiceGenerated = ({ requestId }) => {
      setRequests((prev) =>
        prev.map((r) => r._id === requestId ? { ...r, chargesStatus: 'invoiced' } : r)
      );
    };

    const onInvoicePaid = () => { loadData(); };

    const onVerificationUpdated = ({ status }) => {
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, technicianProfile: { ...(prev.technicianProfile || {}), verificationStatus: status } };
      });
    };

    socket.on('job:new', onJobNew);
    socket.on('request:message', onRequestMessage);
    socket.on('request:status', onRequestStatus);
    socket.on('request:updated', onRequestUpdated);
    socket.on('charge:reviewed', onChargeReviewed);
    socket.on('invoice:generated', onInvoiceGenerated);
    socket.on('invoice:paid', onInvoicePaid);
    socket.on('technician:verificationUpdated', onVerificationUpdated);

    return () => {
      socket.off('job:new', onJobNew);
      socket.off('request:message', onRequestMessage);
      socket.off('request:status', onRequestStatus);
      socket.off('request:updated', onRequestUpdated);
      socket.off('charge:reviewed', onChargeReviewed);
      socket.off('invoice:generated', onInvoiceGenerated);
      socket.off('invoice:paid', onInvoicePaid);
      socket.off('technician:verificationUpdated', onVerificationUpdated);
    };
  }, [socket, loadData, refreshRequests]);

  // ── Join technician's own room ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !profile?._id) return;
    socket.emit('technician:join', profile._id);
    return () => socket.emit('technician:leave', profile._id);
  }, [socket, profile?._id]);

  // ── Live GPS location — emit every 5s for active assigned jobs ───────────────
  useEffect(() => {
    if (!socket || myJobs.length === 0) return;
    const activeJobs = myJobs.filter((j) => !j.jobCompletedAt);
    if (activeJobs.length === 0) return;
    const emit = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          activeJobs.forEach((job) => {
            socket.emit('technician:location', {
              jobId:        job._id,
              technicianId: profile?._id,
              lat:          coords.latitude,
              lng:          coords.longitude,
            });
          });
        },
        (err) => console.warn('[GPS]', err.message),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    emit();
    const interval = setInterval(emit, 5000);
    return () => clearInterval(interval);
  }, [socket, myJobs, profile?._id]);

  // ── profile image ────────────────────────────────────────────────────────────
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    const file = imageInputRef.current?.files?.[0];
    if (!file) return alert('Select an image first');
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('profileImage', file);
      const { data } = await API.post('/technician-auth/upload-profile-image', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.success) {
        alert('Profile image updated!');
        setProfileImagePreview(data.data.profileImageUrl);
      } else {
        alert(data.message || 'Upload failed');
      }
    } catch { alert('Upload failed'); }
    finally { setUploadingImage(false); }
  };

  // ── job actions ──────────────────────────────────────────────────────────────
  // ── Get current GPS position (returns { lat, lng } or null) ─────────────────
  const getCurrentCoords = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
        ()           => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });

  // ── complete a task ────────────────────────────────────────────────────────
  const completeTask = async (jobId, taskIndex) => {
    try {
      const coords = await getCurrentCoords();
      const body   = coords ? { lat: coords.lat, lng: coords.lng } : {};
      const { data } = await API.patch(`/technician/jobs/${jobId}/tasks/${taskIndex}/complete`, body);
      if (data.success) {
        setMyJobs((prev) => prev.map((j) => {
          if (j._id !== jobId) return j;
          const tasks = [...(j.tasks || [])];
          tasks[taskIndex] = data.data.task;
          return { ...j, tasks };
        }));
      } else {
        alert(data.message || 'Failed');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete task');
    }
  };

  const markReached = async (jobId) => {
    try {
      const coords = await getCurrentCoords();
      const body   = coords ? { lat: coords.lat, lng: coords.lng } : {};
      const { data } = await API.patch(`/technician/jobs/${jobId}/reached`, body);
      alert(data.message || (data.success ? 'Reached recorded!' : 'Failed'));
      if (data.success) refreshMyJobs();
    } catch (err) { alert(err.response?.data?.message || 'Failed to mark reached'); }
  };

  const markCompleted = async (jobId) => {
    if (!window.confirm('Mark this job as completed? Admin will be notified.')) return;
    try {
      const coords = await getCurrentCoords();
      const body   = coords ? { lat: coords.lat, lng: coords.lng } : {};
      const { data } = await API.patch(`/technician/jobs/${jobId}/complete`, body);
      alert(data.message || (data.success ? 'Job completion recorded!' : 'Failed'));
      if (data.success) refreshMyJobs();
    } catch (err) { alert(err.response?.data?.message || 'Failed to mark completed'); }
  };

  // ── cancel request ───────────────────────────────────────────────────────────
  const cancelRequest = async (requestId) => {
    if (!window.confirm('Cancel this job request?')) return;
    try {
      const { data } = await API.patch(`/technician/job-requests/${requestId}/cancel`);
      if (data.success) {
        alert(data.message || 'Request cancelled');
        if (openChat === requestId) {
          socket?.emit('request:leave', requestId);
          openChatReqIdRef.current = null;
          setOpenChat(null);
        }
        if (openChargesPanel === requestId) {
          socket?.emit('request:leave', requestId);
          openChargesPanelRef.current = null;
          setOpenChargesPanel(null);
        }
        await loadData();
      } else {
        alert(data.message || 'Failed to cancel request');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  // ── chat ─────────────────────────────────────────────────────────────────────
  const openChatFor = async (requestId) => {
    if (openChatReqIdRef.current && openChatReqIdRef.current !== requestId) {
      socket?.emit('request:leave', openChatReqIdRef.current);
      openChatReqIdRef.current = null;
    }

    if (openChat === requestId) {
      socket?.emit('request:leave', requestId);
      openChatReqIdRef.current = null;
      setOpenChat(null);
      return;
    }

    if (openChargesPanelRef.current && openChargesPanelRef.current !== requestId) {
      socket?.emit('request:leave', openChargesPanelRef.current);
    }
    setOpenChargesPanel(null);
    openChargesPanelRef.current = null;
    setOpenChat(requestId);
    setLoadingChat(requestId);

    try {
      const { data } = await API.get(`/technician/requests/${requestId}/conversation`);
      if (data.success) {
        setRequests((prev) =>
          prev.map((r) => r._id === requestId ? {
            ...r,
            conversation: data.data.conversation || [],
            status: data.data.status ?? r.status,
            chargesStatus: data.data.chargesStatus ?? r.chargesStatus,
            finalJobAmount: data.data.finalJobAmount ?? r.finalJobAmount,
          } : r)
        );
      }
    } catch { /* use existing */ }
    finally {
      setLoadingChat(null);
      socket?.emit('request:join', requestId);
      openChatReqIdRef.current = requestId;
    }
  };

  const sendMessage = async (requestId) => {
    const message = (msgText[requestId] || '').trim();
    if (!message) return;
    setSendingMsg(true);
    try {
      const { data } = await API.post(`/technician/requests/${requestId}/message`, { message });
      if (data.success) {
        setMsgText((p) => ({ ...p, [requestId]: '' }));
        const entry = data.data?.entry || { sender: 'technician', message, createdAt: new Date().toISOString() };
        setRequests((prev) =>
          prev.map((r) => r._id === requestId
            ? { ...r, conversation: [...(r.conversation || []), entry] }
            : r)
        );
      } else { alert(data.message || 'Failed to send'); }
    } catch { alert('Failed to send message'); }
    finally { setSendingMsg(false); }
  };

  const toggleChargesPanel = (requestId) => {
    if (openChat) {
      if (openChatReqIdRef.current) {
        socket?.emit('request:leave', openChatReqIdRef.current);
        openChatReqIdRef.current = null;
      }
      setOpenChat(null);
    }
    setOpenChargesPanel((prev) => {
      const isClosing = prev === requestId;
      const next = isClosing ? null : requestId;
      openChargesPanelRef.current = next;
      if (!isClosing) socket?.emit('request:join', requestId);
      else socket?.emit('request:leave', requestId);
      return next;
    });
  };

  // ── document re-upload ───────────────────────────────────────────────────────
  const reuploadDocument = async (documentId, file) => {
    if (!file) return;
    setReuploadingDoc(documentId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await API.put(`/technician-auth/documents/${documentId}`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(data.message || (data.success ? 'Document re-uploaded!' : 'Upload failed'));
      if (data.success) loadData();
    } catch { alert('Re-upload failed'); }
    finally { setReuploadingDoc(null); }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6c757d' }}>Loading dashboard…</div>
    );
  }

  const tabStyle = (key) => ({
    padding: '8px 18px', border: 'none', borderRadius: '8px 8px 0 0',
    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
    background: activeTab === key ? '#1a1208' : 'transparent',
    color: activeTab === key ? '#fff' : '#6c757d',
    borderBottom: activeTab === key ? '3px solid #A5732F' : '3px solid transparent',
  });

  const withdrawalStatusColor = { pending: '#b45309', approved: '#16a34a', rejected: '#dc3545', completed: '#2563eb' };
  const withdrawalStatusBg = { pending: 'rgba(234,179,8,0.12)', approved: 'rgba(22,163,74,0.1)', rejected: 'rgba(220,53,69,0.1)', completed: 'rgba(37,99,235,0.1)' };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h2 style={{ fontWeight: 800, color: '#1a1208', marginBottom: 4 }}>Technician Dashboard</h2>

      {/* ── modals ── */}
      {requestModal && (
        <RequestJobModal
          job={requestModal}
          onClose={() => setRequestModal(null)}
          onSuccess={(msg) => { alert(msg); loadData(); }}
        />
      )}

      {submitChargesModal && (
        <SubmitChargesModal
          requestId={submitChargesModal}
          onClose={() => setSubmitChargesModal(null)}
          onSuccess={(msg) => { alert(msg); loadData(); setChargesRefreshKey((k) => k + 1); }}
        />
      )}

      {jobDetailModal && (
        <JobDetailModal
          jobId={jobDetailModal}
          onClose={() => setJobDetailModal(null)}
        />
      )}

      {withdrawModal && (
        <WithdrawModal
          availableBalance={summary.availableBalance}
          onClose={() => setWithdrawModal(false)}
          onSuccess={(msg) => { alert(msg); loadData(); }}
        />
      )}

      {/* ── Profile card ── */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div style={{ flexShrink: 0 }}>
          {profileImagePreview ? (
            <img src={profileImagePreview} alt="Profile"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #A5732F' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg,#A5732F,#d4a050)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff',
                fontSize: '1.8rem', fontWeight: 800, border: '3px solid #A5732F' }}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1208' }}>{profile?.name || 'Technician'}</div>
          <div style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: 6 }}>{profile?.email || ''}</div>
          {profile?.technicianProfile?.verificationStatus && (
            <span style={S.badge(
              profile.technicianProfile.verificationStatus === 'approved' ? '#16a34a' :
              profile.technicianProfile.verificationStatus === 'rejected' ? '#dc3545' : '#b45309',
              profile.technicianProfile.verificationStatus === 'approved' ? 'rgba(22,163,74,0.1)' :
              profile.technicianProfile.verificationStatus === 'rejected' ? 'rgba(220,53,69,0.1)' : 'rgba(234,179,8,0.12)'
            )}>
              {profile.technicianProfile.verificationStatus === 'approved' ? '✓ Verified' :
               profile.technicianProfile.verificationStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending Verification'}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <label style={{ ...S.btn('#A5732F'), display: 'inline-block', cursor: 'pointer' }}>
              📷 {profileImagePreview ? 'Change Photo' : 'Upload Photo'}
              <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
            </label>
            {imageInputRef.current?.files?.[0] && (
              <button style={S.btn('#16a34a', uploadingImage)} onClick={handleUploadImage} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : '✓ Save Photo'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Jobs', value: summary.totalJobsDone, color: '#1a1208' },
          { label: 'Total Earned', value: `₹${summary.totalEarnings.toLocaleString()}`, color: '#A5732F' },
          { label: 'Withdrawn', value: `₹${summary.totalWithdrawn.toLocaleString()}`, color: '#dc3545' },
          { label: 'Available', value: `₹${summary.availableBalance.toLocaleString()}`, color: '#16a34a' },
        ].map((s) => (
          <div key={s.label} style={{ ...S.card, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Metrics row (from /technician/metrics) ── */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Accepted Jobs', value: metrics.acceptedCount, color: '#16a34a' },
            { label: 'Pending Requests', value: metrics.pendingCount, color: '#b45309' },
            { label: 'Acceptance Rate', value: metrics.acceptedCount + metrics.pendingCount > 0
                ? `${Math.round((metrics.acceptedCount / (metrics.acceptedCount + metrics.pendingCount)) * 100)}%`
                : '—', color: '#2563eb' },
          ].map((s) => (
            <div key={s.label} style={{ ...S.card, textAlign: 'center', marginBottom: 0,
                background: 'linear-gradient(135deg,#fdf9f5,#fff)' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <button style={{ ...S.btn('#1a1208'), marginBottom: 20 }} onClick={() => setWithdrawModal(true)}>
        💸 Withdraw
      </button>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #f0e8dc', marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'open',        label: `Open Jobs (${jobs.length})` },
          { key: 'my',          label: `My Jobs (${myJobs.length})` },
          { key: 'requests',    label: `My Requests (${requests.length})` },
          { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})` },
          { key: 'documents',   label: 'My Documents' },
        ].map((t) => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════ OPEN JOBS TAB ════════════════════════════════ */}
      {activeTab === 'open' && (
        <div>
          <h4 style={{ fontWeight: 700, marginBottom: 12 }}>Available Jobs</h4>
          {jobs.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No open jobs right now.</div>
          ) : (
            jobs.map((job) => {
              const myReq = requests.find(
                (r) => (r.job?._id || r.job) === job._id &&
                  ['pending', 'accepted', 'counter-offer'].includes(r.status)
              );
              return (
                <div key={job._id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1208' }}>{job.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{job.category} · {job.location}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#A5732F', fontSize: '1.05rem' }}>₹{job.budget}</div>
                      {job.estimatedTime && <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>⏱ {job.estimatedTime}</div>}
                    </div>
                  </div>
                  <p style={{ color: '#495057', fontSize: '0.875rem', margin: '8px 0 10px' }}>{job.description}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {myReq ? (
                      <>
                        {reqStatusBadge(myReq.status)}
                        <span style={{ fontSize: '0.78rem', color: '#6c757d' }}>
                          {myReq.status === 'accepted' ? '— Job assigned to you'
                            : myReq.status === 'counter-offer' ? '— Awaiting admin review'
                            : '— Waiting for admin response'}
                        </span>
                        
                      </>
                    ) : (
                      <button style={S.btn('#1a1208')} onClick={() => setRequestModal(job)}>Request Job</button>
                    )}
                    {/* View full details */}
                    <button
                      onClick={() => setJobDetailModal(job._id)}
                      style={{ ...S.ghost, fontSize: '0.78rem', padding: '6px 12px' }}>
                      🔍 Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════ MY JOBS TAB ════════════════════════════════ */}
      {activeTab === 'my' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontWeight: 700, margin: 0 }}>My Assigned Jobs</h4>
            <button onClick={refreshMyJobs} style={{ ...S.ghost, fontSize: '0.78rem' }}>🔄 Refresh</button>
          </div>
          {myJobs.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No jobs assigned yet.</div>
          ) : (
            myJobs.map((job) => {
              const alreadyReached = !!job.reachedAt;
              const alreadyCompleted = !!job.jobCompletedAt;
              return (
                <div key={job._id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1208' }}>{job.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{job.category} · {job.location}</div>
                    </div>
                    <span style={S.badge(
                      job.status === 'inprogress' ? '#2563eb' : job.status === 'completed' ? '#16a34a' : '#A5732F',
                      job.status === 'inprogress' ? 'rgba(37,99,235,0.12)' : job.status === 'completed' ? 'rgba(22,163,74,0.12)' : 'rgba(165,115,47,0.12)'
                    )}>{job.status}</span>
                  </div>

                  {job.estimatedTime && (
                    <div style={{ fontSize: '0.8rem', color: '#A5732F', fontWeight: 600, margin: '6px 0' }}>
                      ⏱ {job.estimatedTime}
                    </div>
                  )}

                  {(alreadyReached || alreadyCompleted) && (
                    <div style={{ background: '#fdf9f5', borderRadius: 8, padding: '8px 12px',
                        margin: '8px 0', border: '1px solid #f0e8dc', fontSize: '0.8rem',
                        display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {alreadyReached && (
                        <div><b style={{ color: '#2563eb' }}>📍 Reached:</b> {fmtDT(job.reachedAt)}</div>
                      )}
                      {alreadyCompleted && (
                        <div><b style={{ color: '#16a34a' }}>✅ Completed:</b> {fmtDT(job.jobCompletedAt)}</div>
                      )}
                      {job.jobDurationMinutes != null && (
                        <div><b style={{ color: '#A5732F' }}>⏱ Duration:</b> {formatDuration(job.jobDurationMinutes)}</div>
                      )}
                    </div>
                  )}

                  {/* ── Task Checklist ── */}
                  {job.tasks?.length > 0 && (() => {
                    const GROUPS = ['Prep', 'On Site', 'Post'];
                    const doneCount = job.tasks.filter((t) => t.isDone).length;
                    const pct = Math.round((doneCount / job.tasks.length) * 100);
                    return (
                      <div style={{ margin: '10px 0', border: '1px solid #f0e8dc', borderRadius: 10,
                          background: '#fdf9f5', overflow: 'hidden' }}>
                        {/* header + progress bar */}
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0e8dc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1208' }}>
                              🗂 Tasks
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700,
                                color: doneCount === job.tasks.length ? '#16a34a' : '#A5732F' }}>
                              {doneCount}/{job.tasks.length} done
                            </span>
                          </div>
                          <div style={{ height: 6, background: '#e9e0d5', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`,
                                background: doneCount === job.tasks.length ? '#16a34a' : '#A5732F',
                                borderRadius: 10, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>

                        {/* grouped tasks */}
                        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {GROUPS.map((g) => {
                            const gTasks = job.tasks
                              .map((t, idx) => ({ ...t, _idx: idx }))
                              .filter((t) => t.group === g);
                            if (!gTasks.length) return null;
                            return (
                              <div key={g}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.07em', color: '#A5732F',
                                    borderBottom: '1px solid #f0e8dc', paddingBottom: 3, marginBottom: 4 }}>
                                  {g}
                                </div>
                                {gTasks.map((t) => (
                                  <div key={t._idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '7px 0',
                                    borderBottom: '1px solid #f8f3ed',
                                    opacity: t.isDone ? 0.75 : 1,
                                  }}>
                                    {/* circle checkbox */}
                                    <button
                                      disabled={t.isDone || alreadyCompleted}
                                      onClick={() => completeTask(job._id, t._idx)}
                                      style={{
                                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                        border: t.isDone ? 'none' : '2px solid #d1d5db',
                                        background: t.isDone ? '#16a34a' : '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: t.isDone || alreadyCompleted ? 'default' : 'pointer',
                                        padding: 0, transition: 'background 0.2s',
                                      }}
                                    >
                                      {t.isDone && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2"
                                            strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </button>

                                    {/* title */}
                                    <span style={{ flex: 1, fontSize: '0.85rem', color: '#1a1208',
                                        textDecoration: t.isDone ? 'line-through' : 'none',
                                        color: t.isDone ? '#6c757d' : '#1a1208' }}>
                                      {t.title}
                                    </span>

                                    {/* completion meta */}
                                    {t.isDone && (
                                      <div style={{ display: 'flex', flexDirection: 'column',
                                          alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                                        {t.checkedAt && (
                                          <span style={{ fontSize: '0.65rem', color: '#adb5bd' }}>
                                            {new Date(t.checkedAt).toLocaleTimeString('en-IN',
                                              { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        {t.distanceMeters != null && (
                                          <span style={{ fontSize: '0.65rem', fontWeight: 700,
                                              color: t.distanceMeters <= 200 ? '#16a34a'
                                                : t.distanceMeters <= 1000 ? '#b45309' : '#dc3545' }}>
                                            📏 {t.distanceMeters >= 1000
                                              ? `${(t.distanceMeters / 1000).toFixed(1)} km`
                                              : `${t.distanceMeters} m`}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {!alreadyReached && job.status !== 'completed' && (
                      <button style={S.btn('#2563eb')} onClick={() => markReached(job._id)}>
                        📍 I Reached the Location
                      </button>
                    )}
                    {alreadyReached && !alreadyCompleted && job.status !== 'completed' && (
                      <button style={S.btn('#16a34a')} onClick={() => markCompleted(job._id)}>
                        ✅ Mark Job Completed
                      </button>
                    )}
                    {alreadyCompleted && (
                      <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 700, padding: '8px 0' }}>
                        ✓ Waiting for admin to process payment
                      </span>
                    )}
                    {job.finalPrice > 0 && (
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#A5732F', padding: '8px 0' }}>
                        💰 Final price: ${job.finalPrice}
                      </span>
                    )}
                    <button onClick={() => setJobDetailModal(job._id)}
                      style={{ ...S.ghost, fontSize: '0.78rem', padding: '6px 12px' }}>
                      🔍 Details
                    </button>
                    {(job.coordinates?.lat && job.coordinates?.lng) ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...S.btn('#16a34a'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        🗺️ Navigate
                      </a>
                    ) : job.location ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...S.btn('#16a34a'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        🗺️ Navigate
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════ MY REQUESTS TAB ════════════════════════════════ */}
      {activeTab === 'requests' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontWeight: 700, margin: 0 }}>My Job Requests</h4>
            <button onClick={refreshRequests} style={{ ...S.ghost, fontSize: '0.78rem' }}>🔄 Refresh</button>
          </div>
          {requests.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No requests yet.</div>
          ) : (
            requests.map((req) => {
              const isChat = openChat === req._id;
              const isCharges = openChargesPanel === req._id;
              const convo = req.conversation || [];
              const hasCharges = req.chargesStatus && req.chargesStatus !== 'none';
              const needsReply = req.chargesStatus === 'pending' || req.chargesStatus === 'reviewing';
              const isAdminCounter = req.status === 'counter-offer' && req.counterOfferFrom === 'admin';

              return (
                <div key={req._id} style={S.card}>
                  {/* header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a1208' }}>{req.job?.title || 'Job'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{req.job?.location || ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {reqStatusBadge(req.status)}
                      {hasCharges && (
                        <span style={S.badge(
                          req.chargesStatus === 'invoiced' ? '#A5732F' : req.chargesStatus === 'agreed' ? '#16a34a' :
                          needsReply ? '#b45309' : '#2563eb',
                          req.chargesStatus === 'invoiced' ? 'rgba(165,115,47,0.15)' : req.chargesStatus === 'agreed' ? 'rgba(22,163,74,0.12)' :
                          needsReply ? 'rgba(234,179,8,0.15)' : 'rgba(37,99,235,0.1)'
                        )}>
                          {req.chargesStatus === 'invoiced' ? '🧾 Invoiced'
                            : req.chargesStatus === 'agreed' ? '✓ Agreed'
                            : needsReply ? '⏳ Charges Pending'
                            : '↔ Reviewing'}
                        </span>
                      )}
                    </div>
                  </div>

                  {req.note && (
                    <p style={{ color: '#6c757d', fontSize: '0.82rem', margin: '0 0 6px', fontStyle: 'italic' }}>
                      "{req.note}"
                    </p>
                  )}

                  {/* Admin counter-offer banner */}
                  {/* Admin counter-offer banner */}
{isAdminCounter && req.counterOffer > 0 && (
  <div
    style={{
      padding: '10px 12px',
      background: 'rgba(37,99,235,0.06)',
      border: '1px solid rgba(37,99,235,0.2)',
      borderRadius: 8,
      marginBottom: 8,
    }}
  >
    <div
      style={{
        fontSize: '0.85rem',
        fontWeight: 700,
        color: '#2563eb',
        marginBottom: 8,
      }}
    >
      ↔ Admin counter-offer: $
      {Number(req.counterOffer).toLocaleString()}
    </div>

    <div
      style={{
        fontSize: '0.78rem',
        color: '#6c757d',
        marginBottom: 10,
      }}
    >
      You can respond to this offer from the Charges & Invoice section.
    </div>

    <button
      onClick={() => toggleChargesPanel(req._id)}
      style={S.btn('#2563eb')}
    >
      🧾 View Charges & Respond
    </button>
  </div>
)}

                  {req.amountEarned > 0 && (
                    <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem', marginBottom: 6 }}>
                      💰 Earned: ${req.amountEarned}
                    </div>
                  )}

                  {/* action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => openChatFor(req._id)}
                      style={{ background: isChat ? '#f0e8dc' : '#1a1208', color: isChat ? '#1a1208' : '#fff',
                        border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem',
                        fontWeight: 700, cursor: 'pointer' }}>
                      💬 {isChat ? 'Close Chat' : `Chat${convo.length ? ` (${convo.length})` : ''}`}
                    </button>

                    {(hasCharges || req.status === 'accepted') && (
                      <button onClick={() => toggleChargesPanel(req._id)}
                        style={{ background: isCharges ? 'rgba(165,115,47,0.15)' : 'rgba(165,115,47,0.1)',
                          color: '#A5732F', border: '1.5px solid rgba(165,115,47,0.3)',
                          borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                        🧾 {isCharges ? 'Close' : 'Charges & Invoice'}
                        {needsReply && <span style={{ marginLeft: 4, color: '#b45309' }}>●</span>}
                      </button>
                    )}

                    {/* Submit additional charges — available on accepted requests */}
                    {['pending', 'counter-offer'].includes(req.status) && (
                      <button
                        onClick={() => cancelRequest(req._id)}
                        style={{ background: 'rgba(220,53,69,0.08)', color: '#dc3545',
                          border: '1.5px solid rgba(220,53,69,0.25)', borderRadius: 8,
                          padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ✕ Cancel Request
                      </button>
                    )}

                    {req.status === 'accepted' && (
                      <button onClick={() => setSubmitChargesModal(req._id)}
                        style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                          border: '1.5px solid rgba(22,163,74,0.3)', borderRadius: 8,
                          padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                        + Submit Charges
                      </button>
                    )}
                  </div>

                  {/* ── chat window ── */}
                  {isChat && (
                    <div style={{ marginTop: 12, border: '1px solid #e9e0d5', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: 260, overflowY: 'auto', padding: 12, background: '#fdf9f5',
                          display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loadingChat === req._id ? (
                          <div style={{ color: '#adb5bd', textAlign: 'center', marginTop: 80, fontSize: '0.85rem' }}>Loading…</div>
                        ) : convo.length === 0 ? (
                          <div style={{ color: '#adb5bd', textAlign: 'center', marginTop: 80, fontSize: '0.85rem' }}>No messages yet.</div>
                        ) : (
                          convo.map((msg, i) => {
                            const isMe = msg.sender === 'technician';

                            // ── Counter-offer entry ──
                            if (msg.type === 'counter-offer' ||
                                (!msg.type && (msg.counterOffer > 0 || msg.counterAmount > 0))) {
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                  <CounterOfferBubble msg={msg} isMe={isMe} />
                                </div>
                              );
                            }

                            // ── Accept / Reject event ──
                            if (msg.type === 'accept' || msg.type === 'reject') {
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                  <AcceptRejectBubble msg={msg} isMe={isMe} />
                                </div>
                              );
                            }

                            // ── System event ──
                            if (msg.type === 'system' || msg.sender === 'system') {
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                                  <div style={{
                                    fontSize: '0.72rem', color: '#adb5bd', background: '#f8f3ed',
                                    border: '1px solid #e9e0d5', borderRadius: 20,
                                    padding: '3px 12px', fontStyle: 'italic',
                                  }}>
                                    {msg.message}
                                  </div>
                                </div>
                              );
                            }

                            // ── Plain text message ──
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                <div style={{ maxWidth: '72%', padding: '8px 12px',
                                    borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                    background: isMe ? '#1a1208' : '#fff',
                                    color: isMe ? '#fff' : '#1a1208',
                                    border: isMe ? 'none' : '1px solid #e9e0d5',
                                    fontSize: '0.83rem', lineHeight: 1.45 }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.7rem', marginBottom: 3,
                                      color: isMe ? '#d4a050' : '#A5732F' }}>
                                    {isMe ? 'You' : 'Admin'}
                                  </div>
                                  {msg.message}
                                  <div style={{ fontSize: '0.65rem', marginTop: 4,
                                      color: isMe ? 'rgba(255,255,255,0.55)' : '#adb5bd', textAlign: 'right' }}>
                                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, padding: '10px 12px',
                          background: '#fff', borderTop: '1px solid #e9e0d5' }}>
                        <input type="text" placeholder="Type a message…"
                          value={msgText[req._id] || ''}
                          onChange={(e) => setMsgText((p) => ({ ...p, [req._id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && !sendingMsg && sendMessage(req._id)}
                          style={{ flex: 1, border: '1.5px solid #e9e0d5', borderRadius: 8,
                            padding: '8px 12px', fontSize: '0.85rem', outline: 'none' }} />
                        <button onClick={() => sendMessage(req._id)}
                          disabled={sendingMsg || !msgText[req._id]?.trim()}
                          style={S.btn('#A5732F', sendingMsg || !msgText[req._id]?.trim())}>
                          {sendingMsg ? '…' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── charges & invoice panel ── */}
                  {isCharges && (
                    <div style={{ marginTop: 12, border: '1px solid #f0e8dc', borderRadius: 10,
                        background: '#fffcf8', padding: '4px 8px' }}>
                      <ChargesInvoicePanel
                        requestId={req._id}
                        onUpdate={loadData}
                        refreshKey={chargesRefreshKey}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════ WITHDRAWALS TAB ════════════════════════════════ */}
      {activeTab === 'withdrawals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontWeight: 700, margin: 0 }}>Withdrawal History</h4>
            <button style={S.btn('#1a1208')} onClick={() => setWithdrawModal(true)}>💸 New Withdrawal</button>
          </div>

          {withdrawals.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No withdrawals yet.</div>
          ) : (
            withdrawals.map((w) => (
              <div key={w._id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1208' }}>
                      ${Number(w.amount).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: 2 }}>
                      {w.method} · {fmtDT(w.createdAt)}
                    </div>
                    {w.details && (
                      <div style={{ fontSize: '0.78rem', color: '#6c757d', marginTop: 2, fontStyle: 'italic' }}>
                        {w.details}
                      </div>
                    )}
                  </div>
                  <span style={S.badge(
                    withdrawalStatusColor[w.status] || '#6c757d',
                    withdrawalStatusBg[w.status] || 'rgba(108,117,125,0.1)'
                  )}>
                    {w.status === 'completed' ? '✓ Completed'
                     : w.status === 'approved' ? '✓ Approved'
                     : w.status === 'rejected' ? '✗ Rejected'
                     : '⏳ Pending'}
                  </span>
                </div>
                {w.adminNote && (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#6c757d',
                      borderLeft: '3px solid #dee2e6', paddingLeft: 8, fontStyle: 'italic' }}>
                    Admin: {w.adminNote}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════ DOCUMENTS TAB ════════════════════════════════ */}
      {activeTab === 'documents' && (() => {
        const docs = profile?.technicianProfile?.documents || [];
        const statusColor = { approved: '#16a34a', rejected: '#dc3545', pending: '#b45309' };
        const statusBg    = { approved: 'rgba(22,163,74,0.1)', rejected: 'rgba(220,53,69,0.1)', pending: 'rgba(180,83,9,0.1)' };
        const statusIcon  = { approved: '✓', rejected: '✗', pending: '⏳' };
        return (
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: 12 }}>My Documents</h4>
            {docs.length === 0 ? (
              <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No documents uploaded yet.</div>
            ) : (
              docs.map((doc) => (
                <div key={doc.documentId} style={{ ...S.card, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#1a1208', marginBottom: 4 }}>{doc.label || doc.documentId}</div>
                    <span style={S.badge(statusColor[doc.status] || '#6c757d', statusBg[doc.status] || 'rgba(108,117,125,0.1)')}>
                      {statusIcon[doc.status]} {doc.status}
                    </span>
                    {doc.status === 'rejected' && doc.rejectionReason && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: '#fff5f5',
                          border: '1px solid #fecaca', borderRadius: 8, fontSize: '0.82rem', color: '#dc3545' }}>
                        <strong>Reason:</strong> {doc.rejectionReason}
                      </div>
                    )}
                  </div>
                  {doc.status === 'rejected' && (
                    <label style={{ ...S.btn('#A5732F'), display: 'inline-block', cursor: 'pointer',
                        opacity: reuploadingDoc === doc.documentId ? 0.6 : 1 }}>
                      {reuploadingDoc === doc.documentId ? 'Uploading…' : '↑ Re-upload'}
                      <input type="file" hidden disabled={reuploadingDoc === doc.documentId}
                        onChange={(e) => reuploadDocument(doc.documentId, e.target.files[0])} />
                    </label>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default TechnicianDashboard;