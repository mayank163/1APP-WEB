import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
import { JOB_STATUS_OPTIONS, getJobStatusLabel, getJobStatusTone } from '../utils/jobStatus';
import '../styles/TechnicianJobs.css';
import {
  FaPlus, FaEdit, FaTrash, FaEye, FaSearch, FaTimes,
  FaHardHat, FaMapMarkerAlt, FaRupeeSign, FaCalendarAlt,
  FaTools, FaUserCheck, FaInbox, FaBell, FaPaperPlane,
  FaClock, FaCheckCircle, FaWallet, FaRedoAlt,
  FaFileInvoiceDollar, FaReceipt, FaMoneyCheckAlt,
  FaCheck, FaBan, FaExchangeAlt,
} from 'react-icons/fa';

const emptyForm = {
  title: '',
  category: 'General Service',
  location: '',
  budget: '',
  description: '',
  preferredSkills: '',
  requirements: '',
  serviceDate: '',
  estimatedTime: '',
};

// ─── Helper: format duration ───────────────────────────────────────────────────
const formatDuration = (minutes) => {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

// ─── Helper: format datetime ───────────────────────────────────────────────────
const fmtDT = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ─── Helper: charges status badge ─────────────────────────────────────────────
const ChargesBadge = ({ status }) => {
  if (!status || status === 'none') return null;
  const labels = {
    pending:   'Charges Pending',
    reviewing: 'Under Review',
    agreed:    'Charges Agreed',
    invoiced:  'Invoiced',
  };
  return (
    <span className={`tj-charges-badge ${status}`}>
      <FaFileInvoiceDollar />
      {labels[status] || status}
    </span>
  );
};

// ─── ChargesPanel — admin reviews individual charge items ─────────────────────
const ChargesPanel = ({ requestId, onChargesUpdated }) => {
  const [charges, setCharges]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [actingId, setActingId]             = useState(null);
  const [counterOpen, setCounterOpen]       = useState({});   // chargeId → bool
  const [counterAmounts, setCounterAmounts] = useState({});   // chargeId → string
  const [counterNotes, setCounterNotes]     = useState({});   // chargeId → string

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getJobCharges(requestId);
      setCharges(res.data?.charges || []);
    } catch {
      toast.error('Failed to load charges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [requestId]); // eslint-disable-line

  const review = async (chargeId, action, extra = {}) => {
    setActingId(chargeId);
    try {
      await adminApi.reviewCharge(chargeId, { action, ...extra });
      toast.success(
        action === 'accept' ? 'Charge accepted' :
        action === 'reject' ? 'Charge rejected' :
        'Counter-offer sent to technician'
      );
      setCounterOpen((p) => ({ ...p, [chargeId]: false }));
      await load();
      onChargesUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActingId(null); }
  };

  if (loading) return (
    <div className="tj-loading" style={{ padding: '2rem' }}>
      <div className="spinner-border spinner-border-sm" style={{ color: '#A5732F' }} />
      <span>Loading charges…</span>
    </div>
  );

  if (!charges.length) return (
    <div className="tj-charges-empty">
      <FaReceipt size={28} style={{ color: '#d1d5db' }} />
      <span>No additional charges submitted yet</span>
    </div>
  );

  return (
    <div className="tj-charges-list">
      {charges.map((c) => {
        const isPending   = c.status === 'pending';
        const isCountered = c.status === 'countered';
        const isResolved  = ['accepted', 'rejected'].includes(c.status);
        const showCounter = counterOpen[c._id];
        const busy        = actingId === c._id;

        return (
          <div key={c._id} className="tj-charge-card">
            {/* header */}
            <div className="tj-charge-header">
              <span className="tj-charge-label">{c.label}</span>
              <span className="tj-charge-amount">${Number(c.requestedAmount).toLocaleString()}</span>
            </div>

            {/* description */}
            {c.description && <div className="tj-charge-desc">{c.description}</div>}

            {/* status row */}
            <div className="tj-charge-status-row">
              <span className={`tj-charge-status ${c.status}`}>
                {c.status === 'pending'   && '⏳ Pending Review'}
                {c.status === 'accepted'  && '✓ Accepted'}
                {c.status === 'rejected'  && '✕ Rejected'}
                {c.status === 'countered' && '↔ Counter Sent'}
              </span>
              {c.status === 'accepted' && c.agreedAmount != null && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
                  Agreed: ${Number(c.agreedAmount).toLocaleString()}
                </span>
              )}
            </div>

            {/* counter info */}
            {isCountered && c.adminCounterAmount > 0 && (
              <div className="tj-charge-counter-info">
                Your counter: ${Number(c.adminCounterAmount).toLocaleString()}
                {c.adminNote && ` — "${c.adminNote}"`}
              </div>
            )}

            {/* admin note on resolved */}
            {isResolved && c.adminNote && (
              <div className="tj-charge-admin-note">Admin note: {c.adminNote}</div>
            )}

            {/* action buttons for pending / countered */}
            {(isPending || isCountered) && !showCounter && (
              <div className="tj-charge-actions">
                <button
                  className="tj-charge-btn accept"
                  disabled={busy}
                  onClick={() => review(c._id, 'accept')}
                >
                  {busy ? <span className="spinner-border spinner-border-sm" /> : <FaCheck />}
                  Accept ${Number(c.requestedAmount).toLocaleString()}
                </button>
                <button
                  className="tj-charge-btn counter"
                  disabled={busy}
                  onClick={() => setCounterOpen((p) => ({ ...p, [c._id]: true }))}
                >
                  <FaExchangeAlt /> Counter
                </button>
                <button
                  className="tj-charge-btn reject"
                  disabled={busy}
                  onClick={() => review(c._id, 'reject')}
                >
                  <FaBan /> Reject
                </button>
              </div>
            )}

            {/* inline counter form */}
            {showCounter && (
              <div className="tj-counter-inline">
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb' }}>
                  Counter-offer for "{c.label}"
                </div>
                <div className="tj-counter-inline-row">
                  <input
                    type="number"
                    min="1"
                    className="tj-counter-inline-input"
                    placeholder="Counter amount $"
                    value={counterAmounts[c._id] || ''}
                    onChange={(e) => setCounterAmounts((p) => ({ ...p, [c._id]: e.target.value }))}
                  />
                  <button
                    className="tj-counter-inline-send"
                    disabled={busy || !counterAmounts[c._id] || Number(counterAmounts[c._id]) <= 0}
                    onClick={() => review(c._id, 'counter', {
                      counterAmount: Number(counterAmounts[c._id]),
                      adminNote: counterNotes[c._id] || '',
                    })}
                  >
                    {busy ? <span className="spinner-border spinner-border-sm" /> : 'Send'}
                  </button>
                  <button
                    className="tj-counter-inline-cancel"
                    onClick={() => setCounterOpen((p) => ({ ...p, [c._id]: false }))}
                  >
                    Cancel
                  </button>
                </div>
                <textarea
                  className="tj-counter-note-input"
                  rows={2}
                  placeholder="Optional note to technician…"
                  value={counterNotes[c._id] || ''}
                  onChange={(e) => setCounterNotes((p) => ({ ...p, [c._id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── InvoicePanel — view + generate + pay invoice ─────────────────────────────
const InvoicePanel = ({ requestId, request, onInvoiceAction }) => {
  const [invoice, setInvoice]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying]       = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getInvoice(requestId);
      setInvoice(res.data?.invoice || null);
    } catch (err) {
      if (err.response?.status !== 404) toast.error('Failed to load invoice');
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [requestId]); // eslint-disable-line

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await adminApi.generateInvoice(requestId, { adminNotes });
      toast.success(res.message || 'Invoice generated!');
      setInvoice(res.data?.invoice || null);
      onInvoiceAction?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  const markPaid = async () => {
    if (!window.confirm('Mark this invoice as paid and credit the technician wallet?')) return;
    setPaying(true);
    try {
      const res = await adminApi.markInvoicePaid(requestId);
      toast.success(res.message || 'Paid!');
      await load();
      onInvoiceAction?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="tj-loading" style={{ padding: '2rem' }}>
      <div className="spinner-border spinner-border-sm" style={{ color: '#A5732F' }} />
      <span>Loading invoice…</span>
    </div>
  );

  // ── Can generate? (all charges resolved, request accepted, not yet invoiced)
  const canGenerate = request?.status === 'accepted' &&
    ['agreed', 'none'].includes(request?.chargesStatus) &&
    !invoice;

  if (!invoice) return (
    <div className="tj-invoice-wrap">
      <div className="tj-charges-empty">
        <FaFileInvoiceDollar size={32} style={{ color: '#d1d5db' }} />
        <span>No invoice yet</span>
        {request?.chargesStatus === 'pending' && (
          <div className="tj-charges-alert" style={{ marginTop: '0.5rem' }}>
            <FaReceipt />
            Pending charges must be reviewed before generating invoice
          </div>
        )}
      </div>
      {canGenerate && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <label className="tj-label">Admin Notes (optional)</label>
          <textarea
            className="form-control tj-input"
            rows={2}
            placeholder="Notes for this invoice…"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
          <button
            className="tj-btn-invoice"
            disabled={generating}
            onClick={generate}
          >
            {generating
              ? <><span className="spinner-border spinner-border-sm" /> Generating…</>
              : <><FaFileInvoiceDollar /> Generate Final Invoice</>
            }
          </button>
        </div>
      )}
    </div>
  );

  // ── Show invoice ───────────────────────────────────────────────────────────
  return (
    <div className="tj-invoice-wrap">

      <div className="tj-invoice-header">
        <div>
          <div className="tj-invoice-number">{invoice.invoiceNumber}</div>
          <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: 2 }}>
            Generated {fmtDT(invoice.createdAt)}
          </div>
        </div>
        <span className={`tj-invoice-status ${invoice.status}`}>
          {invoice.status === 'draft'     && '⬜ Draft'}
          {invoice.status === 'finalised' && '✓ Finalised'}
          {invoice.status === 'paid'      && '💰 Paid'}
        </span>
      </div>

      {/* line items */}
      <table className="tj-invoice-table">
        <thead>
          <tr>
            <th style={{ width: '50%' }}>Description</th>
            <th>Requested</th>
            <th>Agreed</th>
          </tr>
        </thead>
        <tbody>
          {/* fixed charge */}
          <tr>
            <td>
              <div className="tj-inv-label">{invoice.fixedJobLabel || 'Fixed Job Charge'}</div>
            </td>
            <td className="tj-inv-amount">${Number(invoice.fixedJobCharge).toLocaleString()}</td>
            <td className="tj-inv-amount">${Number(invoice.fixedJobCharge).toLocaleString()}</td>
          </tr>
          {/* additional charges */}
          {invoice.additionalCharges?.map((c, i) => (
            <tr key={i}>
              <td>
                <div className="tj-inv-label">{c.label}</div>
                {c.description && <div className="tj-inv-desc">{c.description}</div>}
              </td>
              <td className="tj-inv-amount">${Number(c.requestedAmount).toLocaleString()}</td>
              <td className="tj-inv-amount">${Number(c.agreedAmount).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="tj-invoice-totals">
        <div className="tj-invoice-row">
          <span>Fixed Charge</span>
          <span>${Number(invoice.fixedJobCharge).toLocaleString()}</span>
        </div>
        {invoice.subtotalAdditional > 0 && (
          <div className="tj-invoice-row">
            <span>Additional Charges</span>
            <span>${Number(invoice.subtotalAdditional).toLocaleString()}</span>
          </div>
        )}
        <div className="tj-invoice-row total">
          <span>Total</span>
          <span className="tj-inv-total-val">${Number(invoice.totalAmount).toLocaleString()}</span>
        </div>
      </div>

      {/* admin notes */}
      {invoice.adminNotes && (
        <div className="tj-charge-admin-note">Notes: {invoice.adminNotes}</div>
      )}

      {/* paid at */}
      {invoice.paidAt && (
        <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
          <FaCheckCircle style={{ marginRight: 4 }} />
          Paid on {fmtDT(invoice.paidAt)}
        </div>
      )}

      {/* mark paid */}
      {invoice.status === 'finalised' && (
        <button
          className="tj-btn-mark-paid"
          disabled={paying}
          onClick={markPaid}
        >
          {paying
            ? <><span className="spinner-border spinner-border-sm" /> Processing…</>
            : <><FaWallet /> Mark as Paid & Credit Technician Wallet</>
          }
        </button>
      )}
    </div>
  );
};


// ─── Reusable Modal wrapper ────────────────────────────────────────────────────
const Modal = ({ show, onClose, title, children, size = '' }) => {
  if (!show) return null;
  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div className={`tj-modal-box ${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header">
          <h5 className="tj-modal-title">{title}</h5>
          <button className="tj-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="tj-modal-body">{children}</div>
      </div>
    </div>
  );
};

// ─── Reschedule Modal ─────────────────────────────────────────────────────────
const RescheduleModal = ({ show, job, onClose, onReschedule, rescheduling }) => {
  const [scheduledDate, setScheduledDate] = useState('');
  const [reason, setReason] = useState('');
  if (!show) return null;
  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div className="tj-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header">
          <h5 className="tj-modal-title">
            <FaRedoAlt className="me-2" style={{ color: '#A5732F' }} />
            Reschedule Job
          </h5>
          <button className="tj-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="tj-modal-body">
          <p className="text-muted small mb-3">Job: <strong>{job?.title}</strong></p>
          {job?.scheduledDate && (
            <p className="text-muted small mb-3">
              Current date: <strong>{new Date(job.scheduledDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
            </p>
          )}
          <label className="tj-label">New Scheduled Date <span className="text-danger">*</span></label>
          <input
            className="form-control tj-input mb-3"
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
          <label className="tj-label">Reason (optional)</label>
          <textarea
            className="form-control tj-input mb-3"
            rows={2}
            placeholder="Reason for rescheduling…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn tj-btn-ghost" onClick={onClose} disabled={rescheduling}>Cancel</button>
            <button
              className="btn tj-btn-primary"
              disabled={rescheduling || !scheduledDate}
              onClick={() => onReschedule(job._id, scheduledDate, reason)}
            >
              {rescheduling
                ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
                : <><FaRedoAlt className="me-2" />Reschedule</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Pay Wallet Modal ──────────────────────────────────────────────────────────
const PayWalletModal = ({ show, job, onClose, onPay, paying }) => {
  const [price, setPrice] = useState('');
  const [note, setNote]   = useState('');
  if (!show) return null;
  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div className="tj-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="tj-modal-header">
          <h5 className="tj-modal-title">
            <FaWallet className="me-2" style={{ color: '#16a34a' }} />
            Pay Technician Wallet
          </h5>
          <button className="tj-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="tj-modal-body">
          <p className="text-muted small mb-3">
            Job: <strong>{job?.title}</strong> &nbsp;|&nbsp;
            Tech: <strong>{job?.assignedTechnician?.name || '—'}</strong>
          </p>
          {job?.jobDurationMinutes != null && (
            <div className="tj-pay-info-row mb-3">
              <FaClock style={{ color: '#A5732F' }} />
              <span>Job duration: <strong>{formatDuration(job.jobDurationMinutes)}</strong></span>
            </div>
          )}
          <label className="tj-label">Final Price ($) <span className="text-danger">*</span></label>
          <div className="tj-counter-input-wrap mb-3">
            <span className="tj-counter-prefix">$</span>
            <input
              className="tj-counter-input"
              type="number" min="1"
              placeholder="Enter amount"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <label className="tj-label">Note (optional)</label>
          <textarea
            className="form-control tj-input mb-3"
            rows={2}
            placeholder="Payment note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn tj-btn-ghost" onClick={onClose} disabled={paying}>Cancel</button>
            <button
              className="btn tj-btn-pay"
              disabled={paying || !price || Number(price) <= 0}
              onClick={() => onPay(job._id, Number(price), note)}
            >
              {paying
                ? <><span className="spinner-border spinner-border-sm me-2" />Processing…</>
                : <><FaWallet className="me-2" />Credit to Wallet</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Job Form (shared by Add + Edit) ──────────────────────────────────────────
const JobForm = ({ form, setForm, onSubmit, onCancel, isEditing, saving }) => (
  <form onSubmit={onSubmit} className="row g-3">
    <div className="col-12">
      <label className="tj-label">Job Title <span className="text-danger">*</span></label>
      <input className="form-control tj-input" value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="e.g. AC Service Repair" required />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Category</label>
      <input className="form-control tj-input" value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        placeholder="General Service" />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Budget ($) <span className="text-danger">*</span></label>
      <input className="form-control tj-input" type="number" min="0" value={form.budget}
        onChange={(e) => setForm({ ...form, budget: e.target.value })}
        placeholder="1500" required />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Location <span className="text-danger">*</span></label>
      <input className="form-control tj-input" value={form.location}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
        placeholder="Los Angeles" required />
    </div>
    <div className="col-md-6">
      <label className="tj-label">
        <FaClock className="me-1" style={{ color: '#A5732F' }} />
        Estimated Time
      </label>
      <input className="form-control tj-input" value={form.estimatedTime}
        onChange={(e) => setForm({ ...form, estimatedTime: e.target.value })}
        placeholder="e.g. 2-3 hours, 45 min" />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Service Date</label>
      <input className="form-control tj-input" type="datetime-local" value={form.serviceDate}
        onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
    </div>
    <div className="col-12">
      <label className="tj-label">Description <span className="text-danger">*</span></label>
      <textarea className="form-control tj-input" rows={3} value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Describe the work required…" required />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Preferred Skills</label>
      <input className="form-control tj-input" value={form.preferredSkills}
        onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })}
        placeholder="AC, electrical, repair (comma separated)" />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Requirements</label>
      <input className="form-control tj-input" value={form.requirements}
        onChange={(e) => setForm({ ...form, requirements: e.target.value })}
        placeholder="Tools, safety gear (comma separated)" />
    </div>
    <div className="col-12 d-flex justify-content-end gap-2 pt-2">
      <button type="button" className="btn tj-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
      <button type="submit" className="btn tj-btn-primary" disabled={saving}>
        {saving
          ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
          : isEditing ? 'Update Job' : 'Create Job'}
      </button>
    </div>
  </form>
);


// ─── Main Page ─────────────────────────────────────────────────────────────────
const TechnicianJobs = () => {
  const [jobs, setJobs]         = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [paying, setPaying]           = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleJob, setRescheduleJob]             = useState(null);

  const [activeTab, setActiveTab]   = useState('all');
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFilter, setDateFilter]     = useState('all'); // 'all' | 'today' | 'tomorrow' | 'custom'
  const [customDate, setCustomDate]     = useState('');    // 'YYYY-MM-DD'

  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [showPayModal, setShowPayModal]   = useState(false);
  const [payModalJob, setPayModalJob]     = useState(null);

  const [jobRequestsModal, setJobRequestsModal] = useState({ show: false, job: null });
  const [activeConvReq, setActiveConvReq]       = useState(null);
  const [adminReply, setAdminReply]             = useState('');
  const [decidingId, setDecidingId]             = useState(null);
  const [sending, setSending]                   = useState(false);
  const [liveConversation, setLiveConversation] = useState([]);
  const activeReqIdRef = useRef(null);

  // ── Charges / Invoice panel tab ('chat' | 'charges' | 'invoice') ───────────
  const [convTab, setConvTab] = useState('chat');
  // Live-updated chargesStatus for the open conversation request
  const [liveChargesStatus, setLiveChargesStatus] = useState('none');

  const [form, setForm]                 = useState(emptyForm);
  const [editingJobId, setEditingJobId] = useState(null);
  const [selectedJob, setSelectedJob]   = useState(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsRes, reqRes] = await Promise.all([
        adminApi.getTechnicianJobs(),
        adminApi.getTechnicianRequests(),
      ]);
      setJobs(jobsRes.data?.jobs || []);
      setRequests(reqRes.data?.requests || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMsg = ({ requestId, message }) => {
      console.log('[Socket] ← request:message', { requestId, message });
      if (activeReqIdRef.current !== requestId) return;
      setLiveConversation((prev) => [...prev, message]);
    };
    const handleStatus = ({ requestId, status }) => {
      console.log('[Socket] ← request:status', { requestId, status });
      if (activeReqIdRef.current !== requestId) return;
      setRequests((prev) => prev.map((r) => r._id === requestId ? { ...r, status } : r));
    };
    const handleJobCreated = ({ job }) => {
      console.log('[Socket] ← job:created', { jobId: job._id, title: job.title });
      setJobs((prev) => [job, ...prev]);
    };
    const handleJobUpdated = ({ job }) => {
      console.log('[Socket] ← job:updated', { jobId: job._id, status: job.status });
      setJobs((prev) => prev.map((j) => j._id === job._id ? job : j));
      setSelectedJob((prev) => prev?._id === job._id ? job : prev);
    };
    const handleJobDeleted = ({ jobId }) => {
      console.log('[Socket] ← job:deleted', { jobId });
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
      setSelectedJob((prev) => prev?._id === jobId ? null : prev);
      setShowViewPanel((prev) => prev && selectedJob?._id === jobId ? false : prev);
    };
    const handleRequestUpdated = ({ request }) => {
      console.log('[Socket] ← request:updated', { requestId: request._id, status: request.status });
      setRequests((prev) => prev.map((r) => r._id === request._id ? request : r));
    };
    // charges & invoice real-time events
    const handleChargesSubmitted = ({ requestId }) => {
      console.log('[Socket] ← charges:submitted', { requestId });
      if (activeReqIdRef.current === requestId) setLiveChargesStatus('pending');
      setRequests((prev) => prev.map((r) =>
        r._id === requestId ? { ...r, chargesStatus: 'pending' } : r
      ));
      loadData();
    };
    const handleChargeReviewed = ({ requestId, requestChargesStatus }) => {
      console.log('[Socket] ← charge:reviewed', { requestId, requestChargesStatus });
      if (activeReqIdRef.current === requestId && requestChargesStatus) {
        setLiveChargesStatus(requestChargesStatus);
      }
      loadData();
    };
    const handleInvoiceGenerated = ({ requestId }) => {
      console.log('[Socket] ← invoice:generated', { requestId });
      if (activeReqIdRef.current === requestId) setLiveChargesStatus('invoiced');
      loadData();
    };
    const handleInvoicePaid = ({ requestId, amount }) => {
      console.log('[Socket] ← invoice:paid', { requestId, amount });
      loadData();
    };

    socket.on('request:message',     handleMsg);
    socket.on('request:status',      handleStatus);
    socket.on('job:created',         handleJobCreated);
    socket.on('job:updated',         handleJobUpdated);
    socket.on('job:deleted',         handleJobDeleted);
    socket.on('request:updated',     handleRequestUpdated);
    socket.on('charges:submitted',   handleChargesSubmitted);
    socket.on('charge:reviewed',     handleChargeReviewed);
    socket.on('invoice:generated',   handleInvoiceGenerated);
    socket.on('invoice:paid',        handleInvoicePaid);
    return () => {
      socket.off('request:message',   handleMsg);
      socket.off('request:status',    handleStatus);
      socket.off('job:created',       handleJobCreated);
      socket.off('job:updated',       handleJobUpdated);
      socket.off('job:deleted',       handleJobDeleted);
      socket.off('request:updated',   handleRequestUpdated);
      socket.off('charges:submitted', handleChargesSubmitted);
      socket.off('charge:reviewed',   handleChargeReviewed);
      socket.off('invoice:generated', handleInvoiceGenerated);
      socket.off('invoice:paid',      handleInvoicePaid);
    };
  }, [selectedJob]);

  const [socketConnected, setSocketConnected] = useState(socket.connected);
  useEffect(() => {
    const onConn = () => setSocketConnected(true);
    const onDisc = () => setSocketConnected(false);
    socket.on('connect', onConn);
    socket.on('disconnect', onDisc);
    return () => { socket.off('connect', onConn); socket.off('disconnect', onDisc); };
  }, []);


  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     jobs.length,
    open:      jobs.filter((j) => j.status === 'open').length,
    assigned:  jobs.filter((j) => j.status === 'assigned').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  }), [jobs]);

  const filteredJobs = useMemo(() => {
    const toLocalDay = (dt) => {
      if (!dt) return null;
      const d = new Date(dt);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const todayStr    = toLocalDay(new Date());
    const tomorrowStr = toLocalDay(new Date(Date.now() + 86400000));

    return jobs.filter((job) => {
      const tabOk  = activeTab === 'all' || activeTab === 'requests' || job.status === activeTab;
      const dropOk = filterStatus === 'all' || job.status === filterStatus;
      const srcOk  = !search ||
        [job.title, job.category, job.location, job.description].join(' ')
          .toLowerCase().includes(search.toLowerCase());

      let dateOk = true;
      if (dateFilter !== 'all') {
        const jobDay = toLocalDay(job.serviceDate);
        if (!jobDay) {
          dateOk = false;
        } else if (dateFilter === 'today') {
          dateOk = jobDay === todayStr;
        } else if (dateFilter === 'tomorrow') {
          dateOk = jobDay === tomorrowStr;
        } else if (dateFilter === 'custom') {
          dateOk = customDate ? jobDay === customDate : true;
        }
      }

      return tabOk && dropOk && srcOk && dateOk;
    });
  }, [jobs, activeTab, filterStatus, search, dateFilter, customDate]);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const buildPayload = (f) => ({
    ...f,
    budget:          Number(f.budget || 0),
    preferredSkills: f.preferredSkills.split(',').map((s) => s.trim()).filter(Boolean),
    requirements:    f.requirements.split(',').map((s) => s.trim()).filter(Boolean),
    serviceDate:     f.serviceDate || undefined,
    estimatedTime:   f.estimatedTime || '',
  });

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await adminApi.createTechnicianJob(buildPayload(form));
      toast.success('Job created!');
      setShowAddModal(false); setForm(emptyForm); await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create job');
    } finally { setSaving(false); }
  };

  const openEditModal = (job) => {
    setEditingJobId(job._id);
    setForm({
      title:           job.title || '',
      category:        job.category || 'General Service',
      location:        job.location || '',
      budget:          job.budget || '',
      description:     job.description || '',
      preferredSkills: (job.preferredSkills || []).join(', '),
      requirements:    (job.requirements || []).join(', '),
      serviceDate:     job.serviceDate ? new Date(job.serviceDate).toISOString().slice(0, 16) : '',
      estimatedTime:   job.estimatedTime || '',
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await adminApi.updateTechnicianJob(editingJobId, buildPayload(form));
      toast.success('Job updated!');
      setShowEditModal(false); setForm(emptyForm); setEditingJobId(null); await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update job');
    } finally { setSaving(false); }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    try {
      await adminApi.deleteTechnicianJob(jobId);
      toast.success('Job deleted');
      if (selectedJob?._id === jobId) setShowViewPanel(false);
      await loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const openViewPanel = (job) => { setSelectedJob(job); setShowViewPanel(true); };

  // ── Reschedule ──────────────────────────────────────────────────────────────
  const openRescheduleModal = (job) => { setRescheduleJob(job); setShowRescheduleModal(true); };

  const handleReschedule = async (jobId, scheduledDate, reason) => {
    setRescheduling(true);
    try {
      await adminApi.rescheduleJob(jobId, { scheduledDate, reason });
      toast.success('Job rescheduled successfully!');
      setShowRescheduleModal(false); setRescheduleJob(null);
      await loadData();
      if (selectedJob?._id === jobId) {
        setSelectedJob((prev) => prev ? { ...prev, scheduledDate } : prev);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reschedule failed');
    } finally { setRescheduling(false); }
  };

  // ── Pay wallet ──────────────────────────────────────────────────────────────
  const openPayModal = (job) => { setPayModalJob(job); setShowPayModal(true); };

  const handlePayWallet = async (jobId, finalPrice, note) => {
    setPaying(true);
    try {
      await adminApi.payTechnicianWallet(jobId, { finalPrice, note });
      toast.success(`$${finalPrice} credited to technician wallet!`);
      setShowPayModal(false); setPayModalJob(null);
      await loadData();
      // Sync selected job if view panel is open
      if (selectedJob?._id === jobId) {
        setSelectedJob((prev) => prev ? { ...prev, finalPrice } : prev);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally { setPaying(false); }
  };


  // ── Socket room helpers ─────────────────────────────────────────────────────
  const openConversation = (req) => {
    setActiveConvReq(req); setAdminReply('');
    setLiveConversation(req.conversation || []);
    setConvTab('chat');
    setLiveChargesStatus(req.chargesStatus || 'none');
    activeReqIdRef.current = req._id;
    console.log('[Socket] → request:join', req._id);
    socket.emit('request:join', req._id);
  };

  const closeConversation = () => {
    if (activeReqIdRef.current) {
      console.log('[Socket] → request:leave', activeReqIdRef.current);
      socket.emit('request:leave', activeReqIdRef.current);
      activeReqIdRef.current = null;
    }
    setActiveConvReq(null); setAdminReply(''); setLiveConversation([]);
    setConvTab('chat'); setLiveChargesStatus('none');
  };

  const handleDecision = async (requestId, status) => {
    setDecidingId(requestId);
    try {
      await adminApi.updateTechnicianRequest(requestId, { status, adminMessage: adminReply });
      toast.success(status === 'accepted' ? 'Request accepted!' : 'Request rejected.');
      setAdminReply(''); await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally { setDecidingId(null); }
  };

  const handleSendMessage = async (requestId) => {
    if (!adminReply.trim()) return;
    setSending(true);
    try {
      await adminApi.sendTechnicianRequestMessage(requestId, adminReply.trim());
      setAdminReply('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally { setSending(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="tj-page">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="tj-page-header">
        <div>
          <h2 className="tj-page-title">
            <FaHardHat className="me-2" style={{ color: '#A5732F' }} />
            Technician Jobs
          </h2>
          <p className="tj-page-sub">Manage job postings, assignments, and technician requests.</p>
          <span className={`tj-socket-status ${socketConnected ? 'online' : 'offline'}`}>
            <span className="tj-socket-dot" />
            {socketConnected ? 'Live' : 'Connecting…'}
          </span>
        </div>
        <button className="btn tj-btn-primary" onClick={() => { setForm(emptyForm); setShowAddModal(true); }}>
          <FaPlus className="me-2" />Add Job
        </button>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="tj-stats-row">
        {[
          { label: 'Total Jobs',  value: stats.total,     color: '#1a1208', icon: <FaTools /> },
          { label: 'Open',        value: stats.open,      color: '#2563eb', icon: <FaInbox /> },
          { label: 'Assigned',    value: stats.assigned,  color: '#0891b2', icon: <FaUserCheck /> },
          { label: 'Completed',   value: stats.completed, color: '#16a34a', icon: <FaHardHat /> },
        ].map((s) => (
          <div key={s.label} className="tj-stat-card">
            <div className="tj-stat-icon" style={{ background: s.color + '18', color: s.color }}>{s.icon}</div>
            <div>
              <div className="tj-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="tj-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      {/* <div className="tj-tabs">
        {[
          { key: 'all',       label: 'All Jobs'  },
          { key: 'open',      label: 'Open'      },
          { key: 'assigned',  label: 'Assigned'  },
          { key: 'completed', label: 'Completed' },
          { key: 'requests',  label: `Requests${requests.length ? ` (${requests.length})` : ''}`, accent: true },
        ].map((tab) => (
          <button key={tab.key}
            className={`tj-tab${activeTab === tab.key ? ' active' : ''}${tab.accent ? ' accent' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div> */}


      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="tj-content-card">

        {activeTab !== 'requests' ? (
          <>
            {/* Search + filter bar */}
            <div className="tj-toolbar">
              <div className="tj-search-wrap">
                <FaSearch className="tj-search-icon" />
                <input className="tj-search-input" placeholder="Search by title, category, location…"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
                {search && (
                  <button className="tj-search-clear" onClick={() => setSearch('')}><FaTimes /></button>
                )}
              </div>
              <select className="form-select tj-filter-select" value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                {JOB_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{getJobStatusLabel(s)}</option>
                ))}
              </select>
            </div>

            {/* Date filter bar */}
            <div className="tj-date-filter-bar">
              <FaCalendarAlt style={{ color: '#A5732F', flexShrink: 0 }} />
              {['all', 'today', 'tomorrow', 'custom'].map((d) => (
                <button
                  key={d}
                  className={`tj-date-btn${dateFilter === d ? ' active' : ''}`}
                  onClick={() => { setDateFilter(d); if (d !== 'custom') setCustomDate(''); }}
                >
                  {d === 'all' ? 'All Dates' : d === 'today' ? 'Today' : d === 'tomorrow' ? 'Tomorrow' : 'Custom'}
                </button>
              ))}
              {dateFilter === 'custom' && (
                <input
                  type="date"
                  className="tj-date-picker"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              )}
              {dateFilter !== 'all' && (
                <span className="tj-date-count">
                  {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div className="tj-loading">
                <div className="spinner-border" style={{ color: '#A5732F' }} />
                <span>Loading jobs…</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="tj-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Job</th>
                      <th>Location</th>
                      <th>Budget</th>
                      <th>Est. Time</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th>Service Date</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="tj-empty">
                          <FaHardHat size={28} style={{ color: '#ccc' }} />
                          <span>No jobs found</span>
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((job, idx) => (
                        <tr key={job._id}>
                          <td className="tj-row-num">{idx + 1}</td>
                          <td>
                            <div className="tj-job-title">{job.title}</div>
                            <div className="tj-job-cat">{job.category}</div>
                          </td>
                          <td>
                            <span className="tj-location">
                              <FaMapMarkerAlt className="me-1" style={{ color: '#A5732F' }} />
                              {job.location || '—'}
                            </span>
                          </td>
                          <td><span className="tj-budget">${Number(job.budget || 0).toLocaleString()}</span></td>
                          <td>
                            <span className="tj-est-time">
                              {job.estimatedTime || '—'}
                            </span>
                          </td>
                          <td>
                            {job.assignedTechnician?.name ? (
                              <div className="tj-tech-name">
                                <div className="fw-semibold small">{job.assignedTechnician.name}</div>
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{job.assignedTechnician.phone}</div>
                              </div>
                            ) : (
                              <span className="tj-unassigned">Unassigned</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge text-bg-${getJobStatusTone(job.status)} tj-status-badge`}>
                              {getJobStatusLabel(job.status)}
                            </span>
                          </td>
                          <td>
                            <span className="tj-deadline">
                              {job.serviceDate
                                ? new Date(job.serviceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <div className="tj-actions">
                              <button className="tj-action-btn view" title="View Details" onClick={() => openViewPanel(job)}><FaEye /></button>
                              <button className="tj-action-btn edit" title="Edit Job" onClick={() => openEditModal(job)}><FaEdit /></button>
                              <button className="tj-action-btn delete" title="Delete Job" onClick={() => handleDelete(job._id)}><FaTrash /></button>
                              <button className="tj-action-btn requests" title="View Requests"
                                onClick={() => setJobRequestsModal({ show: true, job })}>
                                <FaBell />
                                {(() => {
                                  const cnt = requests.filter((r) => (r.job?._id || r.job) === job._id).length;
                                  return cnt > 0 ? <span className="tj-action-badge">{cnt}</span> : null;
                                })()}
                              </button>
                              <button className="tj-action-btn" title="Reschedule Job" onClick={() => openRescheduleModal(job)} style={{ color: '#A5732F' }}>
                                <FaRedoAlt />
                              </button>
                              {job.status === 'completed' && (
                                <button className="tj-action-btn pay" title="Pay Wallet" onClick={() => openPayModal(job)}>
                                  <FaWallet />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (


          /* ── Requests tab ──────────────────────────────────────────────── */
          <div>
            <div className="tj-requests-header">
              <FaInbox style={{ color: '#A5732F' }} size={18} />
              <h6 className="mb-0 fw-bold">Technician Job Requests</h6>
              <span className="tj-requests-count">{requests.length} total</span>
            </div>

            {loading ? (
              <div className="tj-loading"><div className="spinner-border" style={{ color: '#A5732F' }} /></div>
            ) : requests.length === 0 ? (
              <div className="tj-empty">
                <FaInbox size={28} style={{ color: '#ccc' }} /><span>No requests yet</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="tj-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Technician</th><th>Job</th><th>Bid Amount</th>
                      <th>Status</th><th>Submitted</th><th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req, idx) => (
                      <tr key={req._id}>
                        <td className="tj-row-num">{idx + 1}</td>
                        <td>
                          <div className="tj-job-title">{req.technician?.name || 'Unknown'}</div>
                          <div className="tj-job-cat">{req.technician?.phone || ''}</div>
                        </td>
                        <td>
                          <div className="tj-job-title">{req.job?.title || '—'}</div>
                          <div className="tj-job-cat">{req.job?.location || ''}</div>
                        </td>
                        <td>
                          <span className="tj-budget">
                            {req.bidAmount ? `$${Number(req.bidAmount).toLocaleString()}` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge tj-status-badge ${
                            req.status === 'accepted' ? 'text-bg-success' :
                            req.status === 'rejected' ? 'text-bg-danger'  :
                            req.status === 'counter-offer' ? 'text-bg-warning' : 'text-bg-secondary'
                          }`}>
                            {req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span className="tj-deadline">
                            {req.createdAt
                              ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <div className="tj-actions justify-content-center">
                            {(!req.status || req.status === 'pending') ? (
                              <>
                                <button className="tj-req-btn accept" onClick={() => handleDecision(req._id, 'accepted')}>Accept</button>
                                <button className="tj-req-btn counter" onClick={() => handleDecision(req._id, 'counter-offer')}>Counter</button>
                                <button className="tj-req-btn reject" onClick={() => handleDecision(req._id, 'rejected')}>Reject</button>
                              </>
                            ) : (
                              <span className="text-muted small">Decided</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>


      {/* ── ADD / EDIT MODALS ────────────────────────────────────────────────── */}
      <Modal show={showAddModal} onClose={() => setShowAddModal(false)} title="Create New Job" size="lg">
        <JobForm form={form} setForm={setForm} onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)} isEditing={false} saving={saving} />
      </Modal>

      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Job" size="lg">
        <JobForm form={form} setForm={setForm} onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)} isEditing={true} saving={saving} />
      </Modal>

      {/* ── RESCHEDULE MODAL ─────────────────────────────────────────────────── */}
      <RescheduleModal
        show={showRescheduleModal}
        job={rescheduleJob}
        onClose={() => { setShowRescheduleModal(false); setRescheduleJob(null); }}
        onReschedule={handleReschedule}
        rescheduling={rescheduling}
      />

      {/* ── PAY WALLET MODAL ─────────────────────────────────────────────────── */}
      <PayWalletModal
        show={showPayModal}
        job={payModalJob}
        onClose={() => { setShowPayModal(false); setPayModalJob(null); }}
        onPay={handlePayWallet}
        paying={paying}
      />

      {/* ── VIEW JOB SIDE PANEL ──────────────────────────────────────────────── */}
      {showViewPanel && selectedJob && (
        <div className="tj-view-overlay" onClick={() => setShowViewPanel(false)}>
          <div className="tj-view-panel" onClick={(e) => e.stopPropagation()}>

            <div className="tj-view-panel-header">
              <div>
                <h5 className="mb-0 fw-bold">{selectedJob.title}</h5>
                <small className="text-muted">{selectedJob.category}</small>
              </div>
              <button className="tj-modal-close" onClick={() => setShowViewPanel(false)}><FaTimes /></button>
            </div>

            <div className="tj-view-panel-body">

              <div className="tj-view-section">
                <span className={`badge text-bg-${getJobStatusTone(selectedJob.status)} tj-status-badge`}>
                  {getJobStatusLabel(selectedJob.status)}
                </span>
              </div>

              {/* Scheduled date */}
              {selectedJob.scheduledDate && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">
                    <FaRedoAlt className="me-1" style={{ color: '#A5732F' }} />
                    Scheduled Date
                  </div>
                  <div className="tj-detail-value">{fmtDT(selectedJob.scheduledDate)}</div>
                  {selectedJob.rescheduleHistory?.length > 1 && (
                    <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                      Rescheduled {selectedJob.rescheduleHistory.length - 1} time(s)
                    </div>
                  )}
                </div>
              )}

              {/* Key details */}
              <div className="tj-detail-grid">
                <div className="tj-detail-item">
                  <FaMapMarkerAlt style={{ color: '#A5732F' }} />
                  <div>
                    <div className="tj-detail-label">Location</div>
                    <div className="tj-detail-value">{selectedJob.location || '—'}</div>
                  </div>
                </div>
                <div className="tj-detail-item">
                  <FaRupeeSign style={{ color: '#A5732F' }} />
                  <div>
                    <div className="tj-detail-label">Budget</div>
                    <div className="tj-detail-value">${Number(selectedJob.budget || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="tj-detail-item">
                  <FaClock style={{ color: '#A5732F' }} />
                  <div>
                    <div className="tj-detail-label">Estimated Time</div>
                    <div className="tj-detail-value">{selectedJob.estimatedTime || '—'}</div>
                  </div>
                </div>
                <div className="tj-detail-item">
                  <FaCalendarAlt style={{ color: '#A5732F' }} />
                  <div>
                    <div className="tj-detail-label">Service Date</div>
                    <div className="tj-detail-value">{selectedJob.serviceDate ? fmtDT(selectedJob.serviceDate) : 'No service date'}</div>
                  </div>
                </div>
                {selectedJob.finalPrice > 0 && (
                  <div className="tj-detail-item">
                    <FaRupeeSign style={{ color: '#16a34a' }} />
                    <div>
                      <div className="tj-detail-label">Final Price</div>
                      <div className="tj-detail-value" style={{ color: '#16a34a' }}>
                        ${Number(selectedJob.finalPrice).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>


              {/* ── Job Timeline ─────────────────────────────────────────────── */}
              {(selectedJob.reachedAt || selectedJob.jobCompletedAt) && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">
                    <FaClock className="me-1" style={{ color: '#A5732F' }} />
                    Job Timeline
                  </div>
                  <div className="tj-timeline">
                    {selectedJob.reachedAt && (
                      <div className="tj-timeline-row">
                        <span className="tj-timeline-dot reached" />
                        <div>
                          <div className="tj-timeline-label">Technician Reached</div>
                          <div className="tj-timeline-time">{fmtDT(selectedJob.reachedAt)}</div>
                        </div>
                      </div>
                    )}
                    {selectedJob.jobCompletedAt && (
                      <div className="tj-timeline-row">
                        <span className="tj-timeline-dot completed" />
                        <div>
                          <div className="tj-timeline-label">Job Completed By Tech</div>
                          <div className="tj-timeline-time">{fmtDT(selectedJob.jobCompletedAt)}</div>
                        </div>
                      </div>
                    )}
                    {selectedJob.jobDurationMinutes != null && (
                      <div className="tj-timeline-row">
                        <span className="tj-timeline-dot duration" />
                        <div>
                          <div className="tj-timeline-label">Total Duration</div>
                          <div className="tj-timeline-time tj-duration-value">
                            {formatDuration(selectedJob.jobDurationMinutes)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="tj-view-block">
                <div className="tj-view-block-title">Description</div>
                <p className="tj-view-block-text">{selectedJob.description || '—'}</p>
              </div>

              {selectedJob.preferredSkills?.length > 0 && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">Preferred Skills</div>
                  <div className="tj-tag-list">
                    {selectedJob.preferredSkills.map((s) => <span key={s} className="tj-tag">{s}</span>)}
                  </div>
                </div>
              )}

              {selectedJob.requirements?.length > 0 && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">Requirements</div>
                  <div className="tj-tag-list">
                    {selectedJob.requirements.map((r) => <span key={r} className="tj-tag secondary">{r}</span>)}
                  </div>
                </div>
              )}

              {selectedJob.assignedTechnician?.name && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">Assigned Technician</div>
                  <div className="tj-tech-card">
                    <div className="tj-tech-avatar">{selectedJob.assignedTechnician.name.charAt(0)}</div>
                    <div>
                      <div className="fw-semibold">{selectedJob.assignedTechnician.name}</div>
                      <div className="text-muted small">{selectedJob.assignedTechnician.phone}</div>
                    </div>
                  </div>
                </div>
              )}


              {/* Update status */}
              <div className="tj-view-block">
                <div className="tj-view-block-title">Update Status</div>
                <div className="tj-status-btn-group">
                  {JOB_STATUS_OPTIONS.map((s) => (
                    <button key={s}
                      className={`tj-status-update-btn${selectedJob.status === s ? ' current' : ''}`}
                      onClick={async () => {
                        try {
                          const note = window.prompt('Add a note (optional)', '');
                          const fp   = s === 'completed'
                            ? Number(window.prompt('Enter final price ($)', '0')) || 0
                            : undefined;
                          await adminApi.updateTechnicianJobStatus(selectedJob._id, {
                            status: s, note: note || '', finalPrice: fp,
                          });
                          toast.success('Status updated!');
                          setSelectedJob({ ...selectedJob, status: s, ...(fp !== undefined && { finalPrice: fp }) });
                          await loadData();
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Update failed');
                        }
                      }}>
                      {getJobStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="d-flex gap-2 pt-2 flex-wrap">
                <button className="btn tj-btn-outline flex-fill"
                  onClick={() => { setShowViewPanel(false); openEditModal(selectedJob); }}>
                  <FaEdit className="me-2" />Edit Job
                </button>
                <button className="btn tj-btn-outline flex-fill"
                  onClick={() => openRescheduleModal(selectedJob)}>
                  <FaRedoAlt className="me-2" />Reschedule
                </button>
                {selectedJob.status === 'completed' && (
                  <button className="btn tj-btn-pay flex-fill"
                    onClick={() => openPayModal(selectedJob)}>
                    <FaWallet className="me-2" />Pay Wallet
                  </button>
                )}
                <button className="btn tj-btn-danger flex-fill"
                  onClick={() => handleDelete(selectedJob._id)}>
                  <FaTrash className="me-2" />Delete
                </button>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* ── JOB-SPECIFIC REQUESTS — CONVERSATION MODAL ──────────────────────── */}
      {jobRequestsModal.show && (
        <div className="tj-modal-backdrop" onClick={() => { setJobRequestsModal({ show: false, job: null }); closeConversation(); }}>
          <div className="tj-modal-box xl" onClick={(e) => e.stopPropagation()}>

            <div className="tj-modal-header">
              <div className="d-flex align-items-center gap-2">
                {activeConvReq && (
                  <button className="tj-back-btn" onClick={closeConversation} title="Back to list">&#8592;</button>
                )}
                <div>
                  <h5 className="tj-modal-title mb-0">
                    {activeConvReq
                      ? `Chat with ${activeConvReq.technician?.name || 'Technician'}`
                      : `Requests — ${jobRequestsModal.job?.title || ''}`}
                  </h5>
                  {activeConvReq && (
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>{jobRequestsModal.job?.title}</small>
                  )}
                </div>
              </div>
              <button className="tj-modal-close" onClick={() => { setJobRequestsModal({ show: false, job: null }); closeConversation(); }}>
                <FaTimes />
              </button>
            </div>

            <div className="tj-modal-body" style={{ padding: 0 }}>

              {!activeConvReq && (() => {
                const jobReqs = requests.filter((r) => (r.job?._id || r.job) === jobRequestsModal.job?._id);
                return jobReqs.length === 0 ? (
                  <div className="tj-empty" style={{ padding: '3rem 1rem' }}>
                    <FaInbox size={32} style={{ color: '#ccc' }} />
                    <span>No requests submitted for this job yet.</span>
                  </div>
                ) : (
                  <div className="tj-conv-list">
                    {jobReqs.map((req) => {
                      const techName = req.technician?.name || 'Technician';
                      const hasReply = !!req.adminMessage;
                      return (
                        <div key={req._id} className="tj-conv-row" onClick={() => openConversation(req)}>
                          <div className="tj-tech-avatar" style={{ width: 44, height: 44, fontSize: '1.05rem', flexShrink: 0 }}>
                            {techName.charAt(0).toUpperCase()}
                          </div>
                          <div className="tj-conv-row-info">
                            <div className="tj-conv-row-name">{techName}</div>
                            <div className="tj-conv-row-preview">
                              {req.note
                                ? `"${req.note.length > 60 ? req.note.slice(0, 60) + '…' : req.note}"`
                                : req.bidAmount ? `Bid: ₹${Number(req.bidAmount).toLocaleString()}` : 'No message'}
                            </div>
                          </div>
                          <div className="tj-conv-row-meta">
                            <span className={`badge tj-status-badge ${
                              req.status === 'accepted' ? 'text-bg-success' :
                              req.status === 'rejected' ? 'text-bg-danger' : 'text-bg-secondary'
                            }`}>
                              {req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending'}
                            </span>
                            <ChargesBadge status={req.chargesStatus} />
                            {req.createdAt && (
                              <div className="tj-conv-row-date">
                                {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </div>
                            )}
                          </div>
                          {(!req.status || req.status === 'pending') && !hasReply && (
                            <span className="tj-unread-dot" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}


              {activeConvReq && (() => {
                const req       = requests.find((r) => r._id === activeConvReq._id) || activeConvReq;
                const techName  = req.technician?.name || 'Technician';
                const techPhone = req.technician?.phone || '';
                const isDecided = req.status === 'accepted' || req.status === 'rejected';
                const hasPendingCharges = liveChargesStatus === 'pending' || liveChargesStatus === 'reviewing';

                return (
                  <div className="tj-chat-shell">
                    {/* ── technician info bar ── */}
                    <div className="tj-chat-info-bar">
                      <div className="tj-tech-avatar" style={{ width: 38, height: 38, fontSize: '0.95rem', flexShrink: 0 }}>
                        {techName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{techName}</div>
                        {techPhone && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{techPhone}</div>}
                      </div>
                      {req.bidAmount && (
                        <div className="tj-chat-bid ms-auto">
                          <span className="tj-chat-bid-label">Bid</span>
                          <span className="tj-chat-bid-value">${Number(req.bidAmount).toLocaleString()}</span>
                        </div>
                      )}
                      {liveChargesStatus !== 'none' && (
                        <div className="ms-auto">
                          <ChargesBadge status={liveChargesStatus} />
                        </div>
                      )}
                    </div>

                    {/* ── tab bar: Chat / Charges / Invoice ── */}
                    {req.status === 'accepted' && (
                      <div className="tj-charges-tabs">
                        <button
                          className={`tj-charges-tab${convTab === 'chat' ? ' active' : ''}`}
                          onClick={() => setConvTab('chat')}
                        >
                          💬 Chat
                        </button>
                        <button
                          className={`tj-charges-tab${convTab === 'charges' ? ' active' : ''}`}
                          onClick={() => setConvTab('charges')}
                        >
                          <FaReceipt style={{ marginRight: 4 }} />
                          Charges
                          {hasPendingCharges && <span className="tj-tab-dot" />}
                        </button>
                        <button
                          className={`tj-charges-tab${convTab === 'invoice' ? ' active' : ''}`}
                          onClick={() => setConvTab('invoice')}
                        >
                          <FaFileInvoiceDollar style={{ marginRight: 4 }} />
                          Invoice
                          {liveChargesStatus === 'invoiced' && (
                            <FaCheckCircle style={{ marginLeft: 4, color: '#16a34a', fontSize: '0.7rem' }} />
                          )}
                        </button>
                      </div>
                    )}

                    {/* ── CHAT TAB ── */}
                    {convTab === 'chat' && (
                      <>
                        {hasPendingCharges && (
                          <div className="tj-charges-alert">
                            <FaReceipt />
                            Technician has submitted additional charges awaiting your review
                            <button
                              className="btn btn-sm ms-auto"
                              style={{ background: 'rgba(180,83,9,0.12)', color: '#b45309', fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 6 }}
                              onClick={() => setConvTab('charges')}
                            >
                              Review Charges →
                            </button>
                          </div>
                        )}

                        <div className="tj-chat-messages" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                          {/* initial request note */}
                          <div className="tj-chat-row tech">
                            <div className="tj-tech-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem', flexShrink: 0, alignSelf: 'flex-end' }}>
                              {techName.charAt(0).toUpperCase()}
                            </div>
                            <div className="tj-bubble tech">
                              {req.note
                                ? <p className="mb-0">{req.note}</p>
                                : <p className="mb-0 fst-italic text-muted" style={{ fontSize: '0.82rem' }}>No message yet.</p>
                              }
                              {req.bidAmount && (
                                <div className="tj-bubble-meta">Bid: <strong>${Number(req.bidAmount).toLocaleString()}</strong></div>
                              )}
                              {req.createdAt && <div className="tj-bubble-time">{fmtDT(req.createdAt)}</div>}
                            </div>
                          </div>
                          {/* conversation messages */}
                          {liveConversation.map((msg, i) =>
                            msg.sender === 'admin' ? (
                              <div key={i} className="tj-chat-row admin">
                                <div className={`tj-bubble ${msg.counterOffer > 0 ? 'counter' : 'admin'}`}>
                                  <p className="mb-0">{msg.message}</p>
                                  {msg.counterOffer > 0 && (
                                    <div className="tj-bubble-meta">
                                      Counter offer: <strong>${Number(msg.counterOffer).toLocaleString()}</strong>
                                    </div>
                                  )}
                                  {msg.createdAt && (
                                    <div className="tj-bubble-time" style={{ textAlign: 'right' }}>{fmtDT(msg.createdAt)}</div>
                                  )}
                                </div>
                                <div className="tj-admin-avatar" title="Admin">A</div>
                              </div>
                            ) : (
                              <div key={i} className="tj-chat-row tech">
                                <div className="tj-tech-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem', flexShrink: 0, alignSelf: 'flex-end' }}>
                                  {techName.charAt(0).toUpperCase()}
                                </div>
                                <div className="tj-bubble tech">
                                  <p className="mb-0">{msg.message}</p>
                                  {msg.createdAt && <div className="tj-bubble-time">{fmtDT(msg.createdAt)}</div>}
                                </div>
                              </div>
                            )
                          )}
                          {isDecided && (
                            <div className="tj-chat-decision-bar">
                              <span className={`badge ${req.status === 'accepted' ? 'text-bg-success' : 'text-bg-danger'}`}
                                style={{ fontSize: '0.8rem', padding: '0.45em 1em' }}>
                                {req.status === 'accepted' ? '✓ Request Accepted' : '✕ Request Rejected'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="tj-chat-footer">
                          {!isDecided ? (
                            <>
                              <div className="tj-chat-input-row">
                                <textarea className="tj-chat-reply-input" rows={2}
                                  placeholder="Type a message to the technician…"
                                  value={adminReply} onChange={(e) => setAdminReply(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(req._id); } }}
                                />
                                <button className="tj-send-btn" title="Send message"
                                  disabled={!adminReply.trim() || sending}
                                  onClick={() => handleSendMessage(req._id)}>
                                  {sending ? <span className="spinner-border spinner-border-sm" /> : <FaPaperPlane />}
                                </button>
                              </div>
                              <div className="tj-chat-action-row">
                                <button className="tj-chat-btn accept" disabled={decidingId === req._id}
                                  onClick={() => handleDecision(req._id, 'accepted')}>
                                  {decidingId === req._id ? <span className="spinner-border spinner-border-sm me-1" /> : '✓ '}
                                  Accept Request
                                </button>
                                <button className="tj-chat-btn reject" disabled={decidingId === req._id}
                                  onClick={() => handleDecision(req._id, 'rejected')}>
                                  {decidingId === req._id ? <span className="spinner-border spinner-border-sm me-1" /> : '✕ '}
                                  Reject Request
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="tj-chat-decided-note">
                              This request has already been <strong>{req.status}</strong>. No further action needed.
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ── CHARGES TAB ── */}
                    {convTab === 'charges' && (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <ChargesPanel
                          requestId={req._id}
                          onChargesUpdated={() => {
                            loadData();
                          }}
                        />
                      </div>
                    )}

                    {/* ── INVOICE TAB ── */}
                    {convTab === 'invoice' && (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <InvoicePanel
                          requestId={req._id}
                          request={req}
                          onInvoiceAction={() => {
                            setLiveChargesStatus('invoiced');
                            loadData();
                          }}
                        />
                      </div>
                    )}
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
