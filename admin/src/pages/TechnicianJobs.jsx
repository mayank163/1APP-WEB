import TechnicianRatingForm, { emptyFeedback, RATING_LABELS, RATING_CRITERIA } from '../components/TechnicianRatingForm';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import JobInvitationModal from '../components/JobInvitationModal';
import Pagination from '../components/Pagination';
import JobForm from '../components/TechnicianJobForm';
import { emptyForm, buildJobPayload } from '../utils/jobTemplates';
import TechnicianTrackingMap from '../components/TechnicianTrackingMap';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getImageUrl } from '../utils/helpers';
import { templateToJobForm } from '../utils/jobTemplates';
import socket from '../services/socket';
import { JOB_STATUS_OPTIONS, getJobStatusLabel, getJobStatusTone } from '../utils/jobStatus';
import '../styles/TechnicianJobs.css';
import {
  FaPlus, FaEdit, FaTrash, FaEye, FaSearch, FaTimes,
  FaHardHat, FaMapMarkerAlt, FaRupeeSign, FaCalendarAlt,
  FaTools, FaUserCheck, FaInbox, FaBell, FaPaperPlane,
  FaClock, FaCheckCircle, FaWallet, FaRedoAlt,
  FaFileInvoiceDollar, FaReceipt,
  FaCheck, FaBan, FaExchangeAlt, FaWrench,
  FaFilter, FaChevronDown, FaUserAlt, FaBriefcase,
  FaExclamationCircle, FaCheckSquare,
} from 'react-icons/fa';

// ─── Constants ─────────────────────────────────────────────────────────────────
// ─── Helpers ───────────────────────────────────────────────────────────────────
const TimelineDistanceMiles = ({ miles, legacyMeters }) => {
  const distanceMiles = miles ?? (legacyMeters == null ? null : legacyMeters / 1609.344);
  const recorded = typeof distanceMiles === 'number' && Number.isFinite(distanceMiles) && distanceMiles >= 0;
  return <span className="tj-timeline-distance">Distance from job site: {recorded ? `${distanceMiles.toFixed(2)} miles` : 'Not recorded'}</span>;
};

const formatDistanceMiles = (miles, legacyMeters) => {
  const distanceMiles = miles ?? (legacyMeters == null ? null : legacyMeters / 1609.344);
  return typeof distanceMiles === 'number' && Number.isFinite(distanceMiles) && distanceMiles >= 0
    ? `${distanceMiles.toFixed(2)} miles`
    : 'Not recorded';
};

const formatDuration = (minutes) => {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const formatPay = (pay) => {
  if (!pay?.type) return '—';
  const n = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  switch (pay.type) {
    case 'fixed':     return `$${n(pay.fixedAmount)} Fixed`;
    case 'hourly':    return `$${n(pay.hourlyRate)}/hr${pay.maxHours ? ` · max ${pay.maxHours}h` : ''}`;
    case 'perDevice': return `$${n(pay.perDeviceRate)}/device${pay.maxDevices ? ` · max ${pay.maxDevices}` : ''}`;
    case 'blended':   return `$${n(pay.blendedFixedAmount)} + $${n(pay.blendedHourlyRate)}/hr`;
    default:          return '—';
  }
};

const fmtDT = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtTime = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// ─── Status config matching the design ─────────────────────────────────────────
const STATUS_CONFIG = {
  draft:       { label: 'Draft',       cls: 'status-pending'    },
  open:        { label: 'Pending',     cls: 'status-pending'    },
  assigned:    { label: 'Assigned',    cls: 'status-assigned'   },
  ontheway:    { label: 'On the Way',  cls: 'status-ontheway'   },
  visited:     { label: 'Arrived',     cls: 'status-arrived'    },
  inprogress:  { label: 'In Progress', cls: 'status-inprogress' },
  completed:   { label: 'Completed',   cls: 'status-completed'  },
  checkout:    { label: 'Checkout',    cls: 'status-assigned'   },
  cancelled:   { label: 'Cancelled',   cls: 'status-cancelled'  },
};

const canRescheduleJob = job => ['draft', 'open'].includes(job?.status);
const getStatusCls  = (s) => STATUS_CONFIG[s]?.cls   || 'status-pending';
const getStatusLbl  = (s) => STATUS_CONFIG[s]?.label || (s || 'Pending');

// ─── ChargesBadge ──────────────────────────────────────────────────────────────
const ChargesBadge = ({ status }) => {
  if (!status || status === 'none') return null;
  const labels = { pending: 'Charges Pending', reviewing: 'Under Review', agreed: 'Charges Agreed', invoiced: 'Invoiced' };
  return (
    <span className={`tj-charges-badge ${status}`}>
      <FaFileInvoiceDollar />{labels[status] || status}
    </span>
  );
};

// ─── NegotiationHistory ────────────────────────────────────────────────────────
const NegotiationHistory = ({ history }) => {
  const [open, setOpen] = useState(false);
  if (!history?.length) return null;
  return (
    <div className="admin-technician-jobs-1" >
      <button onClick={() => setOpen(p => !p)} className="admin-technician-jobs-2" >
        {open ? '▲' : '▼'} {open ? 'Hide' : 'View'} negotiation history ({history.length} rounds)
      </button>
      {open && (
        <div className="admin-technician-jobs-3" >
          {history.map((h, i) => {
            const isAdmin = h.actor === 'admin';

            const actionLabel = h.action === 'submit' ? '📤 Submitted' : h.action === 'accept' ? '✓ Accepted' : h.action === 'reject' ? '✕ Rejected' : '↔ Countered';
            return (
              <div key={i} className={["admin-technician-jobs-4 ", isAdmin ? "admin-technician-jobs-state-1" : "admin-technician-jobs-state-2", " ", isAdmin ? "admin-technician-jobs-state-3" : "admin-technician-jobs-state-4"].join('')} >
                <div className="admin-technician-jobs-5" >
                  <span className={["admin-technician-jobs-6 ", isAdmin ? "admin-technician-jobs-state-5" : "admin-technician-jobs-state-6"].join('')} >{isAdmin ? '👤 Admin' : '🔧 Technician'}</span>
                  <span className="admin-technician-jobs-7" >{h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div className="admin-technician-jobs-8" >
                  <span className={["admin-technician-jobs-9 ", h.action === 'accept' ? "admin-technician-jobs-state-7" : (h.action === 'reject' ? "admin-technician-jobs-state-8" : (h.action === 'submit' ? "admin-technician-jobs-state-9" : "admin-technician-jobs-state-10"))].join('')} >{actionLabel}</span>
                  {h.amount != null && <span className="admin-technician-jobs-10" >${Number(h.amount).toLocaleString()}</span>}
                </div>
                {h.note && <div className="admin-technician-jobs-11" >"{h.note}"</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── ChargesPanel ──────────────────────────────────────────────────────────────
const ChargesPanel = ({ requestId, onChargesUpdated }) => {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [counterOpen, setCounterOpen] = useState({});
  const [counterAmounts, setCounterAmounts] = useState({});
  const [counterNotes, setCounterNotes] = useState({});

  const load = async () => {
    setLoading(true);
    try { const res = await adminApi.getJobCharges(requestId); setCharges(res.data?.charges || []); }
    catch { toast.error('Failed to load charges'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [requestId]); // eslint-disable-line

  const review = async (chargeId, action, extra = {}) => {
    setActingId(chargeId);
    try {
      await adminApi.reviewCharge(chargeId, { action, ...extra });
      toast.success(action === 'accept' ? 'Charge accepted' : action === 'reject' ? 'Charge rejected' : 'Counter-offer sent');
      setCounterOpen(p => ({ ...p, [chargeId]: false }));
      setCounterAmounts(p => ({ ...p, [chargeId]: '' }));
      setCounterNotes(p => ({ ...p, [chargeId]: '' }));
      await load(); onChargesUpdated?.();
    } catch (err) { toast.error(err.response?.data?.message || 'Action failed'); }
    finally { setActingId(null); }
  };

  if (loading) return <div className="tj-loading admin-technician-jobs-12" ><div className="spinner-border spinner-border-sm admin-technician-jobs-13"  /><span>Loading charges…</span></div>;
  if (!charges.length) return <div className="tj-charges-empty"><FaReceipt size={28} className="admin-technician-jobs-14"  /><span>No additional charges submitted yet</span></div>;

  return (
    <div className="tj-charges-list">
      {charges.map((c) => {
        const isPending = c.status === 'pending';
        const isResolved = ['accepted', 'rejected'].includes(c.status);
        const showCounter = counterOpen[c._id];
        const busy = actingId === c._id;
        const myTurn = c.status === 'countered' && c.pendingWith === 'admin';
        const techTurn = c.status === 'countered' && c.pendingWith === 'technician';
        return (
          <div key={c._id} className="tj-charge-card">
            <div className="tj-charge-header">
              <span className="tj-charge-label">{c.label}</span>
              <span className="tj-charge-amount">Asked: ${Number(c.requestedAmount).toLocaleString()}</span>
            </div>
            {c.description && <div className="tj-charge-desc">{c.description}</div>}
            <div className="tj-charge-status-row">
              <span className={`tj-charge-status ${c.status}`}>
                {isPending && '⏳ Pending Review'}{isResolved && c.status === 'accepted' && '✓ Accepted'}{isResolved && c.status === 'rejected' && '✕ Rejected'}{myTurn && '↔ Tech Re-countered — Your Turn'}{techTurn && '⏳ Waiting for Technician'}
              </span>
              {c.status === 'accepted' && c.agreedAmount != null && <span className="admin-technician-jobs-15" >✓ Final: ${Number(c.agreedAmount).toLocaleString()}</span>}
            </div>
            {myTurn && <div className="tj-charge-counter-info admin-technician-jobs-16" >Technician counter-offer: <strong>${Number(c.technicianCounterAmount).toLocaleString()}</strong>{c.technicianResponseNote && <span className="admin-technician-jobs-17" > — "{c.technicianResponseNote}"</span>}</div>}
            {techTurn && !showCounter && <div className="tj-charge-counter-info admin-technician-jobs-18" >Your counter-offer: <strong>${Number(c.adminCounterAmount).toLocaleString()}</strong>{c.adminNote && <span className="admin-technician-jobs-19" > — "{c.adminNote}"</span>}<div className="admin-technician-jobs-20" >⏳ Waiting for technician…</div></div>}
            <NegotiationHistory history={c.counterHistory} />
            {isPending && !showCounter && <div className="tj-charge-actions"><button className="tj-charge-btn accept" disabled={busy} onClick={() => review(c._id, 'accept')}>{busy ? <span className="spinner-border spinner-border-sm" /> : <FaCheck />}Accept ${Number(c.requestedAmount).toLocaleString()}</button><button className="tj-charge-btn counter" disabled={busy} onClick={() => setCounterOpen(p => ({ ...p, [c._id]: true }))}><FaExchangeAlt /> Counter</button><button className="tj-charge-btn reject" disabled={busy} onClick={() => review(c._id, 'reject')}><FaBan /> Reject</button></div>}
            {myTurn && !showCounter && <div className="tj-charge-actions"><button className="tj-charge-btn accept" disabled={busy} onClick={() => review(c._id, 'accept')}>{busy ? <span className="spinner-border spinner-border-sm" /> : <FaCheck />}Accept ${Number(c.technicianCounterAmount).toLocaleString()}</button><button className="tj-charge-btn counter" disabled={busy} onClick={() => { setCounterAmounts(p => ({ ...p, [c._id]: String(c.technicianCounterAmount || '') })); setCounterOpen(p => ({ ...p, [c._id]: true })); }}><FaExchangeAlt /> Re-counter</button><button className="tj-charge-btn reject" disabled={busy} onClick={() => review(c._id, 'reject')}><FaBan /> Reject</button></div>}
            {showCounter && (
              <div className="tj-counter-inline">
                <div className="admin-technician-jobs-21" >{myTurn ? 'Re-counter offer' : 'Counter-offer'} for "{c.label}"<span className="admin-technician-jobs-22" >(tech asked ${Number(myTurn ? c.technicianCounterAmount : c.requestedAmount).toLocaleString()})</span></div>
                <div className="tj-counter-inline-row">
                  <input type="number" min="1" className="tj-counter-inline-input" placeholder="Your counter amount $" value={counterAmounts[c._id] || ''} onChange={(e) => setCounterAmounts(p => ({ ...p, [c._id]: e.target.value }))} />
                  <button className="tj-counter-inline-send" disabled={busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0} onClick={() => review(c._id, 'counter', { counterAmount: Number(counterAmounts[c._id]), adminNote: counterNotes[c._id] || '' })}>{busy ? <span className="spinner-border spinner-border-sm" /> : myTurn ? 'Send Re-counter' : 'Send Counter'}</button>
                  <button className="tj-counter-inline-cancel" onClick={() => setCounterOpen(p => ({ ...p, [c._id]: false }))}>Cancel</button>
                </div>
                <textarea className="tj-counter-note-input" rows={2} placeholder="Optional note to technician…" value={counterNotes[c._id] || ''} onChange={(e) => setCounterNotes(p => ({ ...p, [c._id]: e.target.value }))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── InvoicePanel ──────────────────────────────────────────────────────────────
const InvoicePanel = ({ requestId, request, onInvoiceAction }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try { const res = await adminApi.getInvoice(requestId); setInvoice(res.data?.invoice || null); }
    catch (err) { if (err.response?.status !== 404) toast.error('Failed to load invoice'); setInvoice(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [requestId]); // eslint-disable-line

  const generate = async () => {
    setGenerating(true);
    try { const res = await adminApi.generateInvoice(requestId, { adminNotes }); toast.success(res.message || 'Invoice generated!'); setInvoice(res.data?.invoice || null); onInvoiceAction?.(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to generate invoice'); }
    finally { setGenerating(false); }
  };

  if (loading) return <div className="tj-loading admin-technician-jobs-23" ><div className="spinner-border spinner-border-sm admin-technician-jobs-24"  /><span>Loading invoice…</span></div>;
  const canGenerate = request?.status === 'accepted' && ['agreed', 'none'].includes(request?.chargesStatus) && !invoice;
  if (!invoice) return (
    <div className="tj-invoice-wrap">
      <div className="tj-charges-empty"><FaFileInvoiceDollar size={32} className="admin-technician-jobs-25"  /><span>No invoice yet</span>{request?.chargesStatus === 'pending' && <div className="tj-charges-alert admin-technician-jobs-26" ><FaReceipt />Pending charges must be reviewed first</div>}</div>
      {canGenerate && (<div className="admin-technician-jobs-27" ><label className="tj-label">Admin Notes (optional)</label><textarea className="form-control tj-input" rows={2} placeholder="Notes for this invoice…" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /><button className="tj-btn-invoice" disabled={generating} onClick={generate}>{generating ? <><span className="spinner-border spinner-border-sm" /> Generating…</> : <><FaFileInvoiceDollar /> Generate Final Invoice</>}</button></div>)}
    </div>
  );
  return (
    <div className="tj-invoice-wrap">
      <div className="tj-invoice-header">
        <div><div className="tj-invoice-number">{invoice.invoiceNumber}</div><div className="admin-technician-jobs-28" >Generated {fmtDT(invoice.createdAt)}</div></div>
        <span className={`tj-invoice-status ${invoice.status}`}>{invoice.status === 'draft' && '⬜ Draft'}{invoice.status === 'finalised' && '✓ Finalised'}{invoice.status === 'paid' && '💰 Paid'}</span>
      </div>
      <table className="tj-invoice-table"><thead><tr><th className="admin-technician-jobs-29" >Description</th><th>Requested</th><th>Agreed</th></tr></thead><tbody><tr><td><div className="tj-inv-label">{invoice.fixedJobLabel || 'Fixed Job Charge'}</div></td><td className="tj-inv-amount">${Number(invoice.fixedJobCharge).toLocaleString()}</td><td className="tj-inv-amount">${Number(invoice.fixedJobCharge).toLocaleString()}</td></tr>{invoice.additionalCharges?.map((c, i) => (<tr key={i}><td><div className="tj-inv-label">{c.label}</div>{c.description && <div className="tj-inv-desc">{c.description}</div>}</td><td className="tj-inv-amount">${Number(c.requestedAmount).toLocaleString()}</td><td className="tj-inv-amount">${Number(c.agreedAmount).toLocaleString()}</td></tr>))}</tbody></table>
      <div className="tj-invoice-totals"><div className="tj-invoice-row"><span>Fixed Charge</span><span>${Number(invoice.fixedJobCharge).toLocaleString()}</span></div>{invoice.subtotalAdditional > 0 && <div className="tj-invoice-row"><span>Additional Charges</span><span>${Number(invoice.subtotalAdditional).toLocaleString()}</span></div>}<div className="tj-invoice-row total"><span>Total</span><span className="tj-inv-total-val">${Number(invoice.totalAmount).toLocaleString()}</span></div></div>
      {invoice.adminNotes && <div className="tj-charge-admin-note">Notes: {invoice.adminNotes}</div>}
      {invoice.paidAt && <div className="admin-technician-jobs-30" ><FaCheckCircle className="admin-technician-jobs-31"  />Paid on {fmtDT(invoice.paidAt)}</div>}
    </div>
  );
};

// ─── Modal wrapper ─────────────────────────────────────────────────────────────
const Modal = ({ show, onClose, title, children, size = '' }) => {
  if (!show) return null;
  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div className={`tj-modal-box ${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header"><h5 className="tj-modal-title">{title}</h5><button className="tj-modal-close" onClick={onClose}><FaTimes /></button></div>
        <div className="tj-modal-body">{children}</div>
      </div>
    </div>
  );
};

// ─── RescheduleModal — calendar-style UI ───────────────────────────────────────
const RescheduleModal = ({ show, job, onClose, onReschedule, rescheduling }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const TIME_SLOTS = ['09:00 - 10:00 AM','10:00 - 11:00 AM','11:00 - 12:00 PM','02:00 - 03:00 PM','03:00 - 04:00 PM','04:00 - 05:00 PM'];

  useEffect(() => {
    if (show && job) {
      const now = new Date();
      setCalYear(now.getFullYear()); setCalMonth(now.getMonth());
      setSelectedDate(''); setSelectedSlot(''); setReason('');
    }
  }, [show, job]);

  if (!show) return null;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  const buildDateTimes = () => {
    if (!selectedDate || !selectedSlot) return null;
    const [startTime] = selectedSlot.split(' - ');
    const isPM = selectedSlot.includes('PM') && !startTime.startsWith('12');
    const [h, m] = startTime.split(':');
    let startH = parseInt(h, 10);
    if (isPM) startH += 12;
    const from = new Date(selectedDate);
    from.setHours(startH, parseInt(m, 10), 0, 0);
    const to = new Date(from);
    to.setHours(to.getHours() + 1);
    return {
      from: from.toISOString().slice(0, 16),
      to: to.toISOString().slice(0, 16),
    };
  };

  const isValid = selectedDate && selectedSlot;

  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div className="tj-modal-box tj-reschedule-box" onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header">
          <h5 className="tj-modal-title">Reschedule Job</h5>
          <button className="tj-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="tj-modal-body tj-reschedule-body">
          <div className="tj-reschedule-left">
            <div className="tj-reschedule-subtitle">Select New Appointment</div>
            {/* Calendar */}
            <div className="tj-calendar">
              <div className="tj-cal-nav">
                <button className="tj-cal-arrow" onClick={prevMonth}>‹</button>
                <span className="tj-cal-month">{monthNames[calMonth]} {calYear}</span>
                <button className="tj-cal-arrow" onClick={nextMonth}>›</button>
              </div>
              <div className="tj-cal-grid">
                {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d} className="tj-cal-dayname">{d}</div>)}
                {Array.from({ length: adjustedFirst }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const d = new Date(calYear, calMonth, day);
                  const isPast = d < today;
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button key={day} className={`tj-cal-day${isSelected ? ' selected' : ''}${isPast ? ' past' : ''}`} disabled={isPast} onClick={() => setSelectedDate(dateStr)}>{day}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="tj-reschedule-right">
            <div className="tj-slots">
              {TIME_SLOTS.map(slot => (
                <button key={slot} className={`tj-slot-btn${selectedSlot === slot ? ' selected' : ''}`} onClick={() => setSelectedSlot(slot)}>{slot}</button>
              ))}
            </div>
            <div className="tj-reschedule-reason">
              <label className="tj-label">Reason</label>
              <select className="form-select tj-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Customer requested</option>
                <option value="technician_unavailable">Technician unavailable</option>
                <option value="customer_request">Customer request</option>
                <option value="admin_decision">Admin decision</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="tj-reschedule-footer">
              <button className="tj-btn-ghost" onClick={onClose} disabled={rescheduling}>Cancel</button>
              <button className="tj-btn-primary-gold" disabled={rescheduling || !isValid} onClick={() => { const dt = buildDateTimes(); if (dt) onReschedule(job._id, dt.from, dt.to, reason); }}>
                {rescheduling ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PayWalletModal ────────────────────────────────────────────────────────────
const PayWalletModal = ({ show, job, onClose, onPay, paying }) => {
  const [feedback, setFeedback] = useState(emptyFeedback);
  const [discount, setDiscount] = useState('0');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (show) {
      setFeedback(emptyFeedback());
      setDiscount('0');
      setNote('');
    }
  }, [show, job]);
  if (!show) return null;
  const basePrice = Number(job?.finalPrice || job?.pay?.fixedAmount || job?.pay?.blendedFixedAmount || 0);
  const discountAmount = Math.max(0, Math.min(basePrice, Number(discount || 0)));
  const finalPrice = basePrice - discountAmount;
  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div className="tj-modal-box lg" onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header">
          <h5 className="tj-modal-title"><FaWallet className="me-2 admin-technician-jobs-32"  />Approve Technician Payment</h5>
          <button className="tj-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="tj-modal-body">
          <p className="text-muted small mb-3">Job: <strong>{job?.title}</strong> &nbsp;|&nbsp; Tech: <strong>{job?.assignedTechnician?.name || '—'}</strong></p>
          {job?.jobDurationMinutes != null && <div className="tj-pay-info-row mb-3"><FaClock className="admin-technician-jobs-33"  /><span>Job duration: <strong>{formatDuration(job.jobDurationMinutes)}</strong></span></div>}
          <div className="tj-pay-info-row mb-3"><FaReceipt className="admin-technician-jobs-34"  /><span>Job price: <strong>${basePrice.toLocaleString()}</strong></span></div>
          <label className="tj-label">Discount ($)</label>
          <div className="tj-counter-input-wrap mb-3"><span className="tj-counter-prefix">$</span><input className="tj-counter-input" type="number" min="0" max={basePrice} placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div className="tj-pay-info-row mb-3"><FaCheckCircle className="admin-technician-jobs-35"  /><span>Final price: <strong>${finalPrice.toLocaleString()}</strong></span></div>
          <label className="tj-label">Note (optional)</label>
          <textarea className="form-control tj-input mb-3" rows={2} placeholder="Approval note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <TechnicianRatingForm value={feedback} onChange={setFeedback} disabled={paying} />
          {!feedback.score && <p className="text-muted small">Rating is optional. You can rate this technician from the paid work order later.</p>}
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn tj-btn-ghost" onClick={onClose} disabled={paying}>Cancel</button>
            <button className="btn tj-btn-pay" disabled={paying || basePrice <= 0 || discountAmount > basePrice} onClick={() => onPay(job._id, discountAmount, note, feedback.score ? feedback : undefined)}>{paying ? <><span className="spinner-border spinner-border-sm me-2" />Processing…</> : <><FaWallet className="me-2" />Approve Payment</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── StatusUpdateModal ─────────────────────────────────────────────────────────
const StatusUpdateModal = ({ show, targetStatus, job, onClose, onConfirm, saving }) => {
  const [note, setNote] = useState('');
  useEffect(() => { if (show) setNote(''); }, [show, targetStatus]);
  if (!show) return null;
  const needsPrice = false;
  return (
    <div className="tj-modal-backdrop tj-status-modal-backdrop" onClick={onClose}>
      <div className="tj-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header"><h5 className="tj-modal-title">Set Status — <span className="admin-technician-jobs-36" >{targetStatus}</span></h5><button className="tj-modal-close" onClick={onClose}><FaTimes /></button></div>
        <div className="tj-modal-body">
          <p className="text-muted small mb-3">Job: <strong>{job?.title}</strong></p>
          <label className="tj-label">Note (optional)</label>
          <textarea className="form-control tj-input mb-3" rows={3} placeholder={`Why is the status changing to "${targetStatus}"?`} value={note} onChange={(e) => setNote(e.target.value)} autoFocus={!needsPrice} />
          <div className="d-flex gap-2 justify-content-end"><button className="btn tj-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button><button className="btn tj-btn-primary-gold" disabled={saving} onClick={() => onConfirm(targetStatus, note.trim())}>{saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : 'Confirm Status Update'}</button></div>
        </div>
      </div>
    </div>
  );
};

const UnassignTechnicianModal = ({ job, onClose, onConfirm, saving }) => {
  const [reason, setReason] = useState('');
  useEffect(() => { if (job) setReason(''); }, [job]);
  if (!job) return null;
  return (
    <div className="tj-modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="tj-modal-box" role="dialog" aria-modal="true" aria-labelledby="tj-unassign-title" onClick={event => event.stopPropagation()}>
        <div className="tj-modal-header">
          <h5 className="tj-modal-title" id="tj-unassign-title">Unassign Technician</h5>
          <button className="tj-modal-close" disabled={saving} onClick={onClose}><FaTimes /></button>
        </div>
        <form onSubmit={event => { event.preventDefault(); onConfirm(reason); }}>
          <div className="tj-modal-body">
            <p><strong>{job.assignedTechnician?.name || 'Technician'}</strong> will be notified, and this job will become visible to all technicians again.</p>
            <label className="tj-label" htmlFor="tj-unassign-reason">Reason</label>
            <textarea id="tj-unassign-reason" className="form-control tj-input" rows={4} maxLength={1000} required value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this assignment is ending…" disabled={saving} />
          </div>
          <div className="tj-reschedule-footer">
            <button type="button" className="tj-btn-ghost" disabled={saving} onClick={onClose}>Keep Assignment</button>
            <button type="submit" className="tj-btn-primary-gold" disabled={saving || !reason.trim()}>{saving ? 'Unassigning…' : 'Unassign and Reopen Job'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── FilterDropdown — popup panel matching the design ─────────────────────────
const FilterDropdown = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selectedLabel = options.find(o => o.value === value)?.label || label;
  return (
    <div className="tj-filter-dropdown" ref={ref}>
      <button className={`tj-filter-dropdown-btn${open ? ' open' : ''}`} onClick={() => setOpen(p => !p)}>
        <span>{selectedLabel}</span>
        <FaChevronDown className="tj-filter-caret" />
      </button>
      {open && (
        <div className="tj-filter-dropdown-panel">
          <div className="tj-filter-panel-header"><span>Filter by {label}</span><button onClick={() => setOpen(false)}><FaTimes /></button></div>
          {options.map(opt => (
            <div key={opt.value} className={`tj-filter-panel-item${value === opt.value ? ' active' : ''}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
              <span>{opt.label}</span>
              {value === opt.value && <FaCheck className="tj-filter-check" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main TechnicianJobs Page ──────────────────────────────────────────────────
const TechnicianJobs = () => {
  const [searchParams] = useSearchParams();
  const { can } = useAdminAuth();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true); setTemplatesError('');
    try { const res = await adminApi.getTechnicianJobTemplates(); setTemplates(res.data?.templates || []); }
    catch (error) { setTemplatesError(error.response?.data?.message || 'Could not load job templates.'); }
    finally { setTemplatesLoading(false); }
  }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  const [jobs, setJobs]         = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [workTypes, setWorkTypes]       = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [paying, setPaying]           = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleJob, setRescheduleJob] = useState(null);
  const [statusModal, setStatusModal]   = useState({ show: false, targetStatus: '' });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Tab + filter state
  const [activeTab, setActiveTab]   = useState('all');
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [filterDate, setFilterDate] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [jobPage, setJobPage] = useState(1);
  const [jobPageSize, setJobPageSize] = useState(10);

  const [invitationJob, setInvitationJob] = useState(null);
  const [unassignJob, setUnassignJob] = useState(null);
  const [unassigning, setUnassigning] = useState(false);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [ratingJob, setRatingJob] = useState(null);
  const [feedback, setFeedback] = useState(emptyFeedback);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [showPayModal, setShowPayModal]   = useState(false);
  const [payModalJob, setPayModalJob]     = useState(null);

  const [jobRequestsModal, setJobRequestsModal] = useState({ show: false, job: null });
  const [activeConvReq, setActiveConvReq]       = useState(null);
  const [adminReply, setAdminReply]             = useState('');
  const [adminCounterAmount, setAdminCounterAmount] = useState('');
  const [decidingId, setDecidingId]             = useState(null);
  const [sending, setSending]                   = useState(false);
  const [liveConversation, setLiveConversation] = useState([]);
  const activeReqIdRef = useRef(null);

  const [convTab, setConvTab] = useState('chat');
  const [liveChargesStatus, setLiveChargesStatus] = useState('none');

  const [form, setForm]         = useState(emptyForm);
  const [editingJobId, setEditingJobId] = useState(null);
  const [selectedJob, setSelectedJob]   = useState(null);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsRes, reqRes] = await Promise.all([adminApi.getTechnicianJobs(), adminApi.getTechnicianRequests()]);
      const loadedJobs = jobsRes.data?.jobs || [];
      setJobs(loadedJobs);
      setSelectedJob(previous => previous ? loadedJobs.find(job => job._id === previous._id) || previous : previous);
      setRequests(reqRes.data?.requests || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };
  const loadDropdownData = async () => {
    try {
      const [wtRes, stRes] = await Promise.all([adminApi.getWorkTypes(), adminApi.getServiceTypes()]);
      setWorkTypes(wtRes.data?.workTypes || []);
      setServiceTypes(stRes.data?.serviceTypes || []);
    } catch (err) { console.error('Failed to load work/service types:', err); }
  };
  useEffect(() => { loadData(); loadDropdownData(); }, []);

  // ── Socket ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMsg = ({ requestId, message }) => { if (activeReqIdRef.current !== requestId) return; setLiveConversation(p => [...p, message]); };
    const handleStatus = ({ requestId, status }) => { if (activeReqIdRef.current !== requestId) return; setRequests(p => p.map(r => r._id === requestId ? { ...r, status } : r)); };
    const handleJobCreated = ({ job }) => setJobs(p => [job, ...p]);
    const handleJobUpdated = ({ job }) => { setJobs(p => p.map(j => j._id === job._id ? job : j)); setSelectedJob(p => p?._id === job._id ? job : p); };
    const handleJobDeleted = ({ jobId }) => { setJobs(p => p.filter(j => j._id !== jobId)); setSelectedJob(p => p?._id === jobId ? null : p); setShowViewPanel(p => p && selectedJob?._id === jobId ? false : p); };
    const handleRequestUpdated = ({ request }) => setRequests(p => p.some(r => r._id === request._id) ? p.map(r => r._id === request._id ? request : r) : [request, ...p]);
    const handleRequestAssigned = ({ request }) => { if (request) setRequests(p => p.map(r => r._id === request._id ? request : r)); loadData(); };
    const handleChargesSubmitted = ({ requestId }) => { if (activeReqIdRef.current === requestId) setLiveChargesStatus('pending'); setRequests(p => p.map(r => r._id === requestId ? { ...r, chargesStatus: 'pending' } : r)); loadData(); };
    const handleChargeReviewed = ({ requestId, requestChargesStatus }) => { if (activeReqIdRef.current === requestId && requestChargesStatus) setLiveChargesStatus(requestChargesStatus); loadData(); };
    const handleChargeResponded = ({ requestId }) => { if (activeReqIdRef.current === requestId) loadData(); };
    const handleInvoiceGenerated = ({ requestId }) => { if (activeReqIdRef.current === requestId) setLiveChargesStatus('invoiced'); loadData(); };
    const handleInvoicePaid = () => loadData();
    const handleTaskCompleted = ({ jobId, taskIndex, task }) => {
      const upd = (j) => { if (j._id !== jobId) return j; const tasks = [...(j.tasks || [])]; tasks[taskIndex] = task; return { ...j, tasks }; };
      setJobs(p => p.map(upd)); setSelectedJob(p => p ? upd(p) : p);
    };
    socket.on('request:message', handleMsg); socket.on('request:status', handleStatus);
    socket.on('job:availability', loadData);
    socket.on('job:created', handleJobCreated); socket.on('job:updated', handleJobUpdated); socket.on('job:deleted', handleJobDeleted);
    socket.on('request:updated', handleRequestUpdated); socket.on('charges:submitted', handleChargesSubmitted);
    socket.on('request:assigned', handleRequestAssigned);
    socket.on('charge:reviewed', handleChargeReviewed); socket.on('charge:responded', handleChargeResponded);
    socket.on('invoice:generated', handleInvoiceGenerated); socket.on('invoice:paid', handleInvoicePaid);
    socket.on('job:task:completed', handleTaskCompleted);
    return () => {
      socket.off('request:message', handleMsg); socket.off('request:status', handleStatus);
      socket.off('job:availability', loadData);
      socket.off('job:created', handleJobCreated); socket.off('job:updated', handleJobUpdated); socket.off('job:deleted', handleJobDeleted);
      socket.off('request:updated', handleRequestUpdated); socket.off('charges:submitted', handleChargesSubmitted);
      socket.off('request:assigned', handleRequestAssigned);
      socket.off('charge:reviewed', handleChargeReviewed); socket.off('charge:responded', handleChargeResponded);
      socket.off('invoice:generated', handleInvoiceGenerated); socket.off('invoice:paid', handleInvoicePaid);
      socket.off('job:task:completed', handleTaskCompleted);
    };
  }, [selectedJob]);

  // ── Live rider locations (no DB — pure socket, emitted by Flutter app) ────────
  // liveLocations: { [jobId]: { lat, lng, technicianId, ts } }
  // Populated by the admin room broadcast so the admin sees ALL active riders
  // without having to open each job individually.
  const [liveLocations, setLiveLocations] = useState({});

  useEffect(() => {
    const handleTechnicianLocation = ({ jobId, technicianId, lat, lng, ts }) => {
      if (!jobId || lat == null || lng == null) return;

      // 1. Keep a page-level map of the latest position for every active job.
      setLiveLocations(prev => ({
        ...prev,
        [jobId]: { lat, lng, technicianId, ts },
      }));

      // 2. If this is the job currently open in the detail panel, also update
      //    selectedJob.coordinates so TechnicianTrackingMap gets the fresh pin.
      //    (TechnicianTrackingMap already subscribes to the job room directly,
      //    so this is a belt-and-braces fallback for the route-draw logic.)
      setSelectedJob(prev => {
        if (!prev || prev._id !== jobId) return prev;
        return { ...prev, _liveCoords: { lat, lng } };
      });
    };

    socket.on('technician:location', handleTechnicianLocation);
    return () => socket.off('technician:location', handleTechnicianLocation);
  }, []); // intentionally empty — this listener is page-level, not job-scoped

  const [socketConnected, setSocketConnected] = useState(socket.connected);
  useEffect(() => {
    const onC = () => setSocketConnected(true), onD = () => setSocketConnected(false);
    socket.on('connect', onC); socket.on('disconnect', onD);
    return () => { socket.off('connect', onC); socket.off('disconnect', onD); };
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    active:    jobs.filter(j => ['assigned','ontheway','visited','inprogress'].includes(j.status)).length,
    unassigned: jobs.filter(j => j.status === 'open').length,
    checkout:  jobs.filter(j => j.status === 'checkout').length,
    total:     jobs.length,
  }), [jobs]);

  // ── Tab counts ────────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    all:        jobs.filter(j => ['draft', 'assigned','open', 'ontheway', 'inprogress', 'checkout', 'cancelled', 'completed'].includes(j.status)).length,
    drafts:     jobs.filter(j => j.status === 'draft').length,
    alljobs:    jobs.length,
    pending:    jobs.filter(j => j.status === 'open').length,
    assigned:   jobs.filter(j => j.status === 'assigned').length,
    ontheway:   jobs.filter(j => j.status === 'ontheway').length,
    inprogress: jobs.filter(j => j.status === 'inprogress').length,
    checkout:   jobs.filter(j => j.status === 'checkout').length,
    completed:  jobs.filter(j => j.status === 'completed').length,
    cancelled:  jobs.filter(j => j.status === 'cancelled').length,
  }), [jobs]);

  // ── Tab-to-status mapping ─────────────────────────────────────────────────────
  const TAB_STATUS_MAP = {
    all:        ['draft', 'assigned','open', 'ontheway', 'inprogress', 'checkout', 'cancelled','completed'],
    alljobs:    null,
    drafts:     ['draft'],
    pending:    ['open'],
    assigned:   ['assigned'],
    ontheway:   ['ontheway'],
    inprogress: ['inprogress'],
    checkout:   ['checkout'],
    completed:  ['completed'],
    cancelled:  ['cancelled'],
  };

  // ── Filtered jobs ─────────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    const toLocalDay = (dt) => { if (!dt) return null; const d = new Date(dt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const todayStr = toLocalDay(new Date());
    const yesterdayStr = toLocalDay(new Date(Date.now() - 86400000));
    const last7 = new Date(Date.now() - 7 * 86400000);

    return jobs.filter(job => {
      const allowedStatuses = TAB_STATUS_MAP[activeTab];
      if (allowedStatuses && !allowedStatuses.includes(job.status)) return false;
      if (filterStatus !== 'all' && job.status !== filterStatus) return false;
      if (filterAssignment === 'assigned' && !job.assignedTechnician?.name) return false;
      if (filterAssignment === 'unassigned' && job.assignedTechnician?.name) return false;
      if (search) {
        const query = search.trim().toLowerCase();
        const jobId = String(job._id || '');
        const displayJobId = `JB-${jobId.slice(-6)}`;
        const searchableText = [jobId, displayJobId, job.title, job.location, job.assignedTechnician?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      if (filterDate !== 'all') {
        const jobDay = toLocalDay(job.jobDate?.from);
        if (!jobDay) return false;
        if (filterDate === 'today') return jobDay === todayStr;
        if (filterDate === 'yesterday') return jobDay === yesterdayStr;
        if (filterDate === 'last7') return new Date(job.jobDate.from) >= last7;
        if (filterDate === 'custom') return customDate ? jobDay === customDate : true;
      }
      return true;
    });
  }, [jobs, activeTab, filterStatus, filterAssignment, search, filterDate, customDate]);

  const totalJobPages = Math.max(1, Math.ceil(filteredJobs.length / jobPageSize));
  const paginatedJobs = filteredJobs.slice((jobPage - 1) * jobPageSize, jobPage * jobPageSize);
  useEffect(() => { setJobPage(1); }, [activeTab, search, filterStatus, filterAssignment, filterDate, customDate]);
  useEffect(() => { if (jobPage > totalJobPages) setJobPage(totalJobPages); }, [jobPage, totalJobPages]);

  // ── Form helpers ──────────────────────────────────────────────────────────────
  const buildPayload = f => buildJobPayload(f, workTypes, serviceTypes);

  const handleSaveTemplate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await adminApi.createTechnicianJobTemplate({ ...buildPayload(form), templateName: form.templateName });
      setTemplates(previous => [res.data.template, ...previous]);
      toast.success('Job template saved!'); setShowTemplateModal(false); setForm(emptyForm);
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to save template'); }
    finally { setSaving(false); }
  };
  const applyTemplate = (id) => {
    setSelectedTemplateId(id);
    const template = templates.find(item => item._id === id);
    setForm(template ? templateToJobForm(template, emptyForm) : emptyForm);
  };
  const handleAdd = async (e) => { e.preventDefault(); setSaving(true); try { await adminApi.createTechnicianJob(buildPayload(form)); toast.success('Job created!'); setShowAddModal(false); setForm(emptyForm); await loadData(); } catch (err) { toast.error(err.response?.data?.message || 'Failed to create job'); } finally { setSaving(false); } };
  const openEditModal = (job) => {
    setEditingJobId(job._id);
    setForm({ scheduledDate: templateToJobForm(job, emptyForm).scheduledDate, visibleTo: job.visibleTo || 'technicians', title: job.title || '', location: job.location || '', city: job.city || '', state: job.state || '', zipCode: job.zipCode || '', coordinates: job.coordinates?.lat ? job.coordinates : null, pay: { type: job.pay?.type || 'fixed', fixedAmount: job.pay?.fixedAmount ?? '', hourlyRate: job.pay?.hourlyRate ?? '', maxHours: job.pay?.maxHours ?? '', perDeviceRate: job.pay?.perDeviceRate ?? '', maxDevices: job.pay?.maxDevices ?? '', blendedFixedAmount: job.pay?.blendedFixedAmount ?? '', blendedFixedHours: job.pay?.blendedFixedHours ?? '', blendedHourlyRate: job.pay?.blendedHourlyRate ?? '', blendedMaxAddlHours: job.pay?.blendedMaxAddlHours ?? '', approxHours: job.pay?.approxHours || '' }, description: job.description || '', preferredSkills: (job.preferredSkills || []).join(', '), requirements: (job.requirements || []).join(', '), tasks: (job.tasks || []).map(t => ({ _id: t._id, title: t.title || '', group: t.group || 'Prep', order: t.order || 0, isDone: t.isDone || false, requiresNote: Boolean(t.requiresNote), requiresImage: Boolean(t.requiresImage), requiresSignature: Boolean(t.requiresSignature), requirementReason: t.requirementReason || '', completionNote: t.completionNote, completionImage: t.completionImage, completionSignature: t.completionSignature, checkedAt: t.checkedAt || null, technicianLat: t.technicianLat || null, technicianLng: t.technicianLng || null, distanceMiles: t.distanceMiles ?? null, distanceMeters: t.distanceMeters ?? null })), workTypeId: job.workType?._id || '', workTypeSubId: job.workType?.subType?._id || '', additionalWorkTypeId: job.additionalWorkType?._id || '', additionalWorkTypeSubId: job.additionalWorkType?.subType?._id || '', serviceTypeId: job.serviceType?._id || '', jobDate: templateToJobForm(job, emptyForm).jobDate });
    setShowEditModal(true);
  };
  const handleEdit = async (e) => {
    e.preventDefault();
    const shouldPublish = e.nativeEvent.submitter?.value === 'publish';
    setSaving(true);
    let editsSaved = false;
    try {
      await adminApi.updateTechnicianJob(editingJobId, buildPayload(form));
      editsSaved = true;
      if (shouldPublish) {
        await adminApi.updateTechnicianJobStatus(editingJobId, {
          status: 'open',
          note: 'Work order reviewed and published.',
        });
      }
      toast.success(shouldPublish ? 'Work order saved and published!' : 'Job updated!');
      setShowEditModal(false);
      setForm(emptyForm);
      setEditingJobId(null);
      await loadData();
    } catch (err) {
      const message = err.response?.data?.message;
      toast.error(shouldPublish && editsSaved
        ? `Edits saved, but publishing failed: ${message || 'Please try again.'}`
        : message || 'Failed to update job');
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (jobId) => { if (!window.confirm('Delete this job? This cannot be undone.')) return; try { await adminApi.deleteTechnicianJob(jobId); toast.success('Job deleted'); if (selectedJob?._id === jobId) setShowViewPanel(false); await loadData(); } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); } };
  const openViewPanel = (job) => { setSelectedJob(job); setShowViewPanel(true); };
  const handleOverviewLinkClick = (event, job) => {
    event.stopPropagation();
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openViewPanel(job);
  };
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    const job = jobs.find(item => item._id === jobId);
    if (job) openViewPanel(job);
  }, [searchParams, jobs]);
  const openRescheduleModal = (job) => { if (!canRescheduleJob(job)) return; setRescheduleJob(job); setShowRescheduleModal(true); };
  const handleReschedule = async (jobId, jobDateFrom, jobDateTo, reason) => { setRescheduling(true); try { await adminApi.rescheduleJob(jobId, { jobDateFrom, jobDateTo, reason }); toast.success('Job rescheduled!'); setShowRescheduleModal(false); setRescheduleJob(null); await loadData(); if (selectedJob?._id === jobId) setSelectedJob(p => p ? { ...p, jobDate: { from: jobDateFrom, to: jobDateTo }, scheduledDate: jobDateFrom } : p); } catch (err) { toast.error(err.response?.data?.message || 'Reschedule failed'); } finally { setRescheduling(false); } };
  const handleStatusUpdate = async (status, note) => { setUpdatingStatus(true); try { await adminApi.updateTechnicianJobStatus(selectedJob._id, { status, note: note || '' }); toast.success('Status updated!'); setStatusModal({ show: false, targetStatus: '' }); setSelectedJob(p => ({ ...p, status, statusHistory: [...(p.statusHistory || []), { status, note: note || '', changedAt: new Date().toISOString() }] })); await loadData(); } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); } finally { setUpdatingStatus(false); } };
  const handlePublishWorkOrder = async (job) => {
    setPublishing(true);
    try {
      const res = await adminApi.updateTechnicianJobStatus(job._id, {
        status: 'open',
        note: 'Booking work order reviewed and published.',
      });
      const publishedJob = res.data?.job;
      if (publishedJob) {
        setSelectedJob(publishedJob);
        setJobs(previous => previous.map(item => item._id === publishedJob._id ? publishedJob : item));
      }
      toast.success('Work order published and made available to technicians.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not publish work order.');
    } finally {
      setPublishing(false);
    }
  };
  const handleUnassign = async reason => { setUnassigning(true); try { const res = await adminApi.unassignTechnicianJob(unassignJob._id, { reason: reason.trim() }); toast.success(res.message || 'Technician unassigned.'); setUnassignJob(null); await loadData(); if (selectedJob?._id === res.data?.job?._id) setSelectedJob(res.data.job); } catch (err) { toast.error(err.response?.data?.message || 'Could not unassign technician.'); } finally { setUnassigning(false); } };
  const openPayModal = (job) => { setPayModalJob(job); setShowPayModal(true); };
  const handlePayWallet = async (jobId, discount, note, feedback) => { setPaying(true); try { const res = await adminApi.payTechnician(jobId, { discount, note, feedback }); toast.success(res.message || 'Payment approved!'); if (res.data?.ratingWarning) toast.warning(res.data.ratingWarning); setShowPayModal(false); setPayModalJob(null); await loadData(); if (selectedJob?._id === jobId && res.data?.job) setSelectedJob(res.data.job); } catch (err) { toast.error(err.response?.data?.message || 'Payment failed'); } finally { setPaying(false); } };

  const openRating = job => { setRatingJob(job); setFeedback(emptyFeedback()); };
  const saveRating = async () => {
    setRatingSaving(true);
    try {
      const res = await adminApi.rateTechnician(ratingJob._id, feedback);
      if (selectedJob?._id === ratingJob._id) setSelectedJob(res.data.job);
      toast.success('Technician feedback saved!');
      setRatingJob(null);
      await loadData();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save feedback.'); }
    finally { setRatingSaving(false); }
  };

  // ── Socket room helpers ───────────────────────────────────────────────────────
  const openConversation = (req) => { setActiveConvReq(req); setAdminReply(''); setAdminCounterAmount(''); setLiveConversation(req.conversation || []); setConvTab('chat'); setLiveChargesStatus(req.chargesStatus || 'none'); activeReqIdRef.current = req._id; socket.emit('request:join', req._id); };
  const closeConversation = () => { if (activeReqIdRef.current) { socket.emit('request:leave', activeReqIdRef.current); activeReqIdRef.current = null; } setActiveConvReq(null); setAdminReply(''); setAdminCounterAmount(''); setLiveConversation([]); setConvTab('chat'); setLiveChargesStatus('none'); };
  const handleDecision = async (requestId, status) => { setDecidingId(requestId); try { await adminApi.updateTechnicianRequest(requestId, { status, adminMessage: adminReply }); toast.success(status === 'accepted' ? 'Request accepted!' : 'Request rejected.'); setAdminReply(''); await loadData(); } catch (err) { toast.error(err.response?.data?.message || 'Action failed'); } finally { setDecidingId(null); } };
  const handleCounter = async requestId => { if (!adminCounterAmount || Number(adminCounterAmount) <= 0) return toast.error('Enter a valid counter-offer amount.'); setDecidingId(requestId); try { await adminApi.updateTechnicianRequest(requestId, { status: 'counter-offer', counterOffer: Number(adminCounterAmount), adminMessage: adminReply }); toast.success('Counter-offer sent to technician.'); setAdminCounterAmount(''); setAdminReply(''); await loadData(); } catch (err) { toast.error(err.response?.data?.message || 'Counter-offer failed'); } finally { setDecidingId(null); } };
  const handleSendMessage = async (requestId) => { if (!adminReply.trim()) return; setSending(true); try { await adminApi.sendTechnicianRequestMessage(requestId, adminReply.trim()); setAdminReply(''); } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); } finally { setSending(false); } };

  // ── Filter option lists ───────────────────────────────────────────────────────
  const statusOptions = [{ value: 'all', label: 'All' }, { value: 'draft', label: 'Draft' }, ...JOB_STATUS_OPTIONS.map(s => ({ value: s, label: getStatusLbl(s) }))];
  const urgencyOptions = [{ value: 'all', label: 'All' }, { value: 'normal', label: 'Normal' }, { value: 'emergency', label: 'Emergency' }];
  const paymentOptions = [{ value: 'all', label: 'All' }, { value: 'authorized', label: 'Authorized' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'refunded', label: 'Refunded' }, { value: 'on_hold', label: 'On Hold' }];
  const assignmentOptions = [{ value: 'all', label: 'All' }, { value: 'assigned', label: 'Assigned' }, { value: 'unassigned', label: 'Unassigned' }];
  const dateOptions = [{ value: 'all', label: 'All Dates' }, { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'last7', label: 'Last 7 days' }, { value: 'custom', label: 'Custom Date' }];

  const TABS = [
    { key: 'all',        label: 'All' },
    { key: 'drafts',     label: 'Drafts' },
    { key: 'pending',    label: 'Unassigned' },
    { key: 'assigned',   label: 'Assigned' },
    { key: 'ontheway',   label: 'On the Way' },
    { key: 'inprogress', label: 'In Progress' },
    { key: 'checkout',   label: 'Checkout' },
    { key: 'completed',  label: 'Completed' },
    { key: 'cancelled',  label: 'Cancelled' },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="tj-page">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="tj-page-header">
        <div>
          <div className="tj-breadcrumb">Field Operations &rsaquo; Jobs</div>
          <h2 className="tj-page-title">Jobs Management Dashboard</h2>
          <p className="tj-page-sub">
            {stats.total} jobs on record &bull; {stats.active} active right now
            <span className={`tj-socket-status ${socketConnected ? 'online' : 'offline'}`}>
              <span className="tj-socket-dot" />
              {socketConnected ? 'Live' : 'Connecting…'}
            </span>
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="tj-btn-primary-gold" onClick={() => { setForm(emptyForm); setSelectedTemplateId(''); setShowAddModal(true); loadTemplates(); }}><FaPlus className="me-2" />Add Job</button>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────────── */}
      <div className="tj-stats-row">
        <div className="tj-stat-card tj-stat-active">
          <div className="tj-stat-top-bar" />
          <div className="tj-stat-inner">
            <div className="tj-stat-label-top">ACTIVE JOBS</div>
            <div className="tj-stat-big">{stats.active} <span className="tj-stat-delta">+12% today</span></div>
          </div>
        </div>
        <div className="tj-stat-card tj-stat-unassigned">
          <div className="tj-stat-top-bar" />
          <div className="tj-stat-inner">
            <div className="tj-stat-label-top">UNASSIGNED <span className="tj-stat-dot-live" /></div>
            <div className="tj-stat-big">{stats.unassigned} <span className="tj-stat-needs">Needs action</span></div>
          </div>
        </div>
        <div className="tj-stat-card tj-stat-checkout">
          <div className="tj-stat-top-bar" />
          <div className="tj-stat-inner">
            <div className="tj-stat-label-top">CHECKOUT <span className="tj-stat-dot-live" /></div>
            <div className="tj-stat-big">{stats.checkout} <span className="tj-stat-needs">Awaiting payment</span></div>
          </div>
        </div>
        <div className="tj-stat-card tj-stat-completion">
          <div className="tj-stat-top-bar" />
          <div className="tj-stat-inner">
            <div className="tj-stat-label-top">COMPLETED JOBS</div>
            <div className="tj-stat-big">{jobs.filter(j => j.status === 'completed').length} <span className="tj-stat-awaiting">Paid and closed</span></div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <div className="tj-tab-bar">
        {TABS.map(tab => (
          <button key={tab.key} className={`tj-tab-btn${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {tabCounts[tab.key] > 0 && activeTab !== tab.key && <span className="tj-tab-count">{tabCounts[tab.key]}</span>}
          </button>
        ))}
      </div>

      {/* ── Content Card ────────────────────────────────────────────────────── */}
      <div className="tj-content-card">

        {/* Search */}
        <div className="tj-search-bar-wrap">
          <div className="tj-search-wrap">
            <FaSearch className="tj-search-icon" />
            <input className="tj-search-input" placeholder="Search by Job ID, title, technician, or location..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="tj-search-clear" onClick={() => setSearch('')}><FaTimes /></button>}
          </div>
        </div>

        {/* Primary filter row */}
        <div className="tj-filter-row">
          <div className="tj-filter-group">
            <span className="tj-filter-label">STATUS</span>
            <FilterDropdown label="Status" options={statusOptions} value={filterStatus} onChange={setFilterStatus} />
          </div>
          <div className="tj-filter-group">
            <span className="tj-filter-label">URGENCY</span>
            <FilterDropdown label="Urgency" options={urgencyOptions} value={filterUrgency} onChange={setFilterUrgency} />
          </div>
          <div className="tj-filter-group">
            <span className="tj-filter-label">PAYMENT</span>
            <FilterDropdown label="Payment" options={paymentOptions} value={filterPayment} onChange={setFilterPayment} />
          </div>
          <button className={`tj-more-filters-btn${showMoreFilters ? ' active' : ''}`} onClick={() => setShowMoreFilters(p => !p)}>
            <FaFilter className="admin-technician-jobs-37"  />
            More filters
            <FaChevronDown className={`tj-filter-caret${showMoreFilters ? ' up' : ''}`} />
          </button>
        </div>

        {/* More filters row */}
        {showMoreFilters && (
          <div className="tj-filter-row tj-filter-row-more">
            <div className="tj-filter-group">
              <span className="tj-filter-label">DATE</span>
              <FilterDropdown label="Date" options={dateOptions} value={filterDate} onChange={setFilterDate} />
            </div>
            {filterDate === 'custom' && (
              <div className="tj-filter-group">
                <span className="tj-filter-label">PICK DATE</span>
                <input type="date" className="tj-date-picker" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              </div>
            )}
            <div className="tj-filter-group">
              <span className="tj-filter-label">ASSIGNMENT</span>
              <FilterDropdown label="Assignment" options={assignmentOptions} value={filterAssignment} onChange={setFilterAssignment} />
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="tj-loading"><div className="spinner-border admin-technician-jobs-38"  /><span>Loading jobs…</span></div>
        ) : (
          <div className="table-responsive">
            <table className="tj-table">
              <thead>
                <tr>
                  <th>Job Id</th>
                  <th>Service</th>
                  <th>Technician</th>
                  <th>Appointment</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr><td colSpan={8} className="tj-empty"><FaBriefcase size={28} className="admin-technician-jobs-39"  /><span>No jobs found</span></td></tr>
                ) : (
                  paginatedJobs.map((job) => {
                    const pendingReqCount = requests.filter(r => (r.job?._id || r.job)?.toString() === job._id?.toString() && r.status?.toLowerCase() === 'pending').length;
                    const jobIdShort = job._id?.toString().slice(-6).toUpperCase();
                    return (
                      <tr key={job._id} onClick={() => openViewPanel(job)} className="admin-technician-jobs-40" >
                        <td>
                          <Link className="tj-job-id tj-overview-link" to={`/technician-jobs?jobId=${encodeURIComponent(job._id)}`} onClick={event => handleOverviewLinkClick(event, job)}>JB-{jobIdShort}</Link>
                        </td>
                        <td>
                          <Link className="tj-job-title tj-overview-link" to={`/technician-jobs?jobId=${encodeURIComponent(job._id)}`} onClick={event => handleOverviewLinkClick(event, job)}>{job.title}</Link>
                          {job.workType?.name && <div className="tj-job-cat">{job.workType.name}</div>}
                        </td>
                        <td>
                          {job.assignedTechnician?.name ? (
                            <div className="tj-tech-cell">
                              <div className="tj-tech-avatar-sm">{job.assignedTechnician.name.charAt(0)}</div>
                              <div>
                                <div className="tj-tech-name-cell">{job.assignedTechnician.name}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="tj-tech-cell">
                              <div className="tj-tech-avatar-sm tj-tech-unassigned-avatar"><FaUserAlt /></div>
                              <span className="tj-unassigned">Unassigned</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="tj-appointment">
                            {job.jobDate?.from ? (
                              <>
                                <span className="tj-appt-date">{new Date(job.jobDate.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                <span className="tj-appt-time">{fmtTime(job.jobDate.from)}{job.jobDate.to ? ` - ${fmtTime(job.jobDate.to)}` : ''}</span>
                              </>
                            ) : '—'}
                          </div>
                        </td>
                        <td>
                          <div className="tj-location-cell">
                            {job.city || job.location?.split(',')[0] || '—'}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <span className={`tj-status-pill ${getStatusCls(job.status)}`}>
                            <span className="tj-status-dot" />
                            {getStatusLbl(job.status)}
                          </span>
                        </td>
                        <td>
                          <div className="tj-amount-cell">
                            {formatPay(job.pay)}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="tj-actions">
                            <button className="tj-action-btn edit" title="Edit" onClick={() => openEditModal(job)}><FaEdit /></button>
                            <button className="tj-action-btn delete" title="Delete" onClick={() => handleDelete(job._id)}><FaTrash /></button>
                            <button className="tj-action-btn requests" title="Requests" onClick={() => setJobRequestsModal({ show: true, job })}>
                              <FaBell />
                              {pendingReqCount > 0 && <span className="tj-action-badge">{pendingReqCount}</span>}
                            </button>
                            {canRescheduleJob(job) && (<button className="tj-action-btn reschedule" title="Reschedule" onClick={() => openRescheduleModal(job)}><FaRedoAlt /></button>)}
                            {job.status === 'completed' && job.payment?.status === 'paid' && !job.technicianRating?.score && <button className="tj-action-btn" title="Rate technician" disabled={!can('technician_jobs', 'write')} onClick={() => openRating(job)}>★</button>}
                            {job.status === 'checkout' && <button className="tj-action-btn pay" title="Approve Payment" onClick={() => openPayModal(job)}><FaWallet /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination page={jobPage} limit={jobPageSize} total={filteredJobs.length} totalPages={totalJobPages} onPageChange={setJobPage} onLimitChange={size => { setJobPageSize(size); setJobPage(1); }} />}
      </div>

      {/* ── ADD / EDIT MODALS ────────────────────────────────────────────────── */}
      {invitationJob && <JobInvitationModal job={invitationJob} onClose={() => setInvitationJob(null)} onSent={loadData} />}
      <UnassignTechnicianModal job={unassignJob} onClose={() => setUnassignJob(null)} onConfirm={handleUnassign} saving={unassigning} />
      <Modal show={showTemplateModal} onClose={() => !saving && setShowTemplateModal(false)} title="Create Job Template" size="lg">
        <JobForm form={form} setForm={setForm} onSubmit={handleSaveTemplate} onCancel={() => setShowTemplateModal(false)} saving={saving} isTemplate workTypes={workTypes} serviceTypes={serviceTypes} />
      </Modal>
      <Modal show={showAddModal} onClose={() => !saving && setShowAddModal(false)} title="Create New Job" size="lg">
        <div className="p-3 rounded-3 mb-3 admin-technician-jobs-41" >
          <label className="tj-label" htmlFor="tj-use-template">Use a Saved Template</label>
          <select id="tj-use-template" className="form-select tj-input" disabled={templatesLoading || saving} value={selectedTemplateId} onChange={e => applyTemplate(e.target.value)}><option value="">{templatesLoading ? 'Loading templates…' : 'Start with a blank job'}</option>{templates.map(template => <option key={template._id} value={template._id}>{template.templateName}</option>)}</select>
          {templatesError ? <div role="alert" className="text-danger mt-2">{templatesError} <button type="button" className="btn btn-link btn-sm" onClick={loadTemplates}>Retry</button></div> : <small className="text-muted">{selectedTemplateId ? 'Template applied. Review the location, dates and pay before creating the job.' : 'Selecting a template replaces the current form. Create a template to save frequently used job details.'}</small>}
        </div>
        <JobForm form={form} setForm={setForm} onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} isEditing={false} saving={saving} workTypes={workTypes} serviceTypes={serviceTypes} />
      </Modal>
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Job" size="lg">
        <JobForm form={form} setForm={setForm} onSubmit={handleEdit} canPublish={jobs.find(job => job._id === editingJobId)?.status === 'draft'} onCancel={() => setShowEditModal(false)} isEditing={true} saving={saving} workTypes={workTypes} serviceTypes={serviceTypes} />
      </Modal>

      {/* ── RESCHEDULE MODAL ─────────────────────────────────────────────────── */}
      <RescheduleModal show={showRescheduleModal} job={rescheduleJob} onClose={() => { setShowRescheduleModal(false); setRescheduleJob(null); }} onReschedule={handleReschedule} rescheduling={rescheduling} />

      {/* ── STATUS UPDATE MODAL ──────────────────────────────────────────────── */}
      <StatusUpdateModal show={statusModal.show} targetStatus={statusModal.targetStatus} job={selectedJob} onClose={() => setStatusModal({ show: false, targetStatus: '' })} onConfirm={handleStatusUpdate} saving={updatingStatus} />

      <Modal show={Boolean(ratingJob)} onClose={() => { if (!ratingSaving) setRatingJob(null); }} title="Rate technician" size="lg">
        <p>{ratingJob?.title} · {ratingJob?.assignedTechnician?.name}</p>
        <TechnicianRatingForm value={feedback} onChange={setFeedback} disabled={ratingSaving} />
        <div className="d-flex gap-2 justify-content-end mt-3">
          <button className="btn tj-btn-ghost" disabled={ratingSaving} onClick={() => setRatingJob(null)}>Cancel</button>
          <button className="btn tj-btn-primary-gold" disabled={ratingSaving || !feedback.score} onClick={saveRating}>{ratingSaving ? 'Saving…' : 'Save Feedback'}</button>
        </div>
      </Modal>

      {/* ── PAY WALLET MODAL ─────────────────────────────────────────────────── */}
      <PayWalletModal show={showPayModal} job={payModalJob} onClose={() => { setShowPayModal(false); setPayModalJob(null); }} onPay={handlePayWallet} paying={paying} />

      {/* ── JOB DETAIL FULL-SCREEN MODAL ─────────────────────────────────────── */}
      {showViewPanel && selectedJob && (
        <div className="tj-fullscreen-overlay">
          <div className="tj-fullscreen-modal" onClick={(e) => e.stopPropagation()}>

            {/* Sticky header */}
            <div className="tj-fullscreen-header">
              <div>
                <div className="tj-view-breadcrumb">Field Operations &rsaquo; Jobs &rsaquo; Job Overview</div>
                <h4 className="tj-fullscreen-title">Job Overview</h4>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button className="tj-btn-outline-sm" onClick={() => { setShowViewPanel(false); openEditModal(selectedJob); }}>
                  <FaEdit className="admin-technician-jobs-42"  />Edit
                </button>
                {canRescheduleJob(selectedJob) && (<button className="tj-btn-outline-sm danger" onClick={() => { setShowViewPanel(false); openRescheduleModal(selectedJob); }}>
                  <FaRedoAlt className="admin-technician-jobs-43"  />Reschedule
                </button>)}
                <button className="tj-modal-close" onClick={() => setShowViewPanel(false)}><FaTimes /></button>
              </div>
            </div>

            {/* Two-column body */}
            <div className="tj-fullscreen-body">

              {/* ── LEFT COLUMN (main content) */}
              <div className="tj-fullscreen-left">
                <div className="tj-view-panel-body">

              {/* Job title hero */}
              <div className="tj-job-overview-hero">
                <div className="tj-job-overview-badges">
                  <span className={`tj-status-pill ${getStatusCls(selectedJob.status)}`}><span className="tj-status-dot" />{getStatusLbl(selectedJob.status)}</span>
                  <span className="tj-urgency-pill normal">Normal</span>
                </div>
                <h4 className="tj-job-overview-title">{selectedJob.title}</h4>
                <div className="tj-job-overview-meta">
                  {selectedJob.jobDate?.from && <span><FaClock className="admin-technician-jobs-44"  />{new Date(selectedJob.jobDate.from).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}, {fmtTime(selectedJob.jobDate.from)}{selectedJob.jobDate.to ? ` - ${fmtTime(selectedJob.jobDate.to)}` : ''}</span>}
                  {selectedJob.location && <span><FaMapMarkerAlt className="admin-technician-jobs-45"  />{selectedJob.city || selectedJob.location}</span>}
                  {selectedJob._id && <span><FaBriefcase className="admin-technician-jobs-46"  />Job ID: {selectedJob._id.toString().slice(-8).toUpperCase()}</span>}
                  {selectedJob.pay && <span className="admin-technician-jobs-47" >$ Est. Earning: {formatPay(selectedJob.pay)}</span>}
                </div>
                <div className="d-flex gap-2 flex-wrap mt-2">
                  <button className="tj-btn-reassign" onClick={() => setJobRequestsModal({ show: true, job: selectedJob })}>
                    <FaBell className="admin-technician-jobs-48"  />View Requests
                  </button>
                  {selectedJob.status === 'draft' && (
                    <button className="tj-btn-primary-gold" disabled={!can('technician_jobs', 'write') || publishing} onClick={() => handlePublishWorkOrder(selectedJob)}>
                      <FaPaperPlane className="me-2" />{publishing ? 'Publishing...' : 'Publish Work Order'}
                    </button>
                  )}
                  {selectedJob.status === 'checkout' && (
                    <button className="tj-btn-pay-sm" onClick={() => openPayModal(selectedJob)}>
                      <FaWallet className="admin-technician-jobs-49"  />Pay Wallet
                    </button>
                  )}
                </div>
              </div>

              {/* Technician card */}
              {selectedJob.assignedTechnician?.name ? (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title"><FaTools className="admin-technician-jobs-50"  />Technician</div>
                  <div className="tj-overview-grid">
                    <div><div className="tj-ov-label">NAME</div><div className="tj-ov-value gold">{selectedJob.assignedTechnician.name}</div></div>
                    <div><div className="tj-ov-label">PHONE</div><div className="tj-ov-value">{selectedJob.assignedTechnician.phone || '—'}</div></div>
                  </div>
                  {selectedJob.status === 'assigned' && <button className="tj-btn-reassign mt-2" disabled={!can('technician_jobs', 'write')} onClick={() => setInvitationJob(selectedJob)}><FaUserCheck className="me-2" />Request Replacement</button>}
                  {['assigned', 'ontheway', 'visited', 'inprogress', 'in-progress'].includes(selectedJob.status) && <button className="tj-btn-reassign mt-2" disabled={!can('technician_jobs', 'write')} onClick={() => setUnassignJob(selectedJob)}><FaExchangeAlt className="me-2" />Unassign Technician</button>}
                </div>
              ) : (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title"><FaTools className="admin-technician-jobs-51"  />Technician</div>
                  <div className="tj-ov-value admin-technician-jobs-52" >No technician assigned yet</div>
                  {selectedJob.status === 'open' && <button className="tj-btn-reassign mt-2" disabled={!can('technician_jobs', 'write')} onClick={() => { setShowViewPanel(false); setInvitationJob(selectedJob); }}><FaUserCheck className="me-2" />Assign Technician</button>}
                </div>
              )}

              {/* Service card */}
              <div className="tj-overview-card">
                <div className="tj-overview-card-title"><FaWrench className="admin-technician-jobs-53"  />Service</div>
                <div className="tj-overview-grid">
                  <div><div className="tj-ov-label">SERVICE</div><div className="tj-ov-value gold">{selectedJob.title}</div></div>
                  {selectedJob.workType?.name && <div><div className="tj-ov-label">CATEGORY</div><div className="tj-ov-value gold">{selectedJob.workType.name}</div></div>}
                  {selectedJob.jobDate?.from && <div><div className="tj-ov-label">APPOINTMENT</div><div className="tj-ov-value">{fmtDT(selectedJob.jobDate.from)}</div></div>}
                </div>
                {selectedJob.description && <div className="tj-ov-desc" dangerouslySetInnerHTML={{ __html: selectedJob.description }} />}
              </div>

              {/* Pricing card */}
              <div className="tj-overview-card">
                <div className="tj-overview-card-title"><FaRupeeSign className="admin-technician-jobs-54"  />Pricing</div>
                <div className="tj-pricing-rows">
                  <div className="tj-pricing-row"><span>Service amount</span><span>{formatPay(selectedJob.pay)}</span></div>
                  {selectedJob.finalPrice > 0 && <div className="tj-pricing-row total"><span>Final amount</span><span className="tj-pricing-total">${Number(selectedJob.finalPrice).toLocaleString()}</span></div>}
                </div>
              </div>

              {/* Live status */}
              <div className="tj-overview-card">
                <div className="tj-overview-card-title">Live status</div>
                <div className="tj-overview-grid">
                  <div><div className="tj-ov-label">CURRENT STATUS</div><span className={`tj-status-pill sm ${getStatusCls(selectedJob.status)}`}><span className="tj-status-dot" />{getStatusLbl(selectedJob.status)}</span></div>
                  <div><div className="tj-ov-label">ASSIGNMENT</div><div className="tj-ov-value">{selectedJob.assignedTechnician?.name ? 'Assigned' : 'Unassigned'}</div></div>
                  <div><div className="tj-ov-label">CREATED</div><div className="tj-ov-value gold">{fmtDT(selectedJob.createdAt)}</div></div>
                </div>
              </div>

              {/* Timeline */}
              {(selectedJob.reachedAt || selectedJob.jobCompletedAt) && (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title"><FaClock className="admin-technician-jobs-55"  />Job Timeline</div>
                  <div className="tj-timeline">
                    {selectedJob.reachedAt && <div className="tj-timeline-row"><span className="tj-timeline-dot reached" /><div><div className="tj-timeline-label">Technician Reached</div><div className="tj-timeline-time">{fmtDT(selectedJob.reachedAt)}</div>{selectedJob.reachedStatus?.siteStatus && <div className="tj-timeline-time">{selectedJob.reachedStatus.siteStatus === 'onsite' ? 'Onsite' : 'Offsite'}</div>}<TimelineDistanceMiles miles={selectedJob.reachedStatus?.distanceMiles} /></div></div>}
                    {selectedJob.jobCompletedAt && <div className="tj-timeline-row"><span className="tj-timeline-dot completed" /><div><div className="tj-timeline-label">Job Completed</div><div className="tj-timeline-time">{fmtDT(selectedJob.jobCompletedAt)}</div>{selectedJob.completedStatus?.siteStatus && <div className="tj-timeline-time">{selectedJob.completedStatus.siteStatus === 'onsite' ? 'Onsite' : 'Offsite'}</div>}<TimelineDistanceMiles miles={selectedJob.completedStatus?.distanceMiles} legacyMeters={selectedJob.completedStatus?.distanceMeters} /></div></div>}
                    {selectedJob.jobDurationMinutes != null && <div className="tj-timeline-row"><span className="tj-timeline-dot duration" /><div><div className="tj-timeline-label">Total Duration</div><div className="tj-timeline-time tj-duration-value">{formatDuration(selectedJob.jobDurationMinutes)}</div></div></div>}
                  </div>
                </div>
              )}

              {/* Live map */}
              {selectedJob.assignedTechnician?.name && ['assigned','ontheway','visited','inprogress'].includes(selectedJob.status) && (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title"><FaMapMarkerAlt className="admin-technician-jobs-56"  />Live Technician Location</div>
                  <TechnicianTrackingMap job={selectedJob} />
                </div>
              )}

              {/* Skills & requirements */}
              {selectedJob.preferredSkills?.length > 0 && <div className="tj-overview-card"><div className="tj-overview-card-title">Preferred Skills</div><div className="tj-tag-list">{selectedJob.preferredSkills.map(s => <span key={s} className="tj-tag">{s}</span>)}</div></div>}
              {selectedJob.requirements?.length > 0 && <div className="tj-overview-card"><div className="tj-overview-card-title">Requirements</div><div className="tj-tag-list">{selectedJob.requirements.map(r => <span key={r} className="tj-tag secondary">{r}</span>)}</div></div>}

              {/* Tasks */}
              {selectedJob.tasks?.length > 0 && (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title"><FaTools className="admin-technician-jobs-57"  />Tasks ({selectedJob.tasks.filter(t => t.isDone).length}/{selectedJob.tasks.length} done)</div>
                  {Array.from(new Set(['Prep', 'On Site', 'Post', ...selectedJob.tasks.map(task => task.group || 'Other')])).map(group => {
                    const groupTasks = selectedJob.tasks.filter(task => (task.group || 'Other') === group);
                    if (!groupTasks.length) return null;
                    return (
                      <div key={group} className="tj-task-group admin-technician-jobs-58" >
                        <div className="tj-task-group-label">{group}</div>
                        {groupTasks.map((task, index) => {
                          const completionImage = task.completionImage ? getImageUrl(task.completionImage) : '';
                          const completionSignature = task.completionSignature ? getImageUrl(task.completionSignature) : '';

                          return (
                            <div key={task._id || `${group}-${index}`}>
                              <div className={`tj-task-row${task.isDone ? ' done' : ''}`}>
                                <span className={`tj-task-circle${task.isDone ? ' checked' : ''}`}>
                                  {task.isDone && <FaCheck className="admin-technician-jobs-59"  />}
                                </span>
                                <span className="tj-task-title">{task.title}</span>
                                {task.isDone && task.checkedAt && <span className="tj-task-meta">{fmtDT(task.checkedAt)}</span>}
                              </div>
                              {task.isDone && (
                                <div className="admin-technician-jobs-60" >
                                {(task.distanceMiles != null || task.distanceMeters != null) && (
                                  <div className={["admin-technician-jobs-61 ", task.completionNote || completionImage || completionSignature ? "admin-technician-jobs-state-11" : "admin-technician-jobs-state-12"].join('')} >
                                    <div className="tj-ov-label">DISTANCE FROM JOB SITE</div>
                                    <div className="admin-technician-jobs-62" >
                                      {formatDistanceMiles(task.distanceMiles, task.distanceMeters)}
                                    </div>
                                  </div>
                                )}
                                {task.completionNote && (
                                  <div className={["admin-technician-jobs-63 ", completionImage || completionSignature ? "admin-technician-jobs-state-13" : "admin-technician-jobs-state-14"].join('')} >
                                      <div className="tj-ov-label">TECHNICIAN NOTE</div>
                                      <div className="admin-technician-jobs-64" >{task.completionNote}</div>
                                    </div>
                                  )}
                                  {(completionImage || completionSignature) ? (
                                    <div className="admin-technician-jobs-65" >
                                      {completionImage && (
                                        <a href={completionImage} target="_blank" rel="noreferrer" aria-label="Open technician completion image">
                                          <img src={completionImage} alt="Technician completion evidence" className="admin-technician-jobs-66"  />
                                          <small className="text-muted">Completion image</small>
                                        </a>
                                      )}
                                      {completionSignature && (
                                        <a href={completionSignature} target="_blank" rel="noreferrer" aria-label="Open technician signature">
                                          <img src={completionSignature} alt="Technician signature" className="admin-technician-jobs-67"  />
                                          <small className="text-muted">Signature</small>
                                        </a>
                                      )}
                                    </div>
                                  ) : !task.completionNote && (
                                    <small className="text-muted">No technician note, image, or signature was submitted for this task.</small>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Update Status */}
              <div className="tj-overview-card">
                <div className="tj-overview-card-title">Update Status</div>
                <div className="tj-status-btn-group">
                  {JOB_STATUS_OPTIONS.map(s => (<button key={s} className={`tj-status-update-btn${selectedJob.status === s ? ' current' : ''}`} onClick={() => setStatusModal({ show: true, targetStatus: s })}>{getStatusLbl(s)}</button>))}
                </div>
              </div>

              {/* Status History */}
              {selectedJob.statusHistory?.length > 0 && (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title"><FaClock className="admin-technician-jobs-68"  />Status History</div>
                  <div className="admin-technician-jobs-69" >
                    {[...selectedJob.statusHistory].reverse().map((h, i) => {

                      return (<div key={i} className={["admin-technician-jobs-70 ", h.status === 'completed' ? "admin-technician-jobs-state-15" : (h.status === 'cancelled' ? "admin-technician-jobs-state-16" : (h.status === 'inprogress' ? "admin-technician-jobs-state-17" : (h.status === 'assigned' ? "admin-technician-jobs-state-18" : "admin-technician-jobs-state-19"))), " ", h.status === 'completed' ? "admin-technician-jobs-state-20" : (h.status === 'cancelled' ? "admin-technician-jobs-state-21" : (h.status === 'inprogress' ? "admin-technician-jobs-state-22" : (h.status === 'assigned' ? "admin-technician-jobs-state-23" : "admin-technician-jobs-state-24")))].join('')} ><span className={["admin-technician-jobs-71 ", h.status === 'completed' ? "admin-technician-jobs-state-25" : (h.status === 'cancelled' ? "admin-technician-jobs-state-26" : (h.status === 'inprogress' ? "admin-technician-jobs-state-27" : (h.status === 'assigned' ? "admin-technician-jobs-state-28" : "admin-technician-jobs-state-29")))].join('')}  /><div className="admin-technician-jobs-72" ><div className="admin-technician-jobs-73" ><span className={["admin-technician-jobs-74 ", h.status === 'completed' ? "admin-technician-jobs-state-30" : (h.status === 'cancelled' ? "admin-technician-jobs-state-31" : (h.status === 'inprogress' ? "admin-technician-jobs-state-32" : (h.status === 'assigned' ? "admin-technician-jobs-state-33" : "admin-technician-jobs-state-34")))].join('')} >{getStatusLbl(h.status)}</span><span className="admin-technician-jobs-75" >{h.changedAt ? fmtDT(h.changedAt) : '—'}</span></div>{h.note ? <div className="admin-technician-jobs-76" >"{h.note}"</div> : <div className="admin-technician-jobs-77" >No note added</div>}</div></div>);
                    })}
                  </div>
                </div>
              )}

              {selectedJob.status === 'completed' && selectedJob.payment?.status === 'paid' && (
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title">Technician rating</div>
                  {selectedJob.technicianRating?.score ? <p>★ {selectedJob.technicianRating.score}/5 — {RATING_LABELS[selectedJob.technicianRating.score - 1]}</p>
                    : <button className="tj-btn-primary-gold" disabled={!can('technician_jobs', 'write')} onClick={() => openRating(selectedJob)}>Rate technician</button>}
                  {selectedJob.privateTechnicianFeedback?.note && <p className="text-muted">Team note: {selectedJob.privateTechnicianFeedback.note.replace(/<[^>]*>/g, ' ').trim()}</p>}
                  {selectedJob.privateTechnicianFeedback?.criteria && <div className="tj-rating-criteria">{RATING_CRITERIA.filter(([key]) => selectedJob.privateTechnicianFeedback.criteria[key]).map(([key, label]) => <div key={key}>{selectedJob.privateTechnicianFeedback.criteria[key] === 'up' ? '👍' : '👎'} {label}</div>)}</div>}
                </div>
              )}

              {/* Admin actions */}
              <div className="tj-admin-actions-card">
                <div className="tj-overview-card-title">Admin actions</div>
                {canRescheduleJob(selectedJob) && (<button className="tj-admin-action-link" onClick={() => { setShowViewPanel(false); openRescheduleModal(selectedJob); }}><FaRedoAlt className="admin-technician-jobs-78"  />Reschedule</button>)}
                <button className="tj-admin-action-link" onClick={() => { setShowViewPanel(false); openEditModal(selectedJob); }}><FaEdit className="admin-technician-jobs-79"  />Edit job</button>
                {selectedJob.status === 'checkout' && <button className="tj-admin-action-link" onClick={() => openPayModal(selectedJob)}><FaWallet className="admin-technician-jobs-80"  />Approve payment</button>}
                <button className="tj-admin-action-link danger" onClick={() => handleDelete(selectedJob._id)}><FaTrash className="admin-technician-jobs-81"  />Cancel job</button>
              </div>

              {/* Quick action buttons */}
              {selectedJob.assignedTechnician?.phone && (
                <div className="tj-view-cta-row">
                  <a className="tj-cta-btn gold" href={`tel:${selectedJob.assignedTechnician.phone}`}><FaUserAlt className="admin-technician-jobs-82"  />Call Technician</a>
                </div>
              )}

                </div>{/* end tj-view-panel-body */}
              </div>{/* end tj-fullscreen-left */}

              {/* ── RIGHT COLUMN (sidebar actions) */}
              <div className="tj-fullscreen-right">

                {/* Admin Actions card */}
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title admin-technician-jobs-83" >⚡ Admin actions</div>
                  <div className="admin-technician-jobs-84" >
                    <button className="tj-admin-action-link" disabled={selectedJob.status !== 'open' || !can('technician_jobs', 'write')} onClick={() => { setShowViewPanel(false); setInvitationJob(selectedJob); }}>
                      <FaUserCheck className="admin-technician-jobs-85"  />Assign technician
                    </button>
                    {selectedJob.assignedTechnician?.name && ['assigned', 'ontheway', 'visited', 'inprogress', 'in-progress'].includes(selectedJob.status) && (
                      <button className="tj-admin-action-link danger" disabled={!can('technician_jobs', 'write')} onClick={() => setUnassignJob(selectedJob)}>
                        <FaExchangeAlt className="admin-technician-jobs-86"  />Unassign technician
                      </button>
                    )}
                    {canRescheduleJob(selectedJob) && (<button className="tj-admin-action-link" onClick={() => { setShowViewPanel(false); openRescheduleModal(selectedJob); }}>
                      <FaCalendarAlt className="admin-technician-jobs-87"  />Reschedule
                    </button>)}
                    <button className="tj-admin-action-link" onClick={() => { setShowViewPanel(false); openEditModal(selectedJob); }}>
                      <FaEdit className="admin-technician-jobs-88"  />Edit job
                    </button>
                    {selectedJob.status === 'checkout' && (
                      <button className="tj-admin-action-link" onClick={() => openPayModal(selectedJob)}>
                        <FaWallet className="admin-technician-jobs-89"  />Approve payment
                      </button>
                    )}
                    <button className="tj-admin-action-link danger" onClick={() => handleDelete(selectedJob._id)}>
                      <FaTrash className="admin-technician-jobs-90"  />Cancel job
                    </button>
                  </div>
                </div>

                {/* Timeline card */}
                <div className="tj-overview-card">
                  <div className="tj-overview-card-title admin-technician-jobs-91" >⏱ Timeline</div>
                  <div className="tj-sidebar-timeline">
                    <div className="tj-stl-row"><span className="tj-stl-dot" /><span className="tj-stl-label">Job created</span>{selectedJob.createdAt && <span className="tj-stl-time">{fmtDT(selectedJob.createdAt)}</span>}</div>
                    {selectedJob.assignedTechnician?.name && (
                      <div className="tj-stl-row"><span className="tj-stl-dot assigned" />
                        <span className="tj-stl-label">Tech <span className="admin-technician-jobs-92" >{selectedJob.assignedTechnician.name}</span> assigned</span>
                      </div>
                    )}
                    {selectedJob.reachedAt && <div className="tj-stl-row"><span className="tj-stl-dot reached" /><span className="tj-stl-label">Arrived</span><span className="tj-stl-time">{fmtDT(selectedJob.reachedAt)}<TimelineDistanceMiles miles={selectedJob.reachedStatus?.distanceMiles} /></span></div>}
                    {selectedJob.jobStartedAt && <div className="tj-stl-row"><span className="tj-stl-dot inprogress" /><span className="tj-stl-label">Service started</span><span className="tj-stl-time">{fmtDT(selectedJob.jobStartedAt)}</span></div>}
                    {selectedJob.jobCompletedAt && <div className="tj-stl-row"><span className="tj-stl-dot completed" /><span className="tj-stl-label">Completed</span><span className="tj-stl-time">{fmtDT(selectedJob.jobCompletedAt)}{selectedJob.completedStatus?.siteStatus && <span> · {selectedJob.completedStatus.siteStatus === 'onsite' ? 'Onsite' : 'Offsite'}</span>}<TimelineDistanceMiles miles={selectedJob.completedStatus?.distanceMiles} legacyMeters={selectedJob.completedStatus?.distanceMeters} /></span></div>}
                    {!selectedJob.reachedAt && !selectedJob.jobCompletedAt && (
                      <>
                        <div className="tj-stl-row muted"><span className="tj-stl-dot muted" /><span className="tj-stl-label">On the Way</span><span className="tj-stl-note">NA</span></div>
                        <div className="tj-stl-row muted"><span className="tj-stl-dot muted" /><span className="tj-stl-label">Service started</span><span className="tj-stl-note">NA</span></div>
                        <div className="tj-stl-row muted"><span className="tj-stl-dot muted" /><span className="tj-stl-label">Completed</span><span className="tj-stl-note">NA</span></div>
                      </>
                    )}
                  </div>
                </div>

                {/* Call buttons */}
                {selectedJob.assignedTechnician?.phone && (
                  <a className="tj-cta-full-btn gold" href={`tel:${selectedJob.assignedTechnician.phone}`}>
                    <FaUserAlt className="admin-technician-jobs-93"  />Call Technician
                  </a>
                )}

              </div>{/* end tj-fullscreen-right */}

            </div>{/* end tj-fullscreen-body */}
          </div>{/* end tj-fullscreen-modal */}
        </div>
      )}

      {/* ── JOB REQUESTS MODAL ──────────────────────────────────────────────── */}
      {jobRequestsModal.show && (
        <div className="tj-modal-backdrop" onClick={() => { setJobRequestsModal({ show: false, job: null }); closeConversation(); }}>
          <div className="tj-modal-box xl" onClick={(e) => e.stopPropagation()}>
            <div className="tj-modal-header">
              <div className="d-flex align-items-center gap-2">
                {activeConvReq && <button className="tj-back-btn" onClick={closeConversation}>&#8592;</button>}
                <div>
                  <h5 className="tj-modal-title mb-0">{activeConvReq ? `Chat with ${activeConvReq.technician?.name || 'Technician'}` : `Requests — ${jobRequestsModal.job?.title || ''}`}</h5>
                  {activeConvReq && <small className="text-muted admin-technician-jobs-94" >{jobRequestsModal.job?.title}</small>}
                </div>
              </div>
              <button className="tj-modal-close" onClick={() => { setJobRequestsModal({ show: false, job: null }); closeConversation(); }}><FaTimes /></button>
            </div>
            <div className="tj-modal-body admin-technician-jobs-95" >
              {!activeConvReq && (() => {
                const jobReqs = requests.filter(r => (r.job?._id || r.job) === jobRequestsModal.job?._id);
                return jobReqs.length === 0 ? (
                  <div className="tj-empty admin-technician-jobs-96" ><FaInbox size={32} className="admin-technician-jobs-97"  /><span>No requests submitted for this job yet.</span></div>
                ) : (
                  <div className="tj-conv-list">
                    {jobReqs.map(req => {
                      const techName = req.technician?.name || 'Technician';
                      return (
                        <div key={req._id} className="tj-conv-row" onClick={() => openConversation(req)}>
                          <div className="tj-tech-avatar admin-technician-jobs-98" >{techName.charAt(0).toUpperCase()}</div>
                          <div className="tj-conv-row-info"><div className="tj-conv-row-name">{techName}</div><div className="tj-conv-row-preview">{req.note ? `"${req.note.length > 60 ? req.note.slice(0,60) + '…' : req.note}"` : req.bidAmount ? `Bid: $${Number(req.bidAmount).toLocaleString()}` : 'No message'}</div></div>
                          <div className="tj-conv-row-meta">
                            <span className={`tj-status-pill sm ${req.status === 'accepted' ? 'status-completed' : req.status === 'rejected' ? 'status-cancelled' : 'status-pending'}`}><span className="tj-status-dot" />{req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending'}</span>
                            <ChargesBadge status={req.chargesStatus} />
                            {req.createdAt && <div className="tj-conv-row-date">{new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>}
                          </div>
                          {(!req.status || req.status === 'pending') && !req.adminMessage && <span className="tj-unread-dot" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {activeConvReq && (() => {
                const req = requests.find(r => r._id === activeConvReq._id) || activeConvReq;
                const techName = req.technician?.name || 'Technician';
                const techPhone = req.technician?.phone || '';
                const isDecided = req.status === 'accepted' || req.status === 'rejected';
                const hasPendingCharges = liveChargesStatus === 'pending' || liveChargesStatus === 'reviewing';
                const waitingForAssignment = req.status === 'accepted' && req.adminApproved && hasPendingCharges && !req.job?.assignedTechnician;
                return (
                  <div className="tj-chat-shell">
                    <div className="tj-chat-info-bar">
                      <div className="tj-tech-avatar admin-technician-jobs-99" >{techName.charAt(0).toUpperCase()}</div>
                      <div><div className="fw-semibold admin-technician-jobs-100" >{techName}</div>{techPhone && <div className="text-muted admin-technician-jobs-101" >{techPhone}</div>}</div>
                      {req.bidAmount && <div className="tj-chat-bid ms-auto"><span className="tj-chat-bid-label">Bid</span><span className="tj-chat-bid-value">${Number(req.bidAmount).toLocaleString()}</span></div>}
                      {liveChargesStatus !== 'none' && <div className="ms-auto"><ChargesBadge status={liveChargesStatus} /></div>}
                      {waitingForAssignment && <span className="ms-auto text-warning small fw-semibold">Approved — waiting for charge resolution</span>}
                    </div>
                    {req.status === 'accepted' && (
                      <div className="tj-charges-tabs">
                        <button className={`tj-charges-tab${convTab === 'chat' ? ' active' : ''}`} onClick={() => setConvTab('chat')}>💬 Chat</button>
                        <button className={`tj-charges-tab${convTab === 'charges' ? ' active' : ''}`} onClick={() => setConvTab('charges')}><FaReceipt className="admin-technician-jobs-102"  />Charges{hasPendingCharges && <span className="tj-tab-dot" />}</button>
                        <button className={`tj-charges-tab${convTab === 'invoice' ? ' active' : ''}`} onClick={() => setConvTab('invoice')}><FaFileInvoiceDollar className="admin-technician-jobs-103"  />Invoice{liveChargesStatus === 'invoiced' && <FaCheckCircle className="admin-technician-jobs-104"  />}</button>
                      </div>
                    )}
                    {convTab === 'chat' && (
                      <>
                        {hasPendingCharges && <div className="tj-charges-alert"><FaReceipt />{waitingForAssignment ? 'Request approved; resolve all charges before assignment.' : 'Technician has submitted additional charges awaiting your review.'}<button className="btn btn-sm ms-auto admin-technician-jobs-105"  onClick={() => setConvTab('charges')}>Review Charges →</button></div>}
                        <div className="tj-chat-messages" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                          <div className="tj-chat-row tech">
                            <div className="tj-tech-avatar admin-technician-jobs-106" >{techName.charAt(0).toUpperCase()}</div>
                            <div className="tj-bubble tech">{req.note ? <p className="mb-0">{req.note}</p> : <p className="mb-0 fst-italic text-muted admin-technician-jobs-107" >No message yet.</p>}{req.bidAmount && <div className="tj-bubble-meta">Bid: <strong>${Number(req.bidAmount).toLocaleString()}</strong></div>}{req.createdAt && <div className="tj-bubble-time">{fmtDT(req.createdAt)}</div>}</div>
                          </div>
                          {liveConversation.map((msg, i) => msg.sender === 'admin' ? (
                            <div key={i} className="tj-chat-row admin"><div className={`tj-bubble ${msg.counterOffer > 0 ? 'counter' : 'admin'}`}><p className="mb-0">{msg.message}</p>{msg.counterOffer > 0 && <div className="tj-bubble-meta">Counter offer: <strong>${Number(msg.counterOffer).toLocaleString()}</strong></div>}{msg.createdAt && <div className="tj-bubble-time admin-technician-jobs-108" >{fmtDT(msg.createdAt)}</div>}</div><div className="tj-admin-avatar" title="Admin">A</div></div>
                          ) : (
                            <div key={i} className="tj-chat-row tech"><div className="tj-tech-avatar admin-technician-jobs-109" >{techName.charAt(0).toUpperCase()}</div><div className="tj-bubble tech"><p className="mb-0">{msg.message}</p>{msg.createdAt && <div className="tj-bubble-time">{fmtDT(msg.createdAt)}</div>}</div></div>
                          ))}
                          {isDecided && <div className="tj-chat-decision-bar"><span className={[`badge ${req.status === 'accepted' ? 'text-bg-success' : 'text-bg-danger'}`, " admin-technician-jobs-110"].join('')} >{req.status === 'accepted' ? (waitingForAssignment ? '✓ Approved — assignment pending charges' : '✓ Job Assigned') : '✕ Request Rejected'}</span></div>}
                        </div>
                        <div className="tj-chat-footer">
                          {!isDecided ? (
                            <>
                              <div className="tj-chat-input-row">
                                <textarea className="tj-chat-reply-input" rows={2} placeholder="Type a message to the technician…" value={adminReply} onChange={(e) => setAdminReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(req._id); } }} />
                                <button className="tj-send-btn" disabled={!adminReply.trim() || sending} onClick={() => handleSendMessage(req._id)}>{sending ? <span className="spinner-border spinner-border-sm" /> : <FaPaperPlane />}</button>
                              </div>
                              <div className="tj-chat-action-row">
                                {req.initiatedBy === 'admin' && <span className="text-muted">Waiting for the invited technician to accept or reject.</span>}
                                <button className="tj-chat-btn accept" disabled={decidingId === req._id || req.initiatedBy === 'admin'} onClick={() => handleDecision(req._id, 'accepted')}>{decidingId === req._id ? <span className="spinner-border spinner-border-sm me-1" /> : '✓ '}Accept Request</button>
                                <input type="number" min="1" placeholder="Counter amount" value={adminCounterAmount} onChange={e => setAdminCounterAmount(e.target.value)} className="admin-technician-jobs-111"  disabled={req.initiatedBy === 'admin'} />
                                <button className="tj-chat-btn" disabled={decidingId === req._id || req.initiatedBy === 'admin'} onClick={() => handleCounter(req._id)}>↔ Counter</button>
                                <button className="tj-chat-btn reject" disabled={decidingId === req._id || req.initiatedBy === 'admin'} onClick={() => handleDecision(req._id, 'rejected')}>{decidingId === req._id ? <span className="spinner-border spinner-border-sm me-1" /> : '✕ '}Reject Request</button>
                              </div>
                            </>
                          ) : <div className="tj-chat-decided-note">This request has already been <strong>{req.status}</strong>. No further action needed.</div>}
                        </div>
                      </>
                    )}
                    {convTab === 'charges' && <div className="admin-technician-jobs-112" ><ChargesPanel requestId={req._id} onChargesUpdated={loadData} /></div>}
                    {convTab === 'invoice' && <div className="admin-technician-jobs-113" ><InvoicePanel requestId={req._id} request={req} onInvoiceAction={() => { setLiveChargesStatus('invoiced'); loadData(); }} /></div>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TechnicianJobs;
