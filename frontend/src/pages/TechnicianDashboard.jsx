import { cssValue } from '../utils/cssValue';
import '../styles/TechnicianDashboard.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../services/api';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';

const formatPay = (pay = {}) => {
  const dollars = value => `$${Number(value || 0).toLocaleString()}`;
  if (pay.type === 'hourly') return `${dollars(pay.hourlyRate)}/hour${pay.maxHours ? ` · up to ${pay.maxHours} hours` : ''}`;
  if (pay.type === 'perDevice') return `${dollars(pay.perDeviceRate)}/device${pay.maxDevices ? ` · up to ${pay.maxDevices} devices` : ''}`;
  if (pay.type === 'blended') return `${dollars(pay.blendedFixedAmount)} fixed (${pay.blendedFixedHours || 0} hours) + ${dollars(pay.blendedHourlyRate)}/additional hour`;
  return `${dollars(pay.fixedAmount)} fixed`;
};

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



// ─── charge status badge ───────────────────────────────────────────────────────
const chargeStatusBadge = (status) => {
  const map = {
    pending:   { color: '#b45309', bg: 'rgba(234,179,8,0.15)', label: '⏳ Pending Review' },
    accepted:  { color: '#16a34a', bg: 'rgba(22,163,74,0.12)', label: '✓ Accepted' },
    rejected:  { color: '#dc3545', bg: 'rgba(220,53,69,0.1)',  label: '✗ Rejected' },
    countered: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  label: '↔ Counter Offered' },
  };
  const s = map[status] || { color: '#6c757d', bg: 'rgba(108,117,125,0.1)', label: status };
  return <span className="ui-techniciandashboard-1" style={{ "--ui-techniciandashboard-1-background": cssValue(s.bg, "background"), "--ui-techniciandashboard-1-color": cssValue(s.color, "color") }}>{s.label}</span>;
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
  return <span className="ui-techniciandashboard-2" style={{ "--ui-techniciandashboard-2-background": cssValue(s.bg, "background"), "--ui-techniciandashboard-2-color": cssValue(s.color, "color") }}>{label}</span>;
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
    <div className="ui-techniciandashboard-3"

      onClick={onClose}
    >
      <div className="ui-techniciandashboard-4"

        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-techniciandashboard-5" >
          <h5 className="ui-techniciandashboard-6" >Request: {job.title}</h5>
          <button className="ui-techniciandashboard-7" onClick={onClose} >✕</button>
        </div>

        <div className="ui-techniciandashboard-8" >
          Job budget: <strong className="ui-techniciandashboard-9" >₹{job.budget}</strong> &nbsp;·&nbsp; {job.location}
        </div>

        <label className="ui-techniciandashboard-10" >
          Your Message (optional)
        </label>
        <textarea className="ui-techniciandashboard-11" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="E.g. I have 5 years of experience in this area"

        />

        <label className="ui-techniciandashboard-12" >
          Your Proposed Fixed Price (optional — leave blank to accept job budget)
        </label>
        <div className="ui-techniciandashboard-13" >
          <span className="ui-techniciandashboard-14" >₹</span>
          <input className="ui-techniciandashboard-15" type="number" min="0" value={fixedPrice} onChange={(e) => setFixed(e.target.value)}
            placeholder={`${job.budget} (job budget)`}
             />
        </div>

        <div className="ui-techniciandashboard-16" >
          <label className="ui-techniciandashboard-17" >Additional Charges (optional)</label>
          <button className="ui-techniciandashboard-18" onClick={addCharge} style={{ "--ui-techniciandashboard-18-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-85)", "background"), "--ui-techniciandashboard-18-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-18-opacity": cssValue(false ? 0.7 : 1, "opacity") }}>+ Add Charge</button>
        </div>

        {charges.map((c, i) => (
          <div className="ui-techniciandashboard-19" key={i} >
            <div className="ui-techniciandashboard-20" >
              <select className="ui-techniciandashboard-21" value={c.label} onChange={(e) => updateCharge(i, 'label', e.target.value)}
                >
                {CHARGE_LABELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <div className="ui-techniciandashboard-22" >
                <span className="ui-techniciandashboard-23" >₹</span>
                <input className="ui-techniciandashboard-24" type="number" min="1" value={c.amount} onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  placeholder="0.00"
                   />
              </div>
              <button className="ui-techniciandashboard-25" onClick={() => removeCharge(i)}
                >✕</button>
            </div>
            <input className="ui-techniciandashboard-26" value={c.description} onChange={(e) => updateCharge(i, 'description', e.target.value)}
              placeholder="Description (optional)"
               />
          </div>
        ))}

        <div className="ui-techniciandashboard-27" >
          <button className="ui-techniciandashboard-28" onClick={onClose} >Cancel</button>
          <button className="ui-techniciandashboard-29" onClick={submit} disabled={saving} style={{ "--ui-techniciandashboard-29-background": cssValue(saving ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-29-cursor": cssValue(saving ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-29-opacity": cssValue(saving ? 0.7 : 1, "opacity") }}>
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
    <div className="ui-techniciandashboard-30"

      onClick={onClose}
    >
      <div className="ui-techniciandashboard-31"

        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-techniciandashboard-32" >
          <h5 className="ui-techniciandashboard-33" >Submit Additional Charges</h5>
          <button className="ui-techniciandashboard-34" onClick={onClose} >✕</button>
        </div>
        <p className="ui-techniciandashboard-35" >
          List any extra costs you incurred for this job. Admin will review and approve each charge.
        </p>

        {charges.map((c, i) => (
          <div className="ui-techniciandashboard-36" key={i} >
            <div className="ui-techniciandashboard-37" >
              <select className="ui-techniciandashboard-38" value={c.label} onChange={(e) => updateCharge(i, 'label', e.target.value)}
                >
                {CHARGE_LABELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <div className="ui-techniciandashboard-39" >
                <span className="ui-techniciandashboard-40" >₹</span>
                <input className="ui-techniciandashboard-41" type="number" min="1" value={c.amount} onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  placeholder="0.00"
                   />
              </div>
              {charges.length > 1 && (
                <button className="ui-techniciandashboard-42" onClick={() => removeCharge(i)}
                  >✕</button>
              )}
            </div>
            <input className="ui-techniciandashboard-43" value={c.description} onChange={(e) => updateCharge(i, 'description', e.target.value)}
              placeholder="Description (optional)"
               />
          </div>
        ))}

        <button className="ui-techniciandashboard-44" onClick={addCharge} style={{ "--ui-techniciandashboard-44-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-85)", "background"), "--ui-techniciandashboard-44-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-44-opacity": cssValue(false ? 0.7 : 1, "opacity") }}>
          + Add Another Charge
        </button>

        <div className="ui-techniciandashboard-45" >
          <button className="ui-techniciandashboard-46" onClick={onClose} >Cancel</button>
          <button className="ui-techniciandashboard-47" onClick={submit} disabled={saving} style={{ "--ui-techniciandashboard-47-background": cssValue(saving ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-47-cursor": cssValue(saving ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-47-opacity": cssValue(saving ? 0.7 : 1, "opacity") }}>
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
    <div className="ui-techniciandashboard-48"

      onClick={onClose}
    >
      <div className="ui-techniciandashboard-49"

        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-techniciandashboard-50" >
          <h5 className="ui-techniciandashboard-51" >Job Details</h5>
          <button className="ui-techniciandashboard-52" onClick={onClose} >✕</button>
        </div>

        {loading && <div className="ui-techniciandashboard-53" >Loading…</div>}

        {!loading && !job && (
          <div className="ui-techniciandashboard-54" >Job not found.</div>
        )}

        {!loading && job && (
          <>
            <div className="ui-techniciandashboard-55" >
              <div className="ui-techniciandashboard-56" >{job.title}</div>
              <div className="ui-techniciandashboard-57" >
                {job.category || '—'} · {job.location || '—'}
              </div>
              {job.description && (
                <p className="ui-techniciandashboard-58" >{job.description}</p>
              )}
              <div className="ui-techniciandashboard-59" >
                <span>💰 Budget: <strong className="ui-techniciandashboard-60" >₹{Number(job.budget || 0).toLocaleString()}</strong></span>
                {job.estimatedTime && <span>⏱ Est. time: <strong>{job.estimatedTime}</strong></span>}
                {job.serviceDate && <span>📅 Service: <strong>{fmtDT(job.serviceDate)}</strong></span>}
                <span>Status: {reqStatusBadge(job.status)}</span>
                {job.technicianRating?.score && <span>★ Work order rating: {job.technicianRating.score}/5</span>}
              </div>
            </div>

            {job.assignedTechnician && (
              <div className="ui-techniciandashboard-61" >
                <div className="ui-techniciandashboard-62" >Assigned Technician</div>
                <div className="ui-techniciandashboard-63" >
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
    <div className="ui-techniciandashboard-64"

      onClick={onClose}
    >
      <div className="ui-techniciandashboard-65"

        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-techniciandashboard-66" >
          <h5 className="ui-techniciandashboard-67" >Withdraw Funds</h5>
          <button className="ui-techniciandashboard-68" onClick={onClose} >✕</button>
        </div>

        <div className="ui-techniciandashboard-69" >
          Available balance: <strong className="ui-techniciandashboard-70" >₹{availableBalance.toLocaleString()}</strong>
        </div>

        <label className="ui-techniciandashboard-71" >Amount</label>
        <div className="ui-techniciandashboard-72" >
          <span className="ui-techniciandashboard-73" >₹</span>
          <input className="ui-techniciandashboard-74" type="number" min="1" max={availableBalance} value={amount}
            onChange={(e) => setAmount(e.target.value)}
             />
        </div>

        <label className="ui-techniciandashboard-75" >Method</label>
        <select className="ui-techniciandashboard-76" value={method} onChange={(e) => setMethod(e.target.value)}
          >
          <option value="bank-transfer">Bank Transfer</option>
          <option value="upi">UPI</option>
          <option value="cash">Cash</option>
          <option value="wallet">Wallet</option>
        </select>

        <label className="ui-techniciandashboard-77" >
          Details / Notes (optional)
        </label>
        <textarea className="ui-techniciandashboard-78" rows={2} value={details} onChange={(e) => setDetails(e.target.value)}
          placeholder="E.g. Account number, UPI ID, etc."
           />

        <div className="ui-techniciandashboard-79" >
          <button className="ui-techniciandashboard-80" onClick={onClose} >Cancel</button>
          <button className="ui-techniciandashboard-81" onClick={submit} disabled={saving} style={{ "--ui-techniciandashboard-81-background": cssValue(saving ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-81-cursor": cssValue(saving ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-81-opacity": cssValue(saving ? 0.7 : 1, "opacity") }}>
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
    <div className="ui-techniciandashboard-82" style={{ "--ui-techniciandashboard-82-background": cssValue(bubbleBg, "background"), "--ui-techniciandashboard-82-border": cssValue(`1px solid ${borderColor}`, "border"), "--ui-techniciandashboard-82-border-radius": cssValue(isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px', "borderRadius"), "--ui-techniciandashboard-82-color": cssValue(textColor, "color") }}>
      {/* sender label */}
      <div className="ui-techniciandashboard-83" style={{ "--ui-techniciandashboard-83-color": cssValue(accentColor, "color") }}>
        {isMe ? '🔧 You' : '👤 Admin'} · Counter Offer
      </div>

      {/* fixed / base price — always shown prominently */}
      <div className="ui-techniciandashboard-84" style={{ "--ui-techniciandashboard-84-border-bottom": cssValue(`1px solid ${dividerColor}`, "borderBottom") }}>
        <span className="ui-techniciandashboard-85" style={{ "--ui-techniciandashboard-85-color": cssValue(mutedColor, "color") }}>
          {hasCharges ? 'Base Fixed Price' : 'Counter Amount'}
        </span>
        <span className="ui-techniciandashboard-86" style={{ "--ui-techniciandashboard-86-color": cssValue(isMe ? "var(--ui-color-278)" : "var(--ui-color-96)", "color") }}>
          ${Number(hasCharges ? fixedOnly : (msg.counterAmount || msg.counterOffer || 0)).toLocaleString()}
        </span>
      </div>

      {/* additional charges — collapsible toggle */}
      {hasCharges && (
        <div className="ui-techniciandashboard-87" >
          <button className="ui-techniciandashboard-88"
            onClick={() => setChargesOpen((p) => !p)}
            style={{ "--ui-techniciandashboard-88-color": cssValue(textColor, "color") }}
          >
            <span className="ui-techniciandashboard-89" >
              Additional Charges ({msg.charges.length})
            </span>
            <span className="ui-techniciandashboard-90" >
              <span className="ui-techniciandashboard-91" style={{ "--ui-techniciandashboard-91-color": cssValue(isMe ? "var(--ui-color-278)" : "var(--ui-color-96)", "color") }}>
                +${chargesTotal.toLocaleString()}
              </span>
              <span className="ui-techniciandashboard-92" style={{ "--ui-techniciandashboard-92-color": cssValue(mutedColor, "color") }}>{chargesOpen ? '▲' : '▼'}</span>
            </span>
          </button>

          {chargesOpen && (
            <div className="ui-techniciandashboard-93" >
              {msg.charges.map((c, i) => {
                const chargeStatusMap = {
                  accepted:  { color: '#16a34a', label: '✓' },
                  rejected:  { color: '#dc3545', label: '✗' },
                  countered: { color: '#2563eb', label: '↔' },
                };
                const cs = chargeStatusMap[c.status] || null;
                return (
                  <div className="ui-techniciandashboard-94" key={i} style={{ "--ui-techniciandashboard-94-background": cssValue(isMe ? "var(--ui-color-279)" : "var(--ui-color-280)", "background") }}>
                    <div>
                      <span className="ui-techniciandashboard-95" >{c.label}</span>
                      {c.description && (
                        <span className="ui-techniciandashboard-96" style={{ "--ui-techniciandashboard-96-color": cssValue(mutedColor, "color") }}>
                          {c.description}
                        </span>
                      )}
                    </div>
                    <div className="ui-techniciandashboard-97" >
                      {cs && (
                        <span className="ui-techniciandashboard-98" style={{ "--ui-techniciandashboard-98-color": cssValue(cs.color, "color") }}>{cs.label}</span>
                      )}
                      {c.agreedAmount != null && c.agreedAmount !== c.amount ? (
                        <span>
                          <span className="ui-techniciandashboard-99" style={{ "--ui-techniciandashboard-99-color": cssValue(mutedColor, "color") }}>
                            ${Number(c.amount).toLocaleString()}
                          </span>
                          {' '}
                          <span className="ui-techniciandashboard-100" >
                            ${Number(c.agreedAmount).toLocaleString()}
                          </span>
                        </span>
                      ) : (
                        <span className="ui-techniciandashboard-101" >₹{Number(c.amount).toLocaleString()}</span>
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
      <div className="ui-techniciandashboard-102" style={{ "--ui-techniciandashboard-102-border-top": cssValue(`1px solid ${dividerColor}`, "borderTop") }}>
        <span className="ui-techniciandashboard-103" >Total</span>
        <span className="ui-techniciandashboard-104" style={{ "--ui-techniciandashboard-104-color": cssValue(isMe ? "var(--ui-color-278)" : "var(--ui-color-96)", "color") }}>
          ${Number(msg.counterAmount || msg.counterOffer || 0).toLocaleString()}
        </span>
      </div>

      {/* proposal text */}
      {msg.message && !msg.message.startsWith('Counter offer:') && (
        <div className="ui-techniciandashboard-105" style={{ "--ui-techniciandashboard-105-color": cssValue(mutedColor, "color"), "--ui-techniciandashboard-105-border-top": cssValue(`1px solid ${dividerColor}`, "borderTop") }}>
          "{msg.message.replace(/Counter offer: \$[\d,]+\.?\s*/i, '').replace(/Additional charges:.*$/i, '').trim()}"
        </div>
      )}

      {/* entry status badge */}
      <div className="ui-techniciandashboard-106" >
        <span className="ui-techniciandashboard-107" style={{ "--ui-techniciandashboard-107-background": cssValue(isMe ? "var(--ui-color-281)" : sc.bg, "background"), "--ui-techniciandashboard-107-color": cssValue(isMe ? sc.color : sc.color, "color") }}>
          {sc.label}
        </span>
        <span className="ui-techniciandashboard-108" style={{ "--ui-techniciandashboard-108-color": cssValue(mutedColor, "color") }}>
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
    <div className="ui-techniciandashboard-109" style={{ "--ui-techniciandashboard-109-border-radius": cssValue(isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', "borderRadius"), "--ui-techniciandashboard-109-background": cssValue(isAccept ? isMe ? "var(--ui-color-282)" : "var(--ui-color-104)" : isMe ? "var(--ui-color-283)" : "var(--ui-color-103)", "background"), "--ui-techniciandashboard-109-border": cssValue(`1px solid ${isAccept ? 'rgba(22,163,74,0.3)' : 'rgba(220,53,69,0.25)'}`, "border"), "--ui-techniciandashboard-109-color": cssValue(isAccept ? "var(--ui-color-90)" : "var(--ui-color-30)", "color") }}>
      <div className="ui-techniciandashboard-110" >
        {isMe ? '🔧 You' : '👤 Admin'}
      </div>
      {isAccept ? '✓ Accepted the counter-offer' : '✗ Rejected the counter-offer'}
      {msg.message && msg.message !== 'Admin accepted the counter-offer.' &&
        msg.message !== 'Technician accepted the counter-offer.' && (
        <div className="ui-techniciandashboard-111" >
          {msg.message}
        </div>
      )}
      <div className="ui-techniciandashboard-112" >
        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
    </div>
  );
};
const TechNegotiationHistory = ({ history }) => {
  const [open, setOpen] = useState(false);
  if (!history || history.length === 0) return null;
  return (
    <div className="ui-techniciandashboard-113" >
      <button className="ui-techniciandashboard-114"
        onClick={() => setOpen((p) => !p)}

      >
        {open ? '▲' : '▼'} {open ? 'Hide' : 'View'} negotiation history ({history.length} rounds)
      </button>
      {open && (
        <div className="ui-techniciandashboard-115" >
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
              <div className="ui-techniciandashboard-116" key={i} style={{ "--ui-techniciandashboard-116-background": cssValue(isMe ? "var(--ui-color-284)" : "var(--ui-color-285)", "background"), "--ui-techniciandashboard-116-border": cssValue(`1px solid ${isMe ? 'rgba(165,115,47,0.15)' : 'rgba(37,99,235,0.12)'}`, "border") }}>
                <div className="ui-techniciandashboard-117" >
                  <span className="ui-techniciandashboard-118" style={{ "--ui-techniciandashboard-118-color": cssValue(isMe ? "var(--ui-color-85)" : "var(--ui-color-96)", "color") }}>
                    {isMe ? '🔧 You' : '👤 Admin'}
                  </span>
                  <span className="ui-techniciandashboard-119" >
                    {h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    }) : ''}
                  </span>
                </div>
                <div className="ui-techniciandashboard-120" >
                  <span className="ui-techniciandashboard-121" style={{ "--ui-techniciandashboard-121-color": cssValue(actionColor, "color") }}>{actionLabel}</span>
                  {h.amount != null && (
                    <span className="ui-techniciandashboard-122" >
                      ${Number(h.amount).toLocaleString()}
                    </span>
                  )}
                </div>
                {h.note && (
                  <div className="ui-techniciandashboard-123" >
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
      <div className="ui-techniciandashboard-124" >
        Loading charges…
      </div>
    );
  }
  if (!data) return null;

  const { charges, summary, nextAction, invoice } = data;
  const allCharges = charges?.all || [];
  const hasInvoice = !!invoice;

  return (
    <div className="ui-techniciandashboard-125" >

      {/* ── Next-action hint ── */}
      {nextAction && (
        <div className="ui-techniciandashboard-126" >
          💡 {nextAction}
        </div>
      )}

      {/* ── Summary badges ── */}
      {allCharges.length > 0 && (
        <div className="ui-techniciandashboard-127" >
          {summary.pendingAdminReview > 0 && (
            <span className="ui-techniciandashboard-128" >⏳ {summary.pendingAdminReview} pending review</span>
          )}
          {summary.awaitingYourReply > 0 && (
            <span className="ui-techniciandashboard-129" >↔ {summary.awaitingYourReply} need your reply</span>
          )}
          {summary.accepted > 0 && (
            <span className="ui-techniciandashboard-130" >✓ {summary.accepted} accepted</span>
          )}
          {summary.rejected > 0 && (
            <span className="ui-techniciandashboard-131" >✗ {summary.rejected} rejected</span>
          )}
        </div>
      )}

      {/* ── Charge cards ── */}
      {allCharges.length === 0 ? (
        <div className="ui-techniciandashboard-132" >
          No additional charges submitted.
        </div>
      ) : (
        allCharges.map((c) => {
          const myTurn  = c.status === 'countered' && c.pendingWith === 'technician';
          const adminTurn = c.status === 'countered' && c.pendingWith === 'admin';
          const busy    = responding === c._id;
          const showInlineCounter = counterOpen[c._id];

          return (
            <div className="ui-techniciandashboard-133" key={c._id} >

              {/* ── Charge header: label + original asked amount ── */}
              <div className="ui-techniciandashboard-134" >
                <div>
                  <div className="ui-techniciandashboard-135" >{c.label}</div>
                  {c.description && (
                    <div className="ui-techniciandashboard-136" >{c.description}</div>
                  )}
                </div>
                <div className="ui-techniciandashboard-137" >
                  <div className="ui-techniciandashboard-138" >
                    Asked: ${Number(c.requestedAmount).toLocaleString()}
                  </div>
                  {c.status === 'accepted' && c.agreedAmount != null && (
                    <div className="ui-techniciandashboard-139" >
                      ✓ Final: ${Number(c.agreedAmount).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Status badge ── */}
              <div className="ui-techniciandashboard-140" >{chargeStatusBadge(c.status)}</div>

              {/* ── Admin's active counter-offer (your turn to respond) ── */}
              {myTurn && c.adminCounterAmount > 0 && (
                <div className="ui-techniciandashboard-141" >
                  <div className="ui-techniciandashboard-142" >
                    Admin counter-offer: ${Number(c.adminCounterAmount).toLocaleString()}
                  </div>
                  {c.adminNote && (
                    <div className="ui-techniciandashboard-143" >
                      "{c.adminNote}"
                    </div>
                  )}

                  {/* Accept / Re-counter buttons (hidden when inline form is open) */}
                  {!showInlineCounter && (
                    <div className="ui-techniciandashboard-144" >
                      <button className="ui-techniciandashboard-145"
                        disabled={busy}
                        onClick={() => respond(c._id, 'accept')}
                        style={{ "--ui-techniciandashboard-145-background": cssValue(busy ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-145-cursor": cssValue(busy ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-145-opacity": cssValue(busy ? 0.7 : 1, "opacity") }}
                      >
                        {busy ? '…' : `✓ Accept $${Number(c.adminCounterAmount).toLocaleString()}`}
                      </button>
                      <button className="ui-techniciandashboard-146"
                        disabled={busy}
                        onClick={() => {
                          setCounterAmounts((p) => ({ ...p, [c._id]: String(c.adminCounterAmount || '') }));
                          setCounterOpen((p) => ({ ...p, [c._id]: true }));
                        }}
                        style={{ "--ui-techniciandashboard-146-background": cssValue(busy ? "var(--ui-color-29)" : "var(--ui-color-96)", "background"), "--ui-techniciandashboard-146-cursor": cssValue(busy ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-146-opacity": cssValue(busy ? 0.7 : 1, "opacity") }}
                      >
                        ↔ Re-counter
                      </button>
                    </div>
                  )}

                  {/* Inline re-counter form */}
                  {showInlineCounter && (
                    <div className="ui-techniciandashboard-147" >
                      <div className="ui-techniciandashboard-148" >
                        Your counter-offer for "{c.label}"
                        <span className="ui-techniciandashboard-149" >
                          (admin offered ${Number(c.adminCounterAmount).toLocaleString()})
                        </span>
                      </div>
                      <div className="ui-techniciandashboard-150" >
                        <div className="ui-techniciandashboard-151" >
                          <span className="ui-techniciandashboard-152" >₹</span>
                          <input className="ui-techniciandashboard-153"
                            type="number"
                            min="1"
                            placeholder="Your amount"
                            value={counterAmounts[c._id] || ''}
                            onChange={(e) => setCounterAmounts((p) => ({ ...p, [c._id]: e.target.value }))}

                          />
                        </div>
                        <button className="ui-techniciandashboard-154"
                          disabled={busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0}
                          onClick={() => respond(c._id, 'counter', counterAmounts[c._id], counterNotes[c._id] || '')}
                          style={{ "--ui-techniciandashboard-154-background": cssValue(busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0 ? "var(--ui-color-29)" : "var(--ui-color-96)", "background"), "--ui-techniciandashboard-154-cursor": cssValue(busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0 ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-154-opacity": cssValue(busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0 ? 0.7 : 1, "opacity") }}
                        >
                          {busy ? '…' : 'Send'}
                        </button>
                        <button className="ui-techniciandashboard-155"
                          onClick={() => setCounterOpen((p) => ({ ...p, [c._id]: false }))}

                        >
                          Cancel
                        </button>
                      </div>
                      <input className="ui-techniciandashboard-156"
                        type="text"
                        placeholder="Optional note…"
                        value={counterNotes[c._id] || ''}
                        onChange={(e) => setCounterNotes((p) => ({ ...p, [c._id]: e.target.value }))}

                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Waiting for admin (you already re-countered) ── */}
              {adminTurn && c.technicianCounterAmount > 0 && (
                <div className="ui-techniciandashboard-157" >
                  ⏳ Your counter-offer of ${Number(c.technicianCounterAmount).toLocaleString()} is with admin.
                  Waiting for their response…
                </div>
              )}

              {/* ── Admin note on resolved charges ── */}
              {['accepted', 'rejected'].includes(c.status) && c.adminNote && (
                <div className="ui-techniciandashboard-158" >
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
        <div className="ui-techniciandashboard-159" >
          <div className="ui-techniciandashboard-160" >
            <div className="ui-techniciandashboard-161" >🧾 {invoice.invoiceNumber}</div>
            <span className="ui-techniciandashboard-162" style={{ "--ui-techniciandashboard-162-background": cssValue(invoice.status === 'paid' ? "var(--ui-color-97)" : invoice.status === 'finalised' ? "var(--ui-color-95)" : "var(--ui-color-286)", "background"), "--ui-techniciandashboard-162-color": cssValue(invoice.status === 'paid' ? "var(--ui-color-90)" : invoice.status === 'finalised' ? "var(--ui-color-96)" : "var(--ui-color-84)", "color") }}>
              {invoice.status === 'paid' ? '💰 Paid' : invoice.status === 'finalised' ? '✓ Finalised' : 'Draft'}
            </span>
          </div>
          <div className="ui-techniciandashboard-163" >
            <table className="ui-techniciandashboard-164" >
              <thead>
                <tr className="ui-techniciandashboard-165" >
                  <th className="ui-techniciandashboard-166" >Item</th>
                  <th className="ui-techniciandashboard-167" >Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ui-techniciandashboard-168" >
                  <td className="ui-techniciandashboard-169" >{invoice.fixedJobLabel || 'Fixed Job Charge'}</td>
                  <td className="ui-techniciandashboard-170" >
                    ${Number(invoice.fixedJobCharge).toLocaleString()}
                  </td>
                </tr>
                {(invoice.additionalCharges || []).map((ch, i) => (
                  <tr className="ui-techniciandashboard-171" key={i} >
                    <td className="ui-techniciandashboard-172" >
                      <div className="ui-techniciandashboard-173" >{ch.label}</div>
                      {ch.description && <div className="ui-techniciandashboard-174" >{ch.description}</div>}
                    </td>
                    <td className="ui-techniciandashboard-175" >
                      ${Number(ch.agreedAmount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ui-techniciandashboard-176" >
              <div className="ui-techniciandashboard-177" >
                <span>Fixed Charge</span>
                <span>₹{Number(invoice.fixedJobCharge).toLocaleString()}</span>
              </div>
              {invoice.subtotalAdditional > 0 && (
                <div className="ui-techniciandashboard-178" >
                  <span>Additional Charges</span>
                  <span>₹{Number(invoice.subtotalAdditional).toLocaleString()}</span>
                </div>
              )}
              <div className="ui-techniciandashboard-179" >
                <span>Total</span>
                <span className="ui-techniciandashboard-180" >₹{Number(invoice.totalAmount).toLocaleString()}</span>
              </div>
            </div>
            {invoice.status === 'paid' && invoice.paidAt && (
              <div className="ui-techniciandashboard-181" >
                ✓ Paid on {fmtDT(invoice.paidAt)} — Check your wallet
              </div>
            )}
            {invoice.status === 'finalised' && (
              <div className="ui-techniciandashboard-182" >
                ⏳ Invoice finalised — Waiting for admin to process payment
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Task completion evidence ──────────────────────────────────────────────────
const TaskCompletionModal = ({ task, onClose, onSubmit, saving }) => {
  const [note, setNote] = useState('');
  const [image, setImage] = useState(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const signedRef = useRef(false);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return { x: (source.clientX - rect.left) * (canvas.width / rect.width), y: (source.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event) => { event.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); drawingRef.current = true; signedRef.current = true; };
  const draw = (event) => { if (!drawingRef.current) return; event.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = point(event); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const stop = () => { drawingRef.current = false; };
  const clearSignature = () => { const canvas = canvasRef.current; canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); signedRef.current = false; };
  const submit = () => {
    if (task.requiresNote && !note.trim()) return alert('Please write the required completion note.');
    if (task.requiresImage && !image) return alert('Please upload the required completion image.');
    if (task.requiresSignature && !signedRef.current) return alert('Please capture the required signature.');
    if (task.requiresSignature) canvasRef.current.toBlob((blob) => onSubmit({ note: note.trim(), image, signature: new File([blob], 'signature.png', { type: 'image/png' }) }), 'image/png');
    else onSubmit({ note: note.trim(), image, signature: null });
  };
  return <div className="ui-techniciandashboard-183"  onClick={onClose}>
    <div className="ui-techniciandashboard-184"  onClick={(e) => e.stopPropagation()}>
      <div className="ui-techniciandashboard-185" ><h5 className="ui-techniciandashboard-186" >Complete task</h5><button className="ui-techniciandashboard-187" onClick={onClose} >×</button></div>
      <p className="ui-techniciandashboard-188" >{task.title}</p>
      {task.requirementReason && <div className="ui-techniciandashboard-189" ><strong className="ui-techniciandashboard-190" >Why this is required:</strong> {task.requirementReason}</div>}
      {task.requiresNote && <><label className="ui-techniciandashboard-191" >Completion note <span className="ui-techniciandashboard-192" >*</span></label><textarea className="ui-techniciandashboard-193" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Describe the completed work…"  /></>}
      {task.requiresImage && <><label className="ui-techniciandashboard-194" >Completion image <span className="ui-techniciandashboard-195" >*</span></label><input className="ui-techniciandashboard-196" type="file" accept="image/*" capture="environment" onChange={(e) => setImage(e.target.files?.[0] || null)}  />{image && <div className="ui-techniciandashboard-197" >✓ {image.name}</div>}</>}
      {task.requiresSignature && <><div className="ui-techniciandashboard-198" ><label className="ui-techniciandashboard-199" >Customer signature <span className="ui-techniciandashboard-200" >*</span></label><button className="ui-techniciandashboard-201" type="button" onClick={clearSignature} >Clear</button></div><canvas className="ui-techniciandashboard-202" ref={canvasRef} width="820" height="260" onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerLeave={stop}  /></>}
      <div className="ui-techniciandashboard-203" ><button className="ui-techniciandashboard-204" onClick={onClose} >Cancel</button><button className="ui-techniciandashboard-205" onClick={submit} disabled={saving} style={{ "--ui-techniciandashboard-205-background": cssValue(saving ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-205-cursor": cssValue(saving ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-205-opacity": cssValue(saving ? 0.7 : 1, "opacity") }}>{saving ? 'Saving…' : 'Complete task'}</button></div>
    </div>
  </div>;
};

// ─── Main Component ────────────────────────────────────────────────────────────
const TechnicianDashboard = () => {
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [respondingInvitation, setRespondingInvitation] = useState(null);
  const [respondingCounter, setRespondingCounter] = useState(null);
  const [fixedCounterAmounts, setFixedCounterAmounts] = useState({});
  const [withdrawals, setWithdrawals] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [summary, setSummary] = useState({
    totalJobsDone: 0, totalEarnings: 0, totalWithdrawn: 0, availableBalance: 0,
  });

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionTask, setCompletionTask] = useState(null);
  const [completingTask, setCompletingTask] = useState(false);
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
          rating: tech.rating ?? null,
          ratingCount: tech.ratingCount || 0,
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
  const respondToInvitation = async (requestId, action) => {
    setRespondingInvitation(requestId);
    try {
      const { data } = await API.patch(`/technician/job-invitations/${requestId}/respond`, { action });
      toast.success(data.message); await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not respond to the invitation.');
      await loadData();
    } finally { setRespondingInvitation(null); }
  };

  const respondToFixedCounter = async (requestId, action) => {
    setRespondingCounter(requestId);
    try {
      const counterOffer = fixedCounterAmounts[requestId];
      if (action === 'counter' && (!counterOffer || Number(counterOffer) <= 0)) return alert('Enter a valid counter-offer amount.');
      await API.patch(`/technician/requests/${requestId}/respond`, { action, ...(action === 'counter' ? { counterOffer: Number(counterOffer) } : {}) });
      await loadData();
      setFixedCounterAmounts(p => ({ ...p, [requestId]: '' }));
    } catch (err) { alert(err.response?.data?.message || 'Unable to respond to counter-offer.'); }
    finally { setRespondingCounter(null); }
  };

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
    const jobId = searchParams.get('jobId');
    if (jobId) setJobDetailModal(jobId);
  }, [searchParams]);

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
    const onRequestAssigned = ({ request }) => {
      if (!request) return;
      setRequests((prev) => prev.map((r) => r._id === request._id ? { ...r, ...request } : r));
      refreshRequests();
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

    socket.on('job:invitation', refreshRequests);
    socket.on('job:availability', loadData);
    socket.on('job:updated', loadData);
    socket.on('job:new', onJobNew);
    socket.on('request:message', onRequestMessage);
    socket.on('request:status', onRequestStatus);
    socket.on('request:updated', onRequestUpdated);
    socket.on('request:assigned', onRequestAssigned);
    socket.on('charge:reviewed', onChargeReviewed);
    socket.on('invoice:generated', onInvoiceGenerated);
    socket.on('invoice:paid', onInvoicePaid);
    socket.on('technician:verificationUpdated', onVerificationUpdated);

    return () => {
      socket.off('job:invitation', refreshRequests);
      socket.off('job:availability', loadData);
      socket.off('job:updated', loadData);
      socket.off('job:new', onJobNew);
      socket.off('request:message', onRequestMessage);
      socket.off('request:status', onRequestStatus);
      socket.off('request:updated', onRequestUpdated);
      socket.off('request:assigned', onRequestAssigned);
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
  const completeTask = async (jobId, taskIndex, evidence = {}) => {
    try {
      const coords = await getCurrentCoords();
      const body = new FormData();
      if (coords) { body.append('lat', coords.lat); body.append('lng', coords.lng); }
      if (evidence.note) body.append('completionNote', evidence.note);
      if (evidence.image) body.append('completionImage', evidence.image);
      if (evidence.signature) body.append('signature', evidence.signature);
      setCompletingTask(true);
      const { data } = await API.patch(`/technician/jobs/${jobId}/tasks/${taskIndex}/complete`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.success) {
        setMyJobs((prev) => prev.map((j) => {
          if (j._id !== jobId) return j;
          const tasks = [...(j.tasks || [])];
          tasks[taskIndex] = data.data.task;
          return { ...j, tasks };
        }));
        setCompletionTask(null);
      } else {
        alert(data.message || 'Failed');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete task');
    } finally { setCompletingTask(false); }
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
      <div className="ui-techniciandashboard-206" >Loading dashboard…</div>
    );
  }



  const withdrawalStatusColor = { pending: '#b45309', approved: '#16a34a', rejected: '#dc3545', completed: '#2563eb' };
  const withdrawalStatusBg = { pending: 'rgba(234,179,8,0.12)', approved: 'rgba(22,163,74,0.1)', rejected: 'rgba(220,53,69,0.1)', completed: 'rgba(37,99,235,0.1)' };

  return (
    <div className="ui-techniciandashboard-207" >
      <h2 className="ui-techniciandashboard-208" >Technician Dashboard</h2>

      {/* ── modals ── */}
      {completionTask && (
        <TaskCompletionModal
          task={completionTask.task}
          saving={completingTask}
          onClose={() => !completingTask && setCompletionTask(null)}
          onSubmit={(evidence) => completeTask(completionTask.jobId, completionTask.taskIndex, evidence)}
        />
      )}
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
      <div className="ui-techniciandashboard-209" >
        <div className="ui-techniciandashboard-210" >
          {profileImagePreview ? (
            <img className="ui-techniciandashboard-211" src={profileImagePreview} alt="Profile"
               />
          ) : (
            <div className="ui-techniciandashboard-212" >
              {profile?.name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
          )}
        </div>
        <div className="ui-techniciandashboard-213" >
          <div className="ui-techniciandashboard-214" >{profile?.name || 'Technician'}</div>
          <div className="ui-techniciandashboard-215" >{profile?.email || ''}</div>
          {profile?.technicianProfile?.verificationStatus && (
            <span className="ui-techniciandashboard-216" style={{ "--ui-techniciandashboard-216-background": cssValue(profile.technicianProfile.verificationStatus === 'approved' ? "var(--ui-color-104)" : profile.technicianProfile.verificationStatus === 'rejected' ? "var(--ui-color-88)" : "var(--ui-color-287)", "background"), "--ui-techniciandashboard-216-color": cssValue(profile.technicianProfile.verificationStatus === 'approved' ? "var(--ui-color-90)" : profile.technicianProfile.verificationStatus === 'rejected' ? "var(--ui-color-30)" : "var(--ui-color-94)", "color") }}>
              {profile.technicianProfile.verificationStatus === 'approved' ? '✓ Verified' :
               profile.technicianProfile.verificationStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending Verification'}
            </span>
          )}
          <div className="ui-techniciandashboard-217" >
            <label className="ui-techniciandashboard-218" style={{ "--ui-techniciandashboard-218-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-85)", "background"), "--ui-techniciandashboard-218-opacity": cssValue(false ? 0.7 : 1, "opacity") }}>
              📷 {profileImagePreview ? 'Change Photo' : 'Upload Photo'}
              <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
            </label>
            {imageInputRef.current?.files?.[0] && (
              <button className="ui-techniciandashboard-219" style={{ "--ui-techniciandashboard-219-background": cssValue(uploadingImage ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-219-cursor": cssValue(uploadingImage ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-219-opacity": cssValue(uploadingImage ? 0.7 : 1, "opacity") }} onClick={handleUploadImage} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : '✓ Save Photo'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="ui-techniciandashboard-220" >
        {[
          { label: 'Average Rating', value: summary.rating == null ? 'Not yet rated' : `${Number(summary.rating).toFixed(2)}/5 (${summary.ratingCount} ratings)`, color: '#A5732F' },
          { label: 'Total Jobs', value: summary.totalJobsDone, color: '#1a1208' },
          { label: 'Total Earned', value: `₹${summary.totalEarnings.toLocaleString()}`, color: '#A5732F' },
          { label: 'Withdrawn', value: `₹${summary.totalWithdrawn.toLocaleString()}`, color: '#dc3545' },
          { label: 'Available', value: `₹${summary.availableBalance.toLocaleString()}`, color: '#16a34a' },
        ].map((s) => (
          <div className="ui-techniciandashboard-221" key={s.label} >
            <div className="ui-techniciandashboard-222" style={{ "--ui-techniciandashboard-222-color": cssValue(s.color, "color") }}>{s.value}</div>
            <div className="ui-techniciandashboard-223" >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Metrics row (from /technician/metrics) ── */}
      {metrics && (
        <div className="ui-techniciandashboard-224" >
          {[
            { label: 'Accepted Jobs', value: metrics.acceptedCount, color: '#16a34a' },
            { label: 'Pending Requests', value: metrics.pendingCount, color: '#b45309' },
            { label: 'Acceptance Rate', value: metrics.acceptedCount + metrics.pendingCount > 0
                ? `${Math.round((metrics.acceptedCount / (metrics.acceptedCount + metrics.pendingCount)) * 100)}%`
                : '—', color: '#2563eb' },
          ].map((s) => (
            <div className="ui-techniciandashboard-225" key={s.label} >
              <div className="ui-techniciandashboard-226" style={{ "--ui-techniciandashboard-226-color": cssValue(s.color, "color") }}>{s.value}</div>
              <div className="ui-techniciandashboard-227" >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="ui-techniciandashboard-228" style={{ "--ui-techniciandashboard-228-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-228-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-228-opacity": cssValue(false ? 0.7 : 1, "opacity") }} onClick={() => setWithdrawModal(true)}>
        💸 Withdraw
      </button>

      {/* ── Tabs ── */}
      <div className="ui-techniciandashboard-229" >
        {[
          { key: 'open',        label: `Open Jobs (${jobs.length})` },
          { key: 'my',          label: `My Jobs (${myJobs.length})` },
          { key: 'requests',    label: `My Requests (${requests.length})` },
          { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})` },
          { key: 'documents',   label: 'My Documents' },
        ].map((t) => (
          <button className="ui-techniciandashboard-230" key={t.key} style={{ "--ui-techniciandashboard-230-background": cssValue(activeTab === t.key ? "var(--ui-color-83)" : "var(--ui-color-120)", "background"), "--ui-techniciandashboard-230-color": cssValue(activeTab === t.key ? "var(--ui-color-2)" : "var(--ui-color-84)", "color"), "--ui-techniciandashboard-230-border-bottom": cssValue(activeTab === t.key ? '3px solid #A5732F' : '3px solid transparent', "borderBottom") }} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════ OPEN JOBS TAB ════════════════════════════════ */}
      {activeTab === 'open' && (
        <div>
          <h4 className="ui-techniciandashboard-231" >Available Jobs</h4>
          {jobs.length === 0 ? (
            <div className="ui-techniciandashboard-232" >No open jobs right now.</div>
          ) : (
            jobs.map((job) => {
              const myReq = requests.find(
                (r) => (r.job?._id || r.job) === job._id &&
                  ['pending', 'accepted', 'counter-offer'].includes(r.status)
              );
              return (
                <div className="ui-techniciandashboard-233" key={job._id} >
                  <div className="ui-techniciandashboard-234" >
                    <div>
                      <div className="ui-techniciandashboard-235" >{job.title}</div>
                      <div className="ui-techniciandashboard-236" >{job.category} · {job.location}</div>
                      {job.technicianRating?.score && <div className="ui-techniciandashboard-237" >★ Work order rating: {job.technicianRating.score}/5</div>}
                    </div>
                    <div className="ui-techniciandashboard-238" >
                      <div className="ui-techniciandashboard-239" >₹{job.budget}</div>
                      {job.estimatedTime && <div className="ui-techniciandashboard-240" >⏱ {job.estimatedTime}</div>}
                    </div>
                  </div>
                  <p className="ui-techniciandashboard-241" >{job.description}</p>
                  <div className="ui-techniciandashboard-242" >
                    {myReq ? (
                      <>
                        {reqStatusBadge(myReq.status)}
                        <span className="ui-techniciandashboard-243" >
                          {myReq.status === 'accepted' ? '— Job assigned to you'
                            : myReq.status === 'counter-offer' ? '— Awaiting admin review'
                            : '— Waiting for admin response'}
                        </span>

                      </>
                    ) : (
                      <button className="ui-techniciandashboard-244" style={{ "--ui-techniciandashboard-244-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-244-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-244-opacity": cssValue(false ? 0.7 : 1, "opacity") }} onClick={() => setRequestModal(job)}>Request Job</button>
                    )}
                    {/* View full details */}
                    <button className="ui-techniciandashboard-245"
                      onClick={() => setJobDetailModal(job._id)}
                      >
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
          <div className="ui-techniciandashboard-246" >
            <h4 className="ui-techniciandashboard-247" >My Assigned Jobs</h4>
            <button className="ui-techniciandashboard-248" onClick={refreshMyJobs} >🔄 Refresh</button>
          </div>
          {myJobs.length === 0 ? (
            <div className="ui-techniciandashboard-249" >No jobs assigned yet.</div>
          ) : (
            myJobs.map((job) => {
              const alreadyReached = !!job.reachedAt;
              const alreadyCompleted = !!job.jobCompletedAt;
              return (
                <div className="ui-techniciandashboard-250" key={job._id} >
                  <div className="ui-techniciandashboard-251" >
                    <div>
                      <div className="ui-techniciandashboard-252" >{job.title}</div>
                      <div className="ui-techniciandashboard-253" >{job.category} · {job.location}</div>
                      {job.technicianRating?.score && <div className="ui-techniciandashboard-254" >★ Work order rating: {job.technicianRating.score}/5</div>}
                    </div>
                    <span className="ui-techniciandashboard-255" style={{ "--ui-techniciandashboard-255-background": cssValue(job.status === 'inprogress' ? "var(--ui-color-288)" : job.status === 'completed' ? "var(--ui-color-97)" : "var(--ui-color-289)", "background"), "--ui-techniciandashboard-255-color": cssValue(job.status === 'inprogress' ? "var(--ui-color-96)" : job.status === 'completed' ? "var(--ui-color-90)" : "var(--ui-color-85)", "color") }}>{job.status}</span>
                  </div>

                  {job.estimatedTime && (
                    <div className="ui-techniciandashboard-256" >
                      ⏱ {job.estimatedTime}
                    </div>
                  )}

                  {(alreadyReached || alreadyCompleted) && (
                    <div className="ui-techniciandashboard-257" >
                      {alreadyReached && (
                        <>
                          <div><b className="ui-techniciandashboard-258" >📍 Reached:</b> {fmtDT(job.reachedAt)}</div>
                          {job.reachedStatus?.siteStatus && (
                            <div>
                              <b className="ui-techniciandashboard-259" style={{ "--ui-techniciandashboard-259-color": cssValue(job.reachedStatus.siteStatus === 'onsite' ? "var(--ui-color-90)" : "var(--ui-color-30)", "color") }}>
                                Site status:
                              </b>{' '}
                              {job.reachedStatus.siteStatus === 'onsite' ? 'Onsite' : 'Offsite'}
                            </div>
                          )}
                        </>
                      )}
                      {alreadyCompleted && (
                        <>
                          <div><b className="ui-techniciandashboard-260" >✅ Completed:</b> {fmtDT(job.jobCompletedAt)}</div>
                          {job.completedStatus?.siteStatus && (
                            <div>
                              <b className="ui-techniciandashboard-261" style={{ "--ui-techniciandashboard-261-color": cssValue(job.completedStatus.siteStatus === 'onsite' ? "var(--ui-color-90)" : "var(--ui-color-30)", "color") }}>
                                Completion site status:
                              </b>{' '}
                              {job.completedStatus.siteStatus === 'onsite' ? 'Onsite' : 'Offsite'}
                            </div>
                          )}
                        </>
                      )}
                      {job.jobDurationMinutes != null && (
                        <div><b className="ui-techniciandashboard-262" >⏱ Duration:</b> {formatDuration(job.jobDurationMinutes)}</div>
                      )}
                    </div>
                  )}

                  {/* ── Task Checklist ── */}
                  {job.tasks?.length > 0 && (() => {
                    const GROUPS = ['Prep', 'On Site', 'Post'];
                    const doneCount = job.tasks.filter((t) => t.isDone).length;
                    const pct = Math.round((doneCount / job.tasks.length) * 100);
                    return (
                      <div className="ui-techniciandashboard-263" >
                        {/* header + progress bar */}
                        <div className="ui-techniciandashboard-264" >
                          <div className="ui-techniciandashboard-265" >
                            <span className="ui-techniciandashboard-266" >
                              🗂 Tasks
                            </span>
                            <span className="ui-techniciandashboard-267" style={{ "--ui-techniciandashboard-267-color": cssValue(doneCount === job.tasks.length ? "var(--ui-color-90)" : "var(--ui-color-85)", "color") }}>
                              {doneCount}/{job.tasks.length} done
                            </span>
                          </div>
                          <div className="ui-techniciandashboard-268" >
                            <div className="ui-techniciandashboard-269" style={{ "--ui-techniciandashboard-269-width": cssValue(`${pct}%`, "width"), "--ui-techniciandashboard-269-background": cssValue(doneCount === job.tasks.length ? "var(--ui-color-90)" : "var(--ui-color-85)", "background") }} />
                          </div>
                        </div>

                        {/* grouped tasks */}
                        <div className="ui-techniciandashboard-270" >
                          {GROUPS.map((g) => {
                            const gTasks = job.tasks
                              .map((t, idx) => ({ ...t, _idx: idx }))
                              .filter((t) => t.group === g);
                            if (!gTasks.length) return null;
                            return (
                              <div key={g}>
                                <div className="ui-techniciandashboard-271" >
                                  {g}
                                </div>
                                {gTasks.map((t) => (
                                  <div className="ui-techniciandashboard-272" key={t._idx} style={{ "--ui-techniciandashboard-272-opacity": cssValue(t.isDone ? 0.75 : 1, "opacity") }}>
                                    {/* circle checkbox */}
                                    <button className="ui-techniciandashboard-273"
                                      disabled={t.isDone || alreadyCompleted}
                                      onClick={() => {
                                        if (t.requiresNote || t.requiresImage || t.requiresSignature) {
                                          setCompletionTask({ jobId: job._id, taskIndex: t._idx, task: t });
                                        } else {
                                          completeTask(job._id, t._idx);
                                        }
                                      }}
                                      style={{ "--ui-techniciandashboard-273-border": cssValue(t.isDone ? 'none' : '2px solid #d1d5db', "border"), "--ui-techniciandashboard-273-background": cssValue(t.isDone ? "var(--ui-color-90)" : "var(--ui-color-2)", "background"), "--ui-techniciandashboard-273-cursor": cssValue(t.isDone || alreadyCompleted ? 'default' : 'pointer', "cursor") }}
                                    >
                                      {t.isDone && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2"
                                            strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </button>

                                    {/* title */}
                                    <span className="ui-techniciandashboard-274" style={{ "--ui-techniciandashboard-274-color": cssValue(t.isDone ? "var(--ui-color-84)" : "var(--ui-color-83)", "color"), "--ui-techniciandashboard-274-text-decoration": cssValue(t.isDone ? 'line-through' : 'none', "textDecoration") }}>
                                      {t.title}
                                    </span>

                                    {/* completion meta */}
                                    {t.isDone && (
                                      <div className="ui-techniciandashboard-275" >
                                        {t.checkedAt && (
                                          <span className="ui-techniciandashboard-276" >
                                            {new Date(t.checkedAt).toLocaleTimeString('en-IN',
                                              { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        {(t.distanceMiles != null || t.distanceMeters != null) && (
                                          <span className="ui-techniciandashboard-277" style={{ "--ui-techniciandashboard-277-color": cssValue((t.distanceMiles ?? t.distanceMeters / 1609.344) <= 0.124274 ? "var(--ui-color-90)" : (t.distanceMiles ?? t.distanceMeters / 1609.344) <= 0.621371 ? "var(--ui-color-94)" : "var(--ui-color-30)", "color") }}>
                                            📏 {(t.distanceMiles ?? t.distanceMeters / 1609.344).toFixed(2)} mi
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

                  <div className="ui-techniciandashboard-278" >
                    {!alreadyReached && job.status !== 'completed' && (
                      <button className="ui-techniciandashboard-279" style={{ "--ui-techniciandashboard-279-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-96)", "background"), "--ui-techniciandashboard-279-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-279-opacity": cssValue(false ? 0.7 : 1, "opacity") }} onClick={() => markReached(job._id)}>
                        📍 I Reached the Location
                      </button>
                    )}
                    {alreadyReached && !alreadyCompleted && job.status !== 'completed' && (
                      <button className="ui-techniciandashboard-280" style={{ "--ui-techniciandashboard-280-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-280-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-280-opacity": cssValue(false ? 0.7 : 1, "opacity") }} onClick={() => markCompleted(job._id)}>
                        ✅ Mark Job Completed
                      </button>
                    )}
                    {alreadyCompleted && (
                      <span className="ui-techniciandashboard-281" >
                        ✓ Waiting for admin to process payment
                      </span>
                    )}
                    {job.finalPrice > 0 && (
                      <span className="ui-techniciandashboard-282" >
                        💰 Final price: ${job.finalPrice}
                      </span>
                    )}
                    <button className="ui-techniciandashboard-283" onClick={() => setJobDetailModal(job._id)}
                      >
                      🔍 Details
                    </button>
                    {(job.coordinates?.lat && job.coordinates?.lng) ? (
                      <a className="ui-techniciandashboard-284"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ "--ui-techniciandashboard-284-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-284-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-284-opacity": cssValue(false ? 0.7 : 1, "opacity") }}
                      >
                        🗺️ Navigate
                      </a>
                    ) : job.location ? (
                      <a className="ui-techniciandashboard-285"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ "--ui-techniciandashboard-285-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-285-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-285-opacity": cssValue(false ? 0.7 : 1, "opacity") }}
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
          <div className="ui-techniciandashboard-286" >
            <h4 className="ui-techniciandashboard-287" >My Job Requests</h4>
            <button className="ui-techniciandashboard-288" onClick={refreshRequests} >🔄 Refresh</button>
          </div>
          {requests.length === 0 ? (
            <div className="ui-techniciandashboard-289" >No requests yet.</div>
          ) : (
            requests.map((req) => {
              const isChat = openChat === req._id;
              const isCharges = openChargesPanel === req._id;
              const convo = req.conversation || [];
              const hasCharges = req.chargesStatus && req.chargesStatus !== 'none';
              const needsReply = req.chargesStatus === 'pending' || req.chargesStatus === 'reviewing';
              const isAdminCounter = req.status === 'counter-offer' && req.counterOfferFrom === 'admin';
              const waitingForAssignment = req.status === 'accepted' && req.adminApproved && req.chargesStatus && !['none', 'agreed', 'invoiced'].includes(req.chargesStatus) && !req.job?.assignedTechnician;

              return (
                <div className="ui-techniciandashboard-290" key={req._id} >
                  {/* header */}
                  <div className="ui-techniciandashboard-291" >
                    <div>
                      <div className="ui-techniciandashboard-292" >{req.job?.title || 'Job'}</div>
                      <div className="ui-techniciandashboard-293" >{req.job?.location || ''}</div>
                    </div>
                    <div className="ui-techniciandashboard-294" >
                      {reqStatusBadge(req.status)}
                      {waitingForAssignment && <span className="ui-techniciandashboard-295" >⏳ Approved — charges pending</span>}
                      {hasCharges && (
                        <span className="ui-techniciandashboard-296" style={{ "--ui-techniciandashboard-296-background": cssValue(req.chargesStatus === 'invoiced' ? "var(--ui-color-290)" : req.chargesStatus === 'agreed' ? "var(--ui-color-97)" : needsReply ? "var(--ui-color-93)" : "var(--ui-color-95)", "background"), "--ui-techniciandashboard-296-color": cssValue(req.chargesStatus === 'invoiced' ? "var(--ui-color-85)" : req.chargesStatus === 'agreed' ? "var(--ui-color-90)" : needsReply ? "var(--ui-color-94)" : "var(--ui-color-96)", "color") }}>
                          {req.chargesStatus === 'invoiced' ? '🧾 Invoiced'
                            : req.chargesStatus === 'agreed' ? '✓ Agreed'
                            : needsReply ? '⏳ Charges Pending'
                            : '↔ Reviewing'}
                        </span>
                      )}
                    </div>
                  </div>

                  {req.note && (
                    <p className="ui-techniciandashboard-297" >
                      "{req.note}"
                    </p>
                  )}

                  {/* Admin counter-offer banner */}
                  {/* Admin counter-offer banner */}
{isAdminCounter && req.counterOffer > 0 && (
  <div className="ui-techniciandashboard-298"

  >
    <div className="ui-techniciandashboard-299"

    >
      ↔ Admin counter-offer: $
      {Number(req.counterOffer).toLocaleString()}
    </div>

    <div className="ui-techniciandashboard-300"

    >
      Accept the offer or send a new fixed-price counter-offer.
    </div>

    <div className="ui-techniciandashboard-301" >
      <button className="ui-techniciandashboard-302" disabled={respondingCounter === req._id} onClick={() => respondToFixedCounter(req._id, 'accept')} style={{ "--ui-techniciandashboard-302-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-302-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-302-opacity": cssValue(false ? 0.7 : 1, "opacity") }}>✓ Accept ${Number(req.counterOffer).toLocaleString()}</button>
      <input className="ui-techniciandashboard-303" type="number" min="1" placeholder="New amount" value={fixedCounterAmounts[req._id] || ''} onChange={e => setFixedCounterAmounts(p => ({ ...p, [req._id]: e.target.value }))}  />
      <button className="ui-techniciandashboard-304" disabled={respondingCounter === req._id} onClick={() => respondToFixedCounter(req._id, 'counter')} style={{ "--ui-techniciandashboard-304-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-96)", "background"), "--ui-techniciandashboard-304-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-304-opacity": cssValue(false ? 0.7 : 1, "opacity") }}>↔ Re-counter</button>
      <button className="ui-techniciandashboard-305" disabled={respondingCounter === req._id} onClick={() => respondToFixedCounter(req._id, 'reject')} style={{ "--ui-techniciandashboard-305-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-30)", "background"), "--ui-techniciandashboard-305-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-305-opacity": cssValue(false ? 0.7 : 1, "opacity") }}>✕ Reject</button>
    </div>
  </div>
)}

                  {req.amountEarned > 0 && (
                    <div className="ui-techniciandashboard-306" >
                      💰 Earned: ${req.amountEarned}
                    </div>
                  )}

                  {req.initiatedBy === 'admin' && <div className="ui-techniciandashboard-307" >
                    <strong>Job invitation from admin</strong>
                    <p className="ui-techniciandashboard-308" >{req.adminMessage || 'You have been invited to this job.'}</p>
                    {req.offeredPay && <p className="ui-techniciandashboard-309" >Offered pay: {formatPay(req.offeredPay)}</p>}
                    <button className="ui-techniciandashboard-310"  onClick={() => setJobDetailModal(req.job?._id || req.job)}>View Job Details</button>
                    {req.status === 'pending' && <div className="ui-techniciandashboard-311" >
                      <button className="ui-techniciandashboard-312" style={{ "--ui-techniciandashboard-312-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-90)", "background"), "--ui-techniciandashboard-312-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-312-opacity": cssValue(false ? 0.7 : 1, "opacity") }} disabled={respondingInvitation !== null || req.job?.status !== 'open'} onClick={() => respondToInvitation(req._id, 'accept')}>{respondingInvitation === req._id ? 'Saving…' : 'Accept Job'}</button>
                      <button className="ui-techniciandashboard-313" style={{ "--ui-techniciandashboard-313-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-30)", "background"), "--ui-techniciandashboard-313-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-313-opacity": cssValue(false ? 0.7 : 1, "opacity") }} disabled={respondingInvitation !== null} onClick={() => respondToInvitation(req._id, 'reject')}>Reject Request</button>
                    </div>}
                    {req.status === 'pending' && req.job?.status !== 'open' && <p>This job is no longer open for acceptance.</p>}
                  </div>}
                  {/* action buttons */}
                  <div className="ui-techniciandashboard-314" >
                    <button className="ui-techniciandashboard-315" onClick={() => openChatFor(req._id)}
                      style={{ "--ui-techniciandashboard-315-background": cssValue(isChat ? "var(--ui-color-291)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-315-color": cssValue(isChat ? "var(--ui-color-83)" : "var(--ui-color-2)", "color") }}>
                      💬 {isChat ? 'Close Chat' : `Chat${convo.length ? ` (${convo.length})` : ''}`}
                    </button>

                    {(hasCharges || req.status === 'accepted') && (
                      <button className="ui-techniciandashboard-316" onClick={() => toggleChargesPanel(req._id)}
                        style={{ "--ui-techniciandashboard-316-background": cssValue(isCharges ? "var(--ui-color-290)" : "var(--ui-color-292)", "background") }}>
                        🧾 {isCharges ? 'Close' : 'Charges & Invoice'}
                        {needsReply && <span className="ui-techniciandashboard-317" >●</span>}
                      </button>
                    )}

                    {/* Submit additional charges — available on accepted requests */}
                    {req.initiatedBy !== 'admin' && ['pending', 'counter-offer'].includes(req.status) && (
                      <button className="ui-techniciandashboard-318"
                        onClick={() => cancelRequest(req._id)}

                      >
                        ✕ Cancel Request
                      </button>
                    )}

                    {req.status === 'accepted' && (
                      <button className="ui-techniciandashboard-319" onClick={() => setSubmitChargesModal(req._id)}
                        >
                        + Submit Charges
                      </button>
                    )}
                    {waitingForAssignment && <span className="ui-techniciandashboard-320" >Admin approved your request. Assignment follows after charge negotiation.</span>}
                  </div>

                  {/* ── chat window ── */}
                  {isChat && (
                    <div className="ui-techniciandashboard-321" >
                      <div className="ui-techniciandashboard-322" >
                        {loadingChat === req._id ? (
                          <div className="ui-techniciandashboard-323" >Loading…</div>
                        ) : convo.length === 0 ? (
                          <div className="ui-techniciandashboard-324" >No messages yet.</div>
                        ) : (
                          convo.map((msg, i) => {
                            const isMe = msg.sender === 'technician';

                            // ── Counter-offer entry ──
                            if (msg.type === 'counter-offer' ||
                                (!msg.type && (msg.counterOffer > 0 || msg.counterAmount > 0))) {
                              return (
                                <div className="ui-techniciandashboard-325" key={i} style={{ "--ui-techniciandashboard-325-justify-content": cssValue(isMe ? 'flex-end' : 'flex-start', "justifyContent") }}>
                                  <CounterOfferBubble msg={msg} isMe={isMe} />
                                </div>
                              );
                            }

                            // ── Accept / Reject event ──
                            if (msg.type === 'accept' || msg.type === 'reject') {
                              return (
                                <div className="ui-techniciandashboard-326" key={i} style={{ "--ui-techniciandashboard-326-justify-content": cssValue(isMe ? 'flex-end' : 'flex-start', "justifyContent") }}>
                                  <AcceptRejectBubble msg={msg} isMe={isMe} />
                                </div>
                              );
                            }

                            // ── System event ──
                            if (msg.type === 'system' || msg.sender === 'system') {
                              return (
                                <div className="ui-techniciandashboard-327" key={i} >
                                  <div className="ui-techniciandashboard-328" >
                                    {msg.message}
                                  </div>
                                </div>
                              );
                            }

                            // ── Plain text message ──
                            return (
                              <div className="ui-techniciandashboard-329" key={i} style={{ "--ui-techniciandashboard-329-justify-content": cssValue(isMe ? 'flex-end' : 'flex-start', "justifyContent") }}>
                                <div className="ui-techniciandashboard-330" style={{ "--ui-techniciandashboard-330-border-radius": cssValue(isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', "borderRadius"), "--ui-techniciandashboard-330-background": cssValue(isMe ? "var(--ui-color-83)" : "var(--ui-color-2)", "background"), "--ui-techniciandashboard-330-color": cssValue(isMe ? "var(--ui-color-2)" : "var(--ui-color-83)", "color"), "--ui-techniciandashboard-330-border": cssValue(isMe ? 'none' : '1px solid #e9e0d5', "border") }}>
                                  <div className="ui-techniciandashboard-331" style={{ "--ui-techniciandashboard-331-color": cssValue(isMe ? "var(--ui-color-278)" : "var(--ui-color-85)", "color") }}>
                                    {isMe ? 'You' : 'Admin'}
                                  </div>
                                  {msg.message}
                                  <div className="ui-techniciandashboard-332" style={{ "--ui-techniciandashboard-332-color": cssValue(isMe ? "var(--ui-color-293)" : "var(--ui-color-89)", "color") }}>
                                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="ui-techniciandashboard-333" >
                        <input className="ui-techniciandashboard-334" type="text" placeholder="Type a message…"
                          value={msgText[req._id] || ''}
                          onChange={(e) => setMsgText((p) => ({ ...p, [req._id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && !sendingMsg && sendMessage(req._id)}
                           />
                        <button className="ui-techniciandashboard-335" onClick={() => sendMessage(req._id)}
                          disabled={sendingMsg || !msgText[req._id]?.trim()}
                          style={{ "--ui-techniciandashboard-335-background": cssValue(sendingMsg || !msgText[req._id]?.trim() ? "var(--ui-color-29)" : "var(--ui-color-85)", "background"), "--ui-techniciandashboard-335-cursor": cssValue(sendingMsg || !msgText[req._id]?.trim() ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-335-opacity": cssValue(sendingMsg || !msgText[req._id]?.trim() ? 0.7 : 1, "opacity") }}>
                          {sendingMsg ? '…' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── charges & invoice panel ── */}
                  {isCharges && (
                    <div className="ui-techniciandashboard-336" >
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
          <div className="ui-techniciandashboard-337" >
            <h4 className="ui-techniciandashboard-338" >Withdrawal History</h4>
            <button className="ui-techniciandashboard-339" style={{ "--ui-techniciandashboard-339-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-83)", "background"), "--ui-techniciandashboard-339-cursor": cssValue(false ? 'not-allowed' : 'pointer', "cursor"), "--ui-techniciandashboard-339-opacity": cssValue(false ? 0.7 : 1, "opacity") }} onClick={() => setWithdrawModal(true)}>💸 New Withdrawal</button>
          </div>

          {withdrawals.length === 0 ? (
            <div className="ui-techniciandashboard-340" >No withdrawals yet.</div>
          ) : (
            withdrawals.map((w) => (
              <div className="ui-techniciandashboard-341" key={w._id} >
                <div className="ui-techniciandashboard-342" >
                  <div>
                    <div className="ui-techniciandashboard-343" >
                      ${Number(w.amount).toLocaleString()}
                    </div>
                    <div className="ui-techniciandashboard-344" >
                      {w.method} · {fmtDT(w.createdAt)}
                    </div>
                    {w.details && (
                      <div className="ui-techniciandashboard-345" >
                        {w.details}
                      </div>
                    )}
                  </div>
                  <span className="ui-techniciandashboard-346" style={{ "--ui-techniciandashboard-346-background": cssValue(withdrawalStatusBg[w.status] || 'rgba(108,117,125,0.1)', "background"), "--ui-techniciandashboard-346-color": cssValue(withdrawalStatusColor[w.status] || '#6c757d', "color") }}>
                    {w.status === 'completed' ? '✓ Completed'
                     : w.status === 'approved' ? '✓ Approved'
                     : w.status === 'rejected' ? '✗ Rejected'
                     : '⏳ Pending'}
                  </span>
                </div>
                {w.adminNote && (
                  <div className="ui-techniciandashboard-347" >
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
            <h4 className="ui-techniciandashboard-348" >My Documents</h4>
            {docs.length === 0 ? (
              <div className="ui-techniciandashboard-349" >No documents uploaded yet.</div>
            ) : (
              docs.map((doc) => (
                <div className="ui-techniciandashboard-350" key={doc.documentId} >
                  <div className="ui-techniciandashboard-351" >
                    <div className="ui-techniciandashboard-352" >{doc.label || doc.documentId}</div>
                    <span className="ui-techniciandashboard-353" style={{ "--ui-techniciandashboard-353-background": cssValue(statusBg[doc.status] || 'rgba(108,117,125,0.1)', "background"), "--ui-techniciandashboard-353-color": cssValue(statusColor[doc.status] || '#6c757d', "color") }}>
                      {statusIcon[doc.status]} {doc.status}
                    </span>
                    {doc.status === 'rejected' && doc.rejectionReason && (
                      <div className="ui-techniciandashboard-354" >
                        <strong>Reason:</strong> {doc.rejectionReason}
                      </div>
                    )}
                  </div>
                  {doc.status === 'rejected' && (
                    <label className="ui-techniciandashboard-355" style={{ "--ui-techniciandashboard-355-background": cssValue(false ? "var(--ui-color-29)" : "var(--ui-color-85)", "background"), "--ui-techniciandashboard-355-opacity": cssValue(reuploadingDoc === doc.documentId ? 0.6 : 1, "opacity") }}>
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
