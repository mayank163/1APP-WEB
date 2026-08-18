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
    border: '1px solid #e9e0d5', borderRadius: 12, padding: '1rem 1.25rem',
    background: '#fff', marginBottom: 12,
  },
  btn: (bg = '#1a1208', disabled = false) => ({
    background: disabled ? '#ccc' : bg,
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 18px', fontWeight: 700, fontSize: '0.85rem',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
  }),
  ghost: {
    background: 'transparent', border: '1.5px solid #e9e0d5',
    borderRadius: 8, padding: '6px 14px', fontWeight: 600,
    fontSize: '0.82rem', cursor: 'pointer', color: '#495057',
  },
  badge: (color = '#6c757d', bg = 'rgba(108,117,125,0.1)') => ({
    padding: '3px 12px', borderRadius: 20, fontSize: '0.75rem',
    fontWeight: 700, background: bg, color,
  }),
};

// ─── charge status badge ───────────────────────────────────────────────────────
const chargeStatusBadge = (status) => {
  const map = {
    pending:   { color: '#b45309', bg: 'rgba(234,179,8,0.15)',  label: '⏳ Pending Review' },
    accepted:  { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  label: '✓ Accepted' },
    rejected:  { color: '#dc3545', bg: 'rgba(220,53,69,0.1)',   label: '✗ Rejected' },
    countered: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)',   label: '↔ Counter Offered' },
  };
  const s = map[status] || { color: '#6c757d', bg: 'rgba(108,117,125,0.1)', label: status };
  return <span style={S.badge(s.color, s.bg)}>{s.label}</span>;
};

// ─── request status badge ──────────────────────────────────────────────────────
const reqStatusBadge = (status) => {
  const map = {
    accepted:      { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    rejected:      { color: '#dc3545', bg: 'rgba(220,53,69,0.1)'  },
    'counter-offer': { color: '#b45309', bg: 'rgba(234,179,8,0.15)' },
    pending:       { color: '#6c757d', bg: 'rgba(108,117,125,0.1)' },
  };
  const s = map[status] || map.pending;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';
  return <span style={S.badge(s.color, s.bg)}>{label}</span>;
};

// ─── RequestJobModal ───────────────────────────────────────────────────────────
// Lets tech request a job with optional fixed price + charges in one shot
const CHARGE_LABELS = ['Gas', 'Toll', 'Travel', 'Spare Parts', 'Extra Labor', 'Other'];

const RequestJobModal = ({ job, onClose, onSuccess }) => {
  const [note, setNote]         = useState('');
  const [fixedPrice, setFixed]  = useState('');
  const [charges, setCharges]   = useState([]);
  const [saving, setSaving]     = useState(false);

  const addCharge = () =>
    setCharges((p) => [...p, { label: CHARGE_LABELS[0], description: '', amount: '' }]);

  const updateCharge = (i, field, value) =>
    setCharges((p) => p.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

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
            alert(`Enter a valid amount for "${c.label}"`); setSaving(false); return;
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
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:2000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:520,
        maxHeight:'90vh',overflowY:'auto',padding:'1.5rem' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h5 style={{ margin:0,fontWeight:800,color:'#1a1208' }}>Request: {job.title}</h5>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize:'0.82rem',color:'#6c757d',marginBottom:16 }}>
          Job budget: <strong style={{ color:'#A5732F' }}>${job.budget}</strong> &nbsp;·&nbsp; {job.location}
        </div>

        {/* note */}
        <label style={{ fontSize:'0.8rem',fontWeight:600,color:'#495057',display:'block',marginBottom:4 }}>
          Your Message (optional)
        </label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="E.g. I have 5 years of experience in this area"
          style={{ width:'100%',border:'1.5px solid #e9e0d5',borderRadius:8,padding:'8px 12px',
            fontSize:'0.875rem',outline:'none',marginBottom:12,fontFamily:'inherit',resize:'vertical' }} />

        {/* fixed price */}
        <label style={{ fontSize:'0.8rem',fontWeight:600,color:'#495057',display:'block',marginBottom:4 }}>
          Your Proposed Fixed Price (optional — leave blank to accept job budget)
        </label>
        <div style={{ display:'flex',alignItems:'center',border:'1.5px solid #e9e0d5',borderRadius:8,
          overflow:'hidden',marginBottom:16 }}>
          <span style={{ padding:'0 12px',fontWeight:700,color:'#A5732F',
            background:'rgba(165,115,47,0.07)',borderRight:'1.5px solid #e9e0d5',alignSelf:'stretch',
            display:'flex',alignItems:'center' }}>$</span>
          <input type="number" min="0" value={fixedPrice}
            onChange={(e) => setFixed(e.target.value)}
            placeholder={`${job.budget} (job budget)`}
            style={{ flex:1,border:'none',outline:'none',padding:'8px 12px',fontSize:'0.9rem',fontWeight:600 }} />
        </div>

        {/* additional charges */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
          <label style={{ fontSize:'0.8rem',fontWeight:600,color:'#495057' }}>
            Additional Charges (optional)
          </label>
          <button onClick={addCharge} style={{ ...S.btn('#A5732F'),padding:'5px 12px',fontSize:'0.78rem' }}>
            + Add Charge
          </button>
        </div>

        {charges.map((c, i) => (
          <div key={i} style={{ background:'#fdf9f5',border:'1px solid #f0e8dc',borderRadius:10,
            padding:'10px 12px',marginBottom:8 }}>
            <div style={{ display:'flex',gap:8,marginBottom:6,flexWrap:'wrap' }}>
              <select value={c.label} onChange={(e) => updateCharge(i, 'label', e.target.value)}
                style={{ border:'1.5px solid #e9e0d5',borderRadius:7,padding:'6px 8px',
                  fontSize:'0.82rem',background:'#fff',flex:1,minWidth:120 }}>
                {CHARGE_LABELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <div style={{ display:'flex',alignItems:'center',border:'1.5px solid #e9e0d5',
                borderRadius:7,overflow:'hidden' }}>
                <span style={{ padding:'0 8px',fontWeight:700,color:'#A5732F',
                  background:'rgba(165,115,47,0.07)',borderRight:'1.5px solid #e9e0d5',
                  alignSelf:'stretch',display:'flex',alignItems:'center',fontSize:'0.85rem' }}>$</span>
                <input type="number" min="1" value={c.amount}
                  onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  style={{ border:'none',outline:'none',padding:'6px 10px',
                    fontSize:'0.9rem',fontWeight:700,width:90 }} />
              </div>
              <button onClick={() => removeCharge(i)}
                style={{ background:'rgba(220,53,69,0.1)',color:'#dc3545',border:'none',
                  borderRadius:7,padding:'6px 10px',cursor:'pointer',fontWeight:700 }}>✕</button>
            </div>
            <input value={c.description} onChange={(e) => updateCharge(i, 'description', e.target.value)}
              placeholder="Description (optional)"
              style={{ width:'100%',border:'1.5px solid #e9e0d5',borderRadius:7,
                padding:'6px 10px',fontSize:'0.8rem',outline:'none',boxSizing:'border-box' }} />
          </div>
        ))}

        <div style={{ display:'flex',gap:10,marginTop:16,justifyContent:'flex-end' }}>
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={submit} disabled={saving} style={S.btn('#1a1208', saving)}>
            {saving ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ChargesInvoicePanel ───────────────────────────────────────────────────────
// Shows charges + admin review status + respond to counters + invoice
const ChargesInvoicePanel = ({ requestId, onUpdate }) => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [responding, setResponding] = useState(null); // chargeId being acted on

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/technician/requests/${requestId}/status`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  const respond = async (chargeId, action) => {
    setResponding(chargeId);
    try {
      const { data: res } = await API.patch(
        `/technician/charges/${chargeId}/respond`,
        { action }
      );
      if (res.success) {
        alert(action === 'accept' ? 'Counter-offer accepted!' : 'Counter-offer rejected.');
        await load();
        onUpdate?.();
      } else {
        alert(res.message || 'Failed');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    } finally { setResponding(null); }
  };

  if (loading) return (
    <div style={{ padding:'1.5rem',textAlign:'center',color:'#adb5bd',fontSize:'0.85rem' }}>
      Loading charges…
    </div>
  );
  if (!data) return null;

  const { charges, summary, nextAction, invoice, request: reqData } = data;
  const allCharges = charges?.all || [];
  const hasInvoice = !!invoice;

  return (
    <div style={{ padding:'12px 0' }}>
      {/* next action banner */}
      {nextAction && (
        <div style={{ padding:'8px 12px',background:'rgba(165,115,47,0.08)',
          border:'1px solid rgba(165,115,47,0.2)',borderRadius:8,
          fontSize:'0.82rem',fontWeight:600,color:'#8c5f25',marginBottom:12 }}>
          💡 {nextAction}
        </div>
      )}

      {/* summary pills */}
      {allCharges.length > 0 && (
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
          {summary.pendingAdminReview > 0 &&
            <span style={S.badge('#b45309','rgba(234,179,8,0.15)')}>⏳ {summary.pendingAdminReview} pending review</span>}
          {summary.awaitingYourReply > 0 &&
            <span style={S.badge('#2563eb','rgba(37,99,235,0.1)')}>↔ {summary.awaitingYourReply} need your reply</span>}
          {summary.accepted > 0 &&
            <span style={S.badge('#16a34a','rgba(22,163,74,0.12)')}>✓ {summary.accepted} accepted</span>}
          {summary.rejected > 0 &&
            <span style={S.badge('#dc3545','rgba(220,53,69,0.1)')}>✗ {summary.rejected} rejected</span>}
        </div>
      )}

      {/* charge cards */}
      {allCharges.length === 0 ? (
        <div style={{ color:'#adb5bd',textAlign:'center',padding:'1.5rem',fontSize:'0.85rem' }}>
          No additional charges submitted.
        </div>
      ) : allCharges.map((c) => (
        <div key={c._id} style={{ background:'#fdf9f5',border:'1px solid #f0e8dc',
          borderRadius:10,padding:'10px 14px',marginBottom:10 }}>
          <div style={{ display:'flex',justifyContent:'space-between',
            alignItems:'flex-start',flexWrap:'wrap',gap:6 }}>
            <div>
              <div style={{ fontWeight:700,fontSize:'0.9rem',color:'#1a1208' }}>{c.label}</div>
              {c.description && <div style={{ fontSize:'0.75rem',color:'#6c757d',marginTop:2 }}>{c.description}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:800,color:'#A5732F',fontSize:'0.95rem' }}>
                ${Number(c.requestedAmount).toLocaleString()}
              </div>
              {c.agreedAmount != null && c.status === 'accepted' && (
                <div style={{ fontSize:'0.75rem',color:'#16a34a',fontWeight:600 }}>
                  Agreed: ${Number(c.agreedAmount).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop:8 }}>{chargeStatusBadge(c.status)}</div>

          {/* admin counter-offer details */}
          {c.status === 'countered' && c.adminCounterAmount > 0 && (
            <div style={{ marginTop:8,padding:'8px 12px',background:'rgba(37,99,235,0.06)',
              border:'1px solid rgba(37,99,235,0.18)',borderRadius:8 }}>
              <div style={{ fontSize:'0.82rem',fontWeight:700,color:'#2563eb' }}>
                Admin counter-offer: ${Number(c.adminCounterAmount).toLocaleString()}
              </div>
              {c.adminNote && (
                <div style={{ fontSize:'0.78rem',color:'#6c757d',marginTop:3,fontStyle:'italic' }}>
                  "{c.adminNote}"
                </div>
              )}
              {/* respond buttons */}
              <div style={{ display:'flex',gap:8,marginTop:10 }}>
                <button
                  disabled={responding === c._id}
                  onClick={() => respond(c._id, 'accept')}
                  style={S.btn('#16a34a', responding === c._id)}>
                  {responding === c._id ? '…' : `✓ Accept $${Number(c.adminCounterAmount).toLocaleString()}`}
                </button>
                <button
                  disabled={responding === c._id}
                  onClick={() => respond(c._id, 'reject')}
                  style={S.btn('#dc3545', responding === c._id)}>
                  {responding === c._id ? '…' : '✕ Reject'}
                </button>
              </div>
            </div>
          )}

          {/* admin note on accepted/rejected */}
          {['accepted','rejected'].includes(c.status) && c.adminNote && (
            <div style={{ marginTop:6,fontSize:'0.78rem',color:'#6c757d',
              borderLeft:'3px solid #dee2e6',paddingLeft:8,fontStyle:'italic' }}>
              Admin note: {c.adminNote}
            </div>
          )}
        </div>
      ))}

      {/* ── INVOICE ── */}
      {hasInvoice && (
        <div style={{ marginTop:16,border:'1.5px solid #f0e8dc',borderRadius:12,overflow:'hidden' }}>
          <div style={{ background:'#fdf9f5',padding:'10px 14px',display:'flex',
            justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #f0e8dc' }}>
            <div style={{ fontWeight:800,color:'#1a1208',fontSize:'0.95rem' }}>
              🧾 {invoice.invoiceNumber}
            </div>
            <span style={S.badge(
              invoice.status === 'paid' ? '#16a34a' : invoice.status === 'finalised' ? '#2563eb' : '#6c757d',
              invoice.status === 'paid' ? 'rgba(22,163,74,0.12)' : invoice.status === 'finalised' ? 'rgba(37,99,235,0.1)' : '#f3f4f6'
            )}>
              {invoice.status === 'paid' ? '💰 Paid' : invoice.status === 'finalised' ? '✓ Finalised' : 'Draft'}
            </span>
          </div>
          <div style={{ padding:'12px 14px' }}>
            {/* line items */}
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.83rem',marginBottom:10 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #f0e8dc' }}>
                  <th style={{ textAlign:'left',padding:'6px 0',color:'#6c757d',fontWeight:600,fontSize:'0.72rem',textTransform:'uppercase' }}>Item</th>
                  <th style={{ textAlign:'right',padding:'6px 0',color:'#6c757d',fontWeight:600,fontSize:'0.72rem',textTransform:'uppercase' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom:'1px solid #f8f3ed' }}>
                  <td style={{ padding:'7px 0',fontWeight:600 }}>{invoice.fixedJobLabel || 'Fixed Job Charge'}</td>
                  <td style={{ padding:'7px 0',textAlign:'right',fontWeight:700,color:'#A5732F' }}>
                    ${Number(invoice.fixedJobCharge).toLocaleString()}
                  </td>
                </tr>
                {(invoice.additionalCharges || []).map((c, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f8f3ed' }}>
                    <td style={{ padding:'7px 0' }}>
                      <div style={{ fontWeight:600 }}>{c.label}</div>
                      {c.description && <div style={{ fontSize:'0.72rem',color:'#6c757d' }}>{c.description}</div>}
                    </td>
                    <td style={{ padding:'7px 0',textAlign:'right',fontWeight:700,color:'#A5732F' }}>
                      ${Number(c.agreedAmount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* totals */}
            <div style={{ background:'#fdf9f5',borderRadius:8,padding:'10px 12px' }}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:'0.83rem',color:'#495057',marginBottom:4 }}>
                <span>Fixed Charge</span><span>${Number(invoice.fixedJobCharge).toLocaleString()}</span>
              </div>
              {invoice.subtotalAdditional > 0 && (
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:'0.83rem',color:'#495057',marginBottom:4 }}>
                  <span>Additional Charges</span><span>${Number(invoice.subtotalAdditional).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display:'flex',justifyContent:'space-between',fontWeight:800,
                fontSize:'1rem',color:'#1a1208',borderTop:'2px solid #f0e8dc',paddingTop:8,marginTop:4 }}>
                <span>Total</span>
                <span style={{ color:'#A5732F' }}>${Number(invoice.totalAmount).toLocaleString()}</span>
              </div>
            </div>
            {invoice.status === 'paid' && invoice.paidAt && (
              <div style={{ marginTop:8,fontSize:'0.78rem',color:'#16a34a',fontWeight:600 }}>
                ✓ Paid on {fmtDT(invoice.paidAt)} — Check your wallet
              </div>
            )}
            {invoice.status === 'finalised' && (
              <div style={{ marginTop:8,fontSize:'0.78rem',color:'#2563eb',fontWeight:600 }}>
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
  const [jobs, setJobs]         = useState([]);
  const [myJobs, setMyJobs]     = useState([]);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary]   = useState({
    totalJobsDone:0, totalEarnings:0, totalWithdrawn:0, availableBalance:0,
  });
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('open');

  // modals / panels
  const [requestModal, setRequestModal]   = useState(null);  // job object
  const [openChat, setOpenChat]           = useState(null);  // requestId
  const [openChargesPanel, setOpenChargesPanel] = useState(null); // requestId
  const [msgText, setMsgText]             = useState({});
  const [sendingMsg, setSendingMsg]       = useState(false);
  const [loadingChat, setLoadingChat]     = useState(null);
  const [reuploadingDoc, setReuploadingDoc] = useState(null);

  // profile image
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage]           = useState(false);
  const imageInputRef = useRef(null);
  const chatEndRef    = useRef(null);

  // socket
  const { socket } = useSocket();
  const openChatReqIdRef = useRef(null); // tracks which request room we're currently in

  const loadData = useCallback(async () => {
    try {
      const [dashRes, jobsRes, profileRes] = await Promise.all([
        API.get('/technician/dashboard'),
        API.get('/technician/jobs'),
        API.get('/technician-auth/me'),
      ]);

      if (dashRes.data.success) {
        const tech = dashRes.data.data.technician;
        setSummary({
          totalJobsDone:    tech.totalJobsDone    || 0,
          totalEarnings:    tech.totalEarnings    || 0,
          totalWithdrawn:   tech.totalWithdrawn   || 0,
          availableBalance: tech.availableBalance || 0,
        });
        const reqs = dashRes.data.data.requests || [];
        setRequests(reqs);
        setMyJobs(reqs.filter((r) => r.status === 'accepted' && r.job).map((r) => r.job));
      }

      if (jobsRes.data.success) setJobs(jobsRes.data.data.jobs || []);

      if (profileRes.data.success) {
        const u = profileRes.data.data.user;
        setProfile(u);
        const img = u.profileImage?.url || u.technicianProfile?.photoUrl || '';
        if (img) setProfileImagePreview(img);
      }
    } catch (err) {
      console.error('loadData error:', err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (openChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [openChat, requests]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // ── job:new — admin posted a new job, add it to the open jobs list ─────────
    const onJobNew = ({ job }) => {
      console.log('[Socket] ← job:new', { jobId: job._id, title: job.title });
      // Only show open jobs to technicians
      if (job.status === 'open') {
        setJobs((prev) => {
          // Avoid duplicates if the list already has it
          const exists = prev.some((j) => j._id === job._id);
          return exists ? prev : [job, ...prev];
        });
      }
    };

    // ── request:message — admin sent a message / counter-offer ──────────────
    const onRequestMessage = ({ requestId, message }) => {
      console.log('[Socket] ← request:message', { requestId, message });
      setRequests((prev) =>
        prev.map((r) =>
          r._id === requestId
            ? { ...r, conversation: [...(r.conversation || []), message] }
            : r
        )
      );
    };

    // ── request:status — admin accepted / rejected / counter-offered ─────────
    const onRequestStatus = ({ requestId, status, counterOffer, counterOfferFrom }) => {
      console.log('[Socket] ← request:status', { requestId, status });
      setRequests((prev) =>
        prev.map((r) =>
          r._id === requestId
            ? { ...r, status, counterOffer, counterOfferFrom }
            : r
        )
      );
      // If accepted, sync myJobs too
      if (status === 'accepted') loadData();
    };

    // ── request:updated — full request object refreshed ──────────────────────
    const onRequestUpdated = ({ request }) => {
      console.log('[Socket] ← request:updated', { requestId: request._id, status: request.status });
      setRequests((prev) =>
        prev.map((r) => r._id === request._id ? { ...r, ...request } : r)
      );
      if (request.status === 'accepted') loadData();
    };

    // ── charges:submitted — (echo back to technician room) ───────────────────
    const onChargesSubmitted = ({ requestId }) => {
      console.log('[Socket] ← charges:submitted', { requestId });
      // No UI action needed — tech submitted these themselves
    };

    // ── charge:reviewed — admin accepted / rejected / countered a charge ─────
    const onChargeReviewed = ({ requestId, requestChargesStatus }) => {
      console.log('[Socket] ← charge:reviewed', { requestId, requestChargesStatus });
      setRequests((prev) =>
        prev.map((r) =>
          r._id === requestId
            ? { ...r, chargesStatus: requestChargesStatus || r.chargesStatus }
            : r
        )
      );
    };

    // ── charge:responded — tech accepted/rejected counter (echo) ─────────────
    const onChargeResponded = ({ requestId }) => {
      console.log('[Socket] ← charge:responded', { requestId });
      // ChargesInvoicePanel will re-fetch on its own via onUpdate; nothing extra needed
    };

    // ── invoice:generated — admin created the invoice ─────────────────────────
    const onInvoiceGenerated = ({ requestId }) => {
      console.log('[Socket] ← invoice:generated', { requestId });
      setRequests((prev) =>
        prev.map((r) =>
          r._id === requestId ? { ...r, chargesStatus: 'invoiced' } : r
        )
      );
    };

    // ── invoice:paid — admin marked invoice as paid ───────────────────────────
    const onInvoicePaid = ({ requestId, amount }) => {
      console.log('[Socket] ← invoice:paid', { requestId, amount });
      // Refresh summary so wallet balance updates
      loadData();
    };

    // ── technician:verificationUpdated — admin approved / rejected docs ───────
    const onVerificationUpdated = ({ technicianId, status, notes }) => {
      console.log('[Socket] ← technician:verificationUpdated', { technicianId, status, notes });
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          technicianProfile: {
            ...(prev.technicianProfile || {}),
            verificationStatus: status,
          },
        };
      });
    };

    socket.on('job:new',                  onJobNew);
    socket.on('request:message',              onRequestMessage);
    socket.on('request:status',               onRequestStatus);
    socket.on('request:updated',              onRequestUpdated);
    socket.on('charges:submitted',            onChargesSubmitted);
    socket.on('charge:reviewed',              onChargeReviewed);
    socket.on('charge:responded',             onChargeResponded);
    socket.on('invoice:generated',            onInvoiceGenerated);
    socket.on('invoice:paid',                 onInvoicePaid);
    socket.on('technician:verificationUpdated', onVerificationUpdated);

    return () => {
      socket.off('job:new',                  onJobNew);
      socket.off('request:message',              onRequestMessage);
      socket.off('request:status',               onRequestStatus);
      socket.off('request:updated',              onRequestUpdated);
      socket.off('charges:submitted',            onChargesSubmitted);
      socket.off('charge:reviewed',              onChargeReviewed);
      socket.off('charge:responded',             onChargeResponded);
      socket.off('invoice:generated',            onInvoiceGenerated);
      socket.off('invoice:paid',                 onInvoicePaid);
      socket.off('technician:verificationUpdated', onVerificationUpdated);
    };
  }, [socket, loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Join technician's own room on connect (for verificationUpdated) ─────────
  useEffect(() => {
    if (!socket || !profile?._id) return;
    console.log('[Socket] → technician:join', profile._id);
    socket.emit('technician:join', profile._id);
    return () => {
      console.log('[Socket] → technician:leave', profile._id);
      socket.emit('technician:leave', profile._id);
    };
  }, [socket, profile?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── profile image ────────────────────────────────────────────────────────────
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    const file = imageInputRef.current?.files[0];
    if (!file) return alert('Select an image first');
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('profileImage', file);
      const { data } = await API.post('/technician-auth/upload-profile-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        alert('Profile image updated!');
        setProfileImagePreview(data.data.profileImageUrl);
      } else alert(data.message || 'Upload failed');
    } catch { alert('Upload failed'); }
    finally { setUploadingImage(false); }
  };

  // ── job actions ──────────────────────────────────────────────────────────────
  const markReached = async (jobId) => {
    try {
      const { data } = await API.patch(`/technician/jobs/${jobId}/reached`);
      alert(data.message || (data.success ? 'Reached recorded!' : 'Failed'));
      if (data.success) loadData();
    } catch (err) { alert(err.response?.data?.message || 'Failed to mark reached'); }
  };

  const markCompleted = async (jobId) => {
    if (!window.confirm('Mark this job as completed? Admin will be notified.')) return;
    try {
      const { data } = await API.patch(`/technician/jobs/${jobId}/complete`);
      alert(data.message || (data.success ? 'Job completion recorded!' : 'Failed'));
      if (data.success) loadData();
    } catch (err) { alert(err.response?.data?.message || 'Failed to mark completed'); }
  };

  const withdraw = async () => {
    const amount = Number(prompt('Enter amount to withdraw:', summary.availableBalance || 0));
    if (!amount || amount <= 0) return;
    try {
      const { data } = await API.post('/technician/withdraw', {
        amount, method: 'bank-transfer', details: 'Bank transfer withdrawal',
      });
      alert(data.message || 'Withdrawal requested');
      if (data.success) loadData();
    } catch (err) { alert(err.response?.data?.message || 'Withdrawal failed'); }
  };

  // ── chat ─────────────────────────────────────────────────────────────────────
  const openChatFor = async (requestId) => {
    // Leave previous room if switching chats
    if (openChatReqIdRef.current && openChatReqIdRef.current !== requestId) {
      console.log('[Socket] → request:leave', openChatReqIdRef.current);
      socket?.emit('request:leave', openChatReqIdRef.current);
      openChatReqIdRef.current = null;
    }

    if (openChat === requestId) {
      // Closing chat — leave room
      console.log('[Socket] → request:leave', requestId);
      socket?.emit('request:leave', requestId);
      openChatReqIdRef.current = null;
      setOpenChat(null);
      return;
    }

    setOpenChargesPanel(null);
    setOpenChat(requestId);
    setLoadingChat(requestId);
    try {
      const { data } = await API.get(`/technician/requests/${requestId}/messages`);
      if (data.success) {
        setRequests((prev) => prev.map((r) =>
          r._id === requestId ? { ...r, conversation: data.data.conversation } : r
        ));
      }
    } catch { /* use existing */ }
    finally {
      setLoadingChat(null);
      // Join the request room to receive live messages
      console.log('[Socket] → request:join', requestId);
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
        const entry = data.data?.entry || { sender:'technician', message, createdAt: new Date().toISOString() };
        setRequests((prev) => prev.map((r) =>
          r._id === requestId ? { ...r, conversation: [...(r.conversation||[]), entry] } : r
        ));
      } else alert(data.message || 'Failed to send');
    } catch { alert('Failed to send message'); }
    finally { setSendingMsg(false); }
  };

  const toggleChargesPanel = (requestId) => {
    setOpenChat(null);
    setOpenChargesPanel((p) => p === requestId ? null : requestId);
  };

  // ── document re-upload ───────────────────────────────────────────────────────
  const reuploadDocument = async (documentId, file) => {
    if (!file) return;
    setReuploadingDoc(documentId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await API.put(`/technician-auth/documents/${documentId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(data.message || (data.success ? 'Document re-uploaded!' : 'Upload failed'));
      if (data.success) loadData();
    } catch { alert('Re-upload failed'); }
    finally { setReuploadingDoc(null); }
  };

  if (loading) return (
    <div style={{ padding:32, textAlign:'center', color:'#6c757d' }}>Loading dashboard…</div>
  );

  const tabStyle = (key) => ({
    padding:'8px 18px', border:'none', borderRadius:'8px 8px 0 0',
    fontWeight:700, fontSize:'0.85rem', cursor:'pointer',
    background: activeTab === key ? '#1a1208' : 'transparent',
    color: activeTab === key ? '#fff' : '#6c757d',
    borderBottom: activeTab === key ? '3px solid #A5732F' : '3px solid transparent',
  });

  return (
    <div style={{ padding:24, maxWidth:960, margin:'0 auto', fontFamily:'Inter, system-ui, sans-serif' }}>
      <h2 style={{ fontWeight:800, color:'#1a1208', marginBottom:4 }}>Technician Dashboard</h2>

      {/* request-job modal */}
      {requestModal && (
        <RequestJobModal
          job={requestModal}
          onClose={() => setRequestModal(null)}
          onSuccess={(msg) => { alert(msg); loadData(); }}
        />
      )}

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <div style={{ ...S.card, display:'flex', alignItems:'center', gap:20, marginBottom:20 }}>
        <div style={{ flexShrink:0 }}>
          {profileImagePreview ? (
            <img src={profileImagePreview} alt="Profile"
              style={{ width:80,height:80,borderRadius:'50%',objectFit:'cover',border:'3px solid #A5732F' }} />
          ) : (
            <div style={{ width:80,height:80,borderRadius:'50%',
              background:'linear-gradient(135deg,#A5732F,#d4a050)',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontSize:'1.8rem',fontWeight:800,border:'3px solid #A5732F' }}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
          )}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800,fontSize:'1.05rem',color:'#1a1208' }}>{profile?.name || 'Technician'}</div>
          <div style={{ color:'#6c757d',fontSize:'0.85rem',marginBottom:8 }}>{profile?.email || ''}</div>
          <div style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
            <label style={{ ...S.btn('#A5732F'),display:'inline-block',cursor:'pointer' }}>
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

      {/* ── Earnings row ─────────────────────────────────────────────────── */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        {[
          { label:'Total Jobs',   value: summary.totalJobsDone,        color:'#1a1208' },
          { label:'Total Earned', value:`$${summary.totalEarnings}`,   color:'#A5732F' },
          { label:'Withdrawn',    value:`$${summary.totalWithdrawn}`,  color:'#dc3545' },
          { label:'Available',    value:`$${summary.availableBalance}`,color:'#16a34a' },
        ].map((s) => (
          <div key={s.label} style={{ ...S.card, textAlign:'center', marginBottom:0 }}>
            <div style={{ fontWeight:800,fontSize:'1.4rem',color:s.color }}>{s.value}</div>
            <div style={{ fontSize:'0.72rem',color:'#6c757d',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <button style={{ ...S.btn('#1a1208'),marginBottom:20 }} onClick={withdraw}>💸 Withdraw</button>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex',gap:4,borderBottom:'2px solid #f0e8dc',marginBottom:20,flexWrap:'wrap' }}>
        {[
          { key:'open',      label:`Open Jobs (${jobs.length})` },
          { key:'my',        label:`My Jobs (${myJobs.length})` },
          { key:'requests',  label:`My Requests (${requests.length})` },
          { key:'documents', label:'My Documents' },
        ].map((t) => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* OPEN JOBS TAB                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'open' && (
        <div>
          <h4 style={{ fontWeight:700,marginBottom:12 }}>Available Jobs</h4>
          {jobs.length === 0 ? (
            <div style={{ color:'#adb5bd',padding:'2rem',textAlign:'center' }}>No open jobs right now.</div>
          ) : jobs.map((job) => {
            const myReq = requests.find(
              (r) => (r.job?._id || r.job) === job._id &&
                ['pending','accepted','counter-offer'].includes(r.status)
            );
            return (
              <div key={job._id} style={S.card}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700,fontSize:'1rem',color:'#1a1208' }}>{job.title}</div>
                    <div style={{ fontSize:'0.8rem',color:'#6c757d' }}>{job.category} · {job.location}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:800,color:'#A5732F',fontSize:'1.05rem' }}>${job.budget}</div>
                    {job.estimatedTime && (
                      <div style={{ fontSize:'0.75rem',color:'#6c757d' }}>⏱ {job.estimatedTime}</div>
                    )}
                  </div>
                </div>
                <p style={{ color:'#495057',fontSize:'0.875rem',margin:'8px 0 10px' }}>{job.description}</p>
                {myReq ? (
                  <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                    {reqStatusBadge(myReq.status)}
                    <span style={{ fontSize:'0.78rem',color:'#6c757d' }}>
                      {myReq.status==='accepted' ? '— Job assigned to you'
                        : myReq.status==='counter-offer' ? '— Awaiting admin review'
                        : '— Waiting for admin response'}
                    </span>
                  </div>
                ) : (
                  <button style={S.btn('#1a1208')} onClick={() => setRequestModal(job)}>
                    Request Job
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MY ASSIGNED JOBS TAB                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'my' && (
        <div>
          <h4 style={{ fontWeight:700,marginBottom:12 }}>My Assigned Jobs</h4>
          {myJobs.length === 0 ? (
            <div style={{ color:'#adb5bd',padding:'2rem',textAlign:'center' }}>No jobs assigned yet.</div>
          ) : myJobs.map((job) => {
            const alreadyReached   = !!job.reachedAt;
            const alreadyCompleted = !!job.jobCompletedAt;
            return (
              <div key={job._id} style={S.card}>
                <div style={{ display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700,fontSize:'1rem',color:'#1a1208' }}>{job.title}</div>
                    <div style={{ fontSize:'0.8rem',color:'#6c757d' }}>{job.category} · {job.location}</div>
                  </div>
                  <span style={S.badge(
                    job.status==='in-progress'?'#2563eb':job.status==='completed'?'#16a34a':'#A5732F',
                    job.status==='in-progress'?'rgba(37,99,235,0.12)':job.status==='completed'?'rgba(22,163,74,0.12)':'rgba(165,115,47,0.12)'
                  )}>{job.status}</span>
                </div>
                {job.estimatedTime && (
                  <div style={{ fontSize:'0.8rem',color:'#A5732F',fontWeight:600,margin:'6px 0' }}>
                    ⏱ {job.estimatedTime}
                  </div>
                )}
                {(alreadyReached || alreadyCompleted) && (
                  <div style={{ background:'#fdf9f5',borderRadius:8,padding:'8px 12px',margin:'8px 0',
                    border:'1px solid #f0e8dc',fontSize:'0.8rem',display:'flex',flexDirection:'column',gap:4 }}>
                    {alreadyReached && <div><b style={{ color:'#2563eb' }}>📍 Reached:</b> {fmtDT(job.reachedAt)}</div>}
                    {alreadyCompleted && <div><b style={{ color:'#16a34a' }}>✅ Completed:</b> {fmtDT(job.jobCompletedAt)}</div>}
                    {job.jobDurationMinutes != null && (
                      <div><b style={{ color:'#A5732F' }}>⏱ Duration:</b> {formatDuration(job.jobDurationMinutes)}</div>
                    )}
                  </div>
                )}
                <div style={{ display:'flex',gap:10,marginTop:10,flexWrap:'wrap' }}>
                  {!alreadyReached && job.status!=='completed' && (
                    <button style={S.btn('#2563eb')} onClick={() => markReached(job._id)}>
                      📍 I Reached the Location
                    </button>
                  )}
                  {alreadyReached && !alreadyCompleted && job.status!=='completed' && (
                    <button style={S.btn('#16a34a')} onClick={() => markCompleted(job._id)}>
                      ✅ Mark Job Completed
                    </button>
                  )}
                  {alreadyCompleted && (
                    <span style={{ fontSize:'0.82rem',color:'#16a34a',fontWeight:700,padding:'8px 0' }}>
                      ✓ Waiting for admin to process payment
                    </span>
                  )}
                  {job.finalPrice > 0 && (
                    <span style={{ fontSize:'0.82rem',fontWeight:700,color:'#A5732F',padding:'8px 0' }}>
                      💰 Final price: ${job.finalPrice}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MY REQUESTS TAB                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <div>
          <h4 style={{ fontWeight:700,marginBottom:12 }}>My Job Requests</h4>
          {requests.length === 0 ? (
            <div style={{ color:'#adb5bd',padding:'2rem',textAlign:'center' }}>No requests yet.</div>
          ) : requests.map((req) => {
            const isChat    = openChat === req._id;
            const isCharges = openChargesPanel === req._id;
            const convo     = req.conversation || [];
            const hasCharges = req.chargesStatus && req.chargesStatus !== 'none';
            const needsReply = req.chargesStatus === 'pending' || req.chargesStatus === 'reviewing';

            return (
              <div key={req._id} style={S.card}>
                {/* header */}
                <div style={{ display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:8 }}>
                  <div>
                    <div style={{ fontWeight:700,color:'#1a1208' }}>{req.job?.title || 'Job'}</div>
                    <div style={{ fontSize:'0.8rem',color:'#6c757d' }}>{req.job?.location || ''}</div>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                    {reqStatusBadge(req.status)}
                    {hasCharges && (
                      <span style={S.badge(
                        req.chargesStatus==='invoiced'?'#A5732F':req.chargesStatus==='agreed'?'#16a34a':
                        needsReply?'#b45309':'#2563eb',
                        req.chargesStatus==='invoiced'?'rgba(165,115,47,0.15)':req.chargesStatus==='agreed'?'rgba(22,163,74,0.12)':
                        needsReply?'rgba(234,179,8,0.15)':'rgba(37,99,235,0.1)'
                      )}>
                        {req.chargesStatus==='invoiced'?'🧾 Invoiced':req.chargesStatus==='agreed'?'✓ Agreed':
                         needsReply?'⏳ Charges Pending':'↔ Reviewing'}
                      </span>
                    )}
                  </div>
                </div>

                {req.note && (
                  <p style={{ color:'#6c757d',fontSize:'0.82rem',margin:'0 0 6px',fontStyle:'italic' }}>"{req.note}"</p>
                )}
                {req.amountEarned > 0 && (
                  <div style={{ fontWeight:700,color:'#16a34a',fontSize:'0.9rem',marginBottom:6 }}>
                    💰 Earned: ${req.amountEarned}
                  </div>
                )}

                {/* action buttons */}
                <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                  <button
                    onClick={() => openChatFor(req._id)}
                    style={{ background:isChat?'#f0e8dc':'#1a1208',color:isChat?'#1a1208':'#fff',
                      border:'none',borderRadius:8,padding:'6px 14px',fontSize:'0.78rem',
                      fontWeight:700,cursor:'pointer' }}>
                    💬 {isChat ? 'Close Chat' : `Chat${convo.length?` (${convo.length})`:''}`}
                  </button>
                  {(hasCharges || req.status === 'accepted') && (
                    <button
                      onClick={() => toggleChargesPanel(req._id)}
                      style={{ background:isCharges?'rgba(165,115,47,0.15)':'rgba(165,115,47,0.1)',
                        color:'#A5732F',border:'1.5px solid rgba(165,115,47,0.3)',
                        borderRadius:8,padding:'6px 14px',fontSize:'0.78rem',fontWeight:700,cursor:'pointer' }}>
                      🧾 {isCharges ? 'Close' : 'Charges & Invoice'}
                      {needsReply && <span style={{ marginLeft:4,color:'#b45309' }}>●</span>}
                    </button>
                  )}
                </div>

                {/* ── chat window ── */}
                {isChat && (
                  <div style={{ marginTop:12,border:'1px solid #e9e0d5',borderRadius:10,overflow:'hidden' }}>
                    <div style={{ height:260,overflowY:'auto',padding:12,background:'#fdf9f5',
                      display:'flex',flexDirection:'column',gap:8 }}>
                      {loadingChat === req._id ? (
                        <div style={{ color:'#adb5bd',textAlign:'center',marginTop:80,fontSize:'0.85rem' }}>Loading…</div>
                      ) : convo.length === 0 ? (
                        <div style={{ color:'#adb5bd',textAlign:'center',marginTop:80,fontSize:'0.85rem' }}>
                          No messages yet.
                        </div>
                      ) : convo.map((msg, i) => {
                        const isMe = msg.sender === 'technician';
                        return (
                          <div key={i} style={{ display:'flex',justifyContent:isMe?'flex-end':'flex-start' }}>
                            <div style={{ maxWidth:'72%',padding:'8px 12px',
                              borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px',
                              background:isMe?'#1a1208':'#fff',color:isMe?'#fff':'#1a1208',
                              border:isMe?'none':'1px solid #e9e0d5',fontSize:'0.83rem',lineHeight:1.45 }}>
                              <div style={{ fontWeight:600,fontSize:'0.7rem',marginBottom:3,
                                color:isMe?'#d4a050':'#A5732F' }}>
                                {isMe ? 'You' : 'Admin'}
                              </div>
                              {msg.counterOffer > 0 && (
                                <div style={{ fontWeight:700,marginBottom:2 }}>
                                  Counter offer: ${msg.counterOffer}
                                </div>
                              )}
                              {msg.message}
                              <div style={{ fontSize:'0.65rem',marginTop:4,
                                color:isMe?'rgba(255,255,255,0.55)':'#adb5bd',textAlign:'right' }}>
                                {msg.createdAt
                                  ? new Date(msg.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
                                  : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div style={{ display:'flex',gap:8,padding:'10px 12px',background:'#fff',
                      borderTop:'1px solid #e9e0d5' }}>
                      <input type="text" placeholder="Type a message…"
                        value={msgText[req._id] || ''}
                        onChange={(e) => setMsgText((p) => ({ ...p, [req._id]: e.target.value }))}
                        onKeyDown={(e) => e.key==='Enter' && !sendingMsg && sendMessage(req._id)}
                        style={{ flex:1,border:'1.5px solid #e9e0d5',borderRadius:8,
                          padding:'8px 12px',fontSize:'0.85rem',outline:'none' }} />
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
                  <div style={{ marginTop:12,border:'1px solid #f0e8dc',borderRadius:10,
                    background:'#fffcf8',padding:'4px 8px' }}>
                    <ChargesInvoicePanel
                      requestId={req._id}
                      onUpdate={loadData}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MY DOCUMENTS TAB                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'documents' && (() => {
        const docs = profile?.technicianProfile?.documents || [];
        const statusColor = { approved:'#16a34a', rejected:'#dc3545', pending:'#b45309' };
        const statusBg    = { approved:'rgba(22,163,74,0.1)', rejected:'rgba(220,53,69,0.1)', pending:'rgba(180,83,9,0.1)' };
        const statusIcon  = { approved:'✓', rejected:'✗', pending:'⏳' };
        return (
          <div>
            <h4 style={{ fontWeight:700,marginBottom:12 }}>My Documents</h4>
            {docs.length === 0 ? (
              <div style={{ color:'#adb5bd',padding:'2rem',textAlign:'center' }}>No documents uploaded yet.</div>
            ) : docs.map((doc) => (
              <div key={doc.documentId}
                style={{ ...S.card,display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,color:'#1a1208',marginBottom:4 }}>
                    {doc.label || doc.documentId}
                  </div>
                  <span style={S.badge(
                    statusColor[doc.status] || '#6c757d',
                    statusBg[doc.status] || 'rgba(108,117,125,0.1)'
                  )}>
                    {statusIcon[doc.status]} {doc.status}
                  </span>
                  {doc.status === 'rejected' && doc.rejectionReason && (
                    <div style={{ marginTop:6,padding:'6px 10px',background:'#fff5f5',
                      border:'1px solid #fecaca',borderRadius:8,fontSize:'0.82rem',color:'#dc3545' }}>
                      <strong>Reason:</strong> {doc.rejectionReason}
                    </div>
                  )}
                </div>
                {doc.status === 'rejected' && (
                  <label style={{ ...S.btn('#A5732F'),display:'inline-block',cursor:'pointer',
                    opacity:reuploadingDoc===doc.documentId?0.6:1 }}>
                    {reuploadingDoc===doc.documentId ? 'Uploading…' : '↑ Re-upload'}
                    <input type="file" hidden disabled={reuploadingDoc===doc.documentId}
                      onChange={(e) => reuploadDocument(doc.documentId, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
        );
      })()}

    </div>
  );
};

export default TechnicianDashboard;
