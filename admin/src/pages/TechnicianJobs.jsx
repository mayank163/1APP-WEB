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
} from 'react-icons/fa';

const emptyForm = {
  title: '',
  category: 'General Service',
  location: '',
  budget: '',
  description: '',
  preferredSkills: '',
  requirements: '',
  deadline: '',
};

// ─── Reusable Modal wrapper ────────────────────────────────────────────────────
const Modal = ({ show, onClose, title, children, size = '' }) => {
  if (!show) return null;
  return (
    <div className="tj-modal-backdrop" onClick={onClose}>
      <div
        className={`tj-modal-box ${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tj-modal-header">
          <h5 className="tj-modal-title">{title}</h5>
          <button className="tj-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="tj-modal-body">{children}</div>
      </div>
    </div>
  );
};

// ─── Job Form (shared by Add + Edit) ──────────────────────────────────────────
const JobForm = ({ form, setForm, onSubmit, onCancel, isEditing, saving }) => (
  <form onSubmit={onSubmit} className="row g-3">
    <div className="col-12">
      <label className="tj-label">Job Title <span className="text-danger">*</span></label>
      <input
        className="form-control tj-input"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="e.g. AC Service Repair"
        required
      />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Category</label>
      <input
        className="form-control tj-input"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        placeholder="General Service"
      />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Budget ($) <span className="text-danger">*</span></label>
      <input
        className="form-control tj-input"
        type="number"
        min="0"
        value={form.budget}
        onChange={(e) => setForm({ ...form, budget: e.target.value })}
        placeholder="1500"
        required
      />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Location <span className="text-danger">*</span></label>
      <input
        className="form-control tj-input"
        value={form.location}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
        placeholder="Los Angeles"
        required
      />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Deadline</label>
      <input
        className="form-control tj-input"
        type="datetime-local"
        value={form.deadline}
        onChange={(e) => setForm({ ...form, deadline: e.target.value })}
      />
    </div>
    <div className="col-12">
      <label className="tj-label">Description <span className="text-danger">*</span></label>
      <textarea
        className="form-control tj-input"
        rows={3}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Describe the work required…"
        required
      />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Preferred Skills</label>
      <input
        className="form-control tj-input"
        value={form.preferredSkills}
        onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })}
        placeholder="AC, electrical, repair (comma separated)"
      />
    </div>
    <div className="col-md-6">
      <label className="tj-label">Requirements</label>
      <input
        className="form-control tj-input"
        value={form.requirements}
        onChange={(e) => setForm({ ...form, requirements: e.target.value })}
        placeholder="Tools, safety gear (comma separated)"
      />
    </div>
    <div className="col-12 d-flex justify-content-end gap-2 pt-2">
      <button type="button" className="btn tj-btn-ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <button type="submit" className="btn tj-btn-primary" disabled={saving}>
        {saving
          ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
          : isEditing ? 'Update Job' : 'Create Job'
        }
      </button>
    </div>
  </form>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
const TechnicianJobs = () => {
  const [jobs, setJobs]           = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // tabs: 'all' | 'open' | 'assigned' | 'completed' | 'requests'
  const [activeTab, setActiveTab] = useState('all');

  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // modals
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);

  // job-specific requests modal
  const [jobRequestsModal, setJobRequestsModal] = useState({ show: false, job: null });
  // which single request is open in the conversation view (null = list view)
  const [activeConvReq, setActiveConvReq]       = useState(null);
  // admin reply message typed in the chat box
  const [adminReply, setAdminReply]             = useState('');
  const [decidingId, setDecidingId]             = useState(null);
  const [sending, setSending]                   = useState(false);

  // Live conversation messages driven by socket (keyed by requestId)
  const [liveConversation, setLiveConversation] = useState([]);
  // Ref to current open requestId so socket callbacks can read it without stale closure
  const activeReqIdRef = useRef(null);

  const [form, setForm]             = useState(emptyForm);
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

  // ── Socket: listen for real-time chat messages + status changes ─────────────
  useEffect(() => {
    const handleIncomingMessage = ({ requestId, message }) => {
      // Only update UI if the incoming message belongs to the open conversation
      if (activeReqIdRef.current !== requestId) return;
      setLiveConversation((prev) => [...prev, message]);
    };

    const handleStatusChange = ({ requestId, status }) => {
      if (activeReqIdRef.current !== requestId) return;
      // Sync requests list so the status badge + bell badge stay accurate
      setRequests((prev) =>
        prev.map((r) => r._id === requestId ? { ...r, status } : r)
      );
    };

    socket.on('request:message', handleIncomingMessage);
    socket.on('request:status',  handleStatusChange);

    return () => {
      socket.off('request:message', handleIncomingMessage);
      socket.off('request:status',  handleStatusChange);
    };
  }, []); // mount/unmount only — callbacks read ref, not state

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     jobs.length,
    open:      jobs.filter((j) => j.status === 'open').length,
    assigned:  jobs.filter((j) => j.status === 'assigned').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  }), [jobs]);

  // ── Filtered jobs (table view) ───────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const tabStatus = activeTab === 'all' || activeTab === 'requests'
        ? true
        : job.status === activeTab;

      const dropdownStatus = filterStatus === 'all' || job.status === filterStatus;

      const matchSearch = !search ||
        [job.title, job.category, job.location, job.description]
          .join(' ').toLowerCase().includes(search.toLowerCase());

      return tabStatus && dropdownStatus && matchSearch;
    });
  }, [jobs, activeTab, filterStatus, search]);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const buildPayload = (f) => ({
    ...f,
    budget: Number(f.budget || 0),
    preferredSkills: f.preferredSkills.split(',').map((s) => s.trim()).filter(Boolean),
    requirements:    f.requirements.split(',').map((s) => s.trim()).filter(Boolean),
    deadline: f.deadline || undefined,
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createTechnicianJob(buildPayload(form));
      toast.success('Job created successfully!');
      setShowAddModal(false);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
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
      deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 16) : '',
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateTechnicianJob(editingJobId, buildPayload(form));
      toast.success('Job updated!');
      setShowEditModal(false);
      setForm(emptyForm);
      setEditingJobId(null);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update job');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    try {
      await adminApi.deleteTechnicianJob(jobId);
      toast.success('Job deleted');
      if (selectedJob?._id === jobId) setShowViewPanel(false);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const openViewPanel = (job) => {
    setSelectedJob(job);
    setShowViewPanel(true);
  };

  // ── Socket room helpers ─────────────────────────────────────────────────────
  const openConversation = (req) => {
    setActiveConvReq(req);
    setAdminReply('');
    // Seed live conversation from what we already have
    setLiveConversation(req.conversation || []);
    // Track in ref for socket callbacks
    activeReqIdRef.current = req._id;
    // Join the backend room
    socket.emit('request:join', req._id);
  };

  const closeConversation = () => {
    if (activeReqIdRef.current) {
      socket.emit('request:leave', activeReqIdRef.current);
      activeReqIdRef.current = null;
    }
    setActiveConvReq(null);
    setAdminReply('');
    setLiveConversation([]);
  };

  // ── Request decision (accept / reject) ────────────────────────────────────
  const handleDecision = async (requestId, status) => {
    setDecidingId(requestId);
    try {
      await adminApi.updateTechnicianRequest(requestId, {
        status,
        adminMessage: adminReply,
      });
      toast.success(status === 'accepted' ? 'Request accepted!' : 'Request rejected.');
      setAdminReply('');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setDecidingId(null);
    }
  };

  // ── Send standalone message to technician ───────────────────────────────────
  const handleSendMessage = async (requestId) => {
    if (!adminReply.trim()) return;
    setSending(true);
    try {
      await adminApi.sendTechnicianRequestMessage(requestId, adminReply.trim());
      setAdminReply('');
      // Note: no loadData() here — socket event request:message updates liveConversation in real-time
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ── Socket connection indicator ─────────────────────────────────────────────
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect    = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

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
          <FaPlus className="me-2" />
          Add Job
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
            <div className="tj-stat-icon" style={{ background: s.color + '18', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="tj-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="tj-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="tj-tabs">
        {[
          { key: 'all',       label: 'All Jobs'  },
          { key: 'open',      label: 'Open'      },
          { key: 'assigned',  label: 'Assigned'  },
          { key: 'completed', label: 'Completed' },
          { key: 'requests',  label: `Requests${requests.length ? ` (${requests.length})` : ''}`, accent: true },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`tj-tab${activeTab === tab.key ? ' active' : ''}${tab.accent ? ' accent' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="tj-content-card">

        {activeTab !== 'requests' ? (
          <>
            {/* Search + filter bar */}
            <div className="tj-toolbar">
              <div className="tj-search-wrap">
                <FaSearch className="tj-search-icon" />
                <input
                  className="tj-search-input"
                  placeholder="Search by title, category, location…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="tj-search-clear" onClick={() => setSearch('')}>
                    <FaTimes />
                  </button>
                )}
              </div>
              <select
                className="form-select tj-filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {JOB_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{getJobStatusLabel(s)}</option>
                ))}
              </select>
            </div>

            {/* Jobs table */}
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
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th>Deadline</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="tj-empty">
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
                          <td>
                            <span className="tj-budget">
                              ${Number(job.budget || 0).toLocaleString()}
                            </span>
                          </td>
                          <td>
                            {job.assignedTechnician?.name ? (
                              <div className="tj-tech-name">
                                <div className="fw-semibold small">{job.assignedTechnician.name}</div>
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                  {job.assignedTechnician.phone}
                                </div>
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
                              {job.deadline
                                ? new Date(job.deadline).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <div className="tj-actions">
                              <button
                                className="tj-action-btn view"
                                title="View Details"
                                onClick={() => openViewPanel(job)}
                              >
                                <FaEye />
                              </button>
                              <button
                                className="tj-action-btn edit"
                                title="Edit Job"
                                onClick={() => openEditModal(job)}
                              >
                                <FaEdit />
                              </button>
                              <button
                                className="tj-action-btn delete"
                                title="Delete Job"
                                onClick={() => handleDelete(job._id)}
                              >
                                <FaTrash />
                              </button>
                              <button
                                className="tj-action-btn requests"
                                title="View Requests"
                                onClick={() => setJobRequestsModal({ show: true, job })}
                              >
                                <FaBell />
                                {(() => {
                                  const cnt = requests.filter(
                                    (r) => (r.job?._id || r.job) === job._id
                                  ).length;
                                  return cnt > 0
                                    ? <span className="tj-action-badge">{cnt}</span>
                                    : null;
                                })()}
                              </button>
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
              <div className="tj-loading">
                <div className="spinner-border" style={{ color: '#A5732F' }} />
              </div>
            ) : requests.length === 0 ? (
              <div className="tj-empty">
                <FaInbox size={28} style={{ color: '#ccc' }} />
                <span>No requests yet</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="tj-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Technician</th>
                      <th>Job</th>
                      <th>Bid Amount</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req, idx) => (
                      <tr key={req._id}>
                        <td className="tj-row-num">{idx + 1}</td>
                        <td>
                          <div className="tj-job-title">
                            {req.technician?.name || req.technicianName || 'Unknown'}
                          </div>
                          <div className="tj-job-cat">
                            {req.technician?.phone || req.technicianPhone || ''}
                          </div>
                        </td>
                        <td>
                          <div className="tj-job-title">{req.job?.title || req.jobTitle || '—'}</div>
                          <div className="tj-job-cat">{req.job?.location || ''}</div>
                        </td>
                        <td>
                          <span className="tj-budget">
                            {req.bidAmount
                              ? `$${Number(req.bidAmount).toLocaleString()}`
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge tj-status-badge ${
                            req.status === 'accepted'      ? 'text-bg-success' :
                            req.status === 'rejected'      ? 'text-bg-danger'  :
                            req.status === 'counter-offer' ? 'text-bg-warning' :
                                                             'text-bg-secondary'
                          }`}>
                            {req.status
                              ? req.status.charAt(0).toUpperCase() + req.status.slice(1)
                              : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span className="tj-deadline">
                            {req.createdAt
                              ? new Date(req.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <div className="tj-actions justify-content-center">
                            {req.status === 'pending' || !req.status ? (
                              <>
                                <button
                                  className="tj-req-btn accept"
                                  onClick={() => handleDecision(req._id, 'accepted')}
                                >
                                  Accept
                                </button>
                                <button
                                  className="tj-req-btn counter"
                                  onClick={() => handleDecision(req._id, 'counter-offer')}
                                >
                                  Counter
                                </button>
                                <button
                                  className="tj-req-btn reject"
                                  onClick={() => handleDecision(req._id, 'rejected')}
                                >
                                  Reject
                                </button>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          ADD JOB MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create New Job"
        size="lg"
      >
        <JobForm
          form={form}
          setForm={setForm}
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
          isEditing={false}
          saving={saving}
        />
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT JOB MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Job"
        size="lg"
      >
        <JobForm
          form={form}
          setForm={setForm}
          onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)}
          isEditing={true}
          saving={saving}
        />
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW JOB SIDE PANEL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showViewPanel && selectedJob && (
        <div className="tj-view-overlay" onClick={() => setShowViewPanel(false)}>
          <div className="tj-view-panel" onClick={(e) => e.stopPropagation()}>

            <div className="tj-view-panel-header">
              <div>
                <h5 className="mb-0 fw-bold">{selectedJob.title}</h5>
                <small className="text-muted">{selectedJob.category}</small>
              </div>
              <button className="tj-modal-close" onClick={() => setShowViewPanel(false)}>
                <FaTimes />
              </button>
            </div>

            <div className="tj-view-panel-body">

              {/* Status */}
              <div className="tj-view-section">
                <span className={`badge text-bg-${getJobStatusTone(selectedJob.status)} tj-status-badge`}>
                  {getJobStatusLabel(selectedJob.status)}
                </span>
              </div>

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
                  <FaCalendarAlt style={{ color: '#A5732F' }} />
                  <div>
                    <div className="tj-detail-label">Deadline</div>
                    <div className="tj-detail-value">
                      {selectedJob.deadline
                        ? new Date(selectedJob.deadline).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })
                        : 'No deadline'}
                    </div>
                  </div>
                </div>
                {selectedJob.finalPrice ? (
                  <div className="tj-detail-item">
                    <FaRupeeSign style={{ color: '#16a34a' }} />
                    <div>
                      <div className="tj-detail-label">Final Price</div>
                      <div className="tj-detail-value" style={{ color: '#16a34a' }}>
                        ${Number(selectedJob.finalPrice).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Description */}
              <div className="tj-view-block">
                <div className="tj-view-block-title">Description</div>
                <p className="tj-view-block-text">{selectedJob.description || '—'}</p>
              </div>

              {/* Skills + Requirements */}
              {selectedJob.preferredSkills?.length > 0 && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">Preferred Skills</div>
                  <div className="tj-tag-list">
                    {selectedJob.preferredSkills.map((s) => (
                      <span key={s} className="tj-tag">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedJob.requirements?.length > 0 && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">Requirements</div>
                  <div className="tj-tag-list">
                    {selectedJob.requirements.map((r) => (
                      <span key={r} className="tj-tag secondary">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned technician */}
              {selectedJob.assignedTechnician?.name && (
                <div className="tj-view-block">
                  <div className="tj-view-block-title">Assigned Technician</div>
                  <div className="tj-tech-card">
                    <div className="tj-tech-avatar">
                      {selectedJob.assignedTechnician.name.charAt(0)}
                    </div>
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
                    <button
                      key={s}
                      className={`tj-status-update-btn${selectedJob.status === s ? ' current' : ''}`}
                      onClick={async () => {
                        try {
                          const note = window.prompt('Add a note (optional)', '');
                          const fp = s === 'completed'
                            ? Number(window.prompt('Enter final price ($)', '0')) || 0
                            : undefined;
                          await adminApi.updateTechnicianJobStatus(selectedJob._id, {
                            status: s, note: note || '', finalPrice: fp,
                          });
                          toast.success('Status updated!');
                          setSelectedJob({ ...selectedJob, status: s });
                          await loadData();
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Update failed');
                        }
                      }}
                    >
                      {getJobStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="d-flex gap-2 pt-2">
                <button className="btn tj-btn-outline w-50" onClick={() => { setShowViewPanel(false); openEditModal(selectedJob); }}>
                  <FaEdit className="me-2" />Edit Job
                </button>
                <button className="btn tj-btn-danger w-50" onClick={() => handleDelete(selectedJob._id)}>
                  <FaTrash className="me-2" />Delete Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          JOB-SPECIFIC REQUESTS — CONVERSATION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {jobRequestsModal.show && (
        <div className="tj-modal-backdrop" onClick={() => {
          setJobRequestsModal({ show: false, job: null });
          closeConversation();
        }}>
          <div className="tj-modal-box xl" onClick={(e) => e.stopPropagation()}>

            {/* ── Modal header ── */}
            <div className="tj-modal-header">
              <div className="d-flex align-items-center gap-2">
                {activeConvReq && (
                  <button
                    className="tj-back-btn"
                    onClick={() => closeConversation()}
                    title="Back to list"
                  >
                    &#8592;
                  </button>
                )}
                <div>
                  <h5 className="tj-modal-title mb-0">
                    {activeConvReq
                      ? `Chat with ${activeConvReq.technician?.name || activeConvReq.technicianName || 'Technician'}`
                      : `Requests — ${jobRequestsModal.job?.title || ''}`}
                  </h5>
                  {activeConvReq && (
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {jobRequestsModal.job?.title}
                    </small>
                  )}
                </div>
              </div>
              <button className="tj-modal-close" onClick={() => {
                setJobRequestsModal({ show: false, job: null });
                closeConversation();
              }}>
                <FaTimes />
              </button>
            </div>

            <div className="tj-modal-body" style={{ padding: 0 }}>

              {/* ════════ LIST VIEW ════════ */}
              {!activeConvReq && (() => {
                const jobReqs = requests.filter(
                  (r) => (r.job?._id || r.job) === jobRequestsModal.job?._id
                );
                return jobReqs.length === 0 ? (
                  <div className="tj-empty" style={{ padding: '3rem 1rem' }}>
                    <FaInbox size={32} style={{ color: '#ccc' }} />
                    <span>No requests submitted for this job yet.</span>
                  </div>
                ) : (
                  <div className="tj-conv-list">
                    {jobReqs.map((req) => {
                      const techName = req.technician?.name || req.technicianName || 'Technician';
                      const hasReply = !!req.adminMessage;
                      return (
                        <div
                          key={req._id}
                          className="tj-conv-row"
                          onClick={() => openConversation(req)}
                        >
                          {/* Avatar */}
                          <div className="tj-tech-avatar" style={{ width: 44, height: 44, fontSize: '1.05rem', flexShrink: 0 }}>
                            {techName.charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="tj-conv-row-info">
                            <div className="tj-conv-row-name">{techName}</div>
                            <div className="tj-conv-row-preview">
                              {req.note
                                ? `"${req.note.length > 60 ? req.note.slice(0, 60) + '…' : req.note}"`
                                : req.bidAmount
                                  ? `Bid: ₹${Number(req.bidAmount).toLocaleString()}`
                                  : 'No message'}
                            </div>
                          </div>

                          {/* Right side */}
                          <div className="tj-conv-row-meta">
                            <span className={`badge tj-status-badge ${
                              req.status === 'accepted' ? 'text-bg-success' :
                              req.status === 'rejected' ? 'text-bg-danger'  :
                              'text-bg-secondary'
                            }`}>
                              {req.status
                                ? req.status.charAt(0).toUpperCase() + req.status.slice(1)
                                : 'Pending'}
                            </span>
                            {req.createdAt && (
                              <div className="tj-conv-row-date">
                                {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </div>
                            )}
                          </div>

                          {/* Unread dot if pending + no reply */}
                          {(!req.status || req.status === 'pending') && !hasReply && (
                            <span className="tj-unread-dot" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ════════ CONVERSATION VIEW ════════ */}
              {activeConvReq && (() => {
                const req = requests.find((r) => r._id === activeConvReq._id) || activeConvReq;
                const techName  = req.technician?.name || req.technicianName || 'Technician';
                const techPhone = req.technician?.phone || req.technicianPhone || '';
                const isDecided = req.status === 'accepted' || req.status === 'rejected';

                return (
                  <div className="tj-chat-shell">

                    {/* Technician info bar */}
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
                          <span className="tj-chat-bid-value">₹{Number(req.bidAmount).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Messages area — driven by liveConversation (real-time via socket) */}
                    <div
                      className="tj-chat-messages"
                      ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                    >
                      {liveConversation.length > 0
                        ? liveConversation.map((msg, i) =>
                            msg.sender === 'admin' ? (
                              <div key={i} className="tj-chat-row admin">
                                <div className="tj-bubble admin">
                                  <p className="mb-0">{msg.message}</p>
                                  {msg.createdAt && (
                                    <div className="tj-bubble-time" style={{ textAlign: 'right' }}>
                                      {new Date(msg.createdAt).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </div>
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
                                  {req.bidAmount && i === 0 && (
                                    <div className="tj-bubble-meta">
                                      Bid: <strong>₹{Number(req.bidAmount).toLocaleString()}</strong>
                                    </div>
                                  )}
                                  {msg.createdAt && (
                                    <div className="tj-bubble-time">
                                      {new Date(msg.createdAt).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          )
                        /* Fallback: no conversation array yet — show raw note */
                        : (
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
                                <div className="tj-bubble-meta">
                                  Bid: <strong>₹{Number(req.bidAmount).toLocaleString()}</strong>
                                </div>
                              )}
                              {req.createdAt && (
                                <div className="tj-bubble-time">
                                  {new Date(req.createdAt).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }

                      {/* Decision badge if already decided */}
                      {isDecided && (
                        <div className="tj-chat-decision-bar">
                          <span className={`badge ${req.status === 'accepted' ? 'text-bg-success' : 'text-bg-danger'}`}
                            style={{ fontSize: '0.8rem', padding: '0.45em 1em' }}>
                            {req.status === 'accepted' ? '✓ Request Accepted' : '✕ Request Rejected'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Chat footer ── */}
                    <div className="tj-chat-footer">
                      {!isDecided ? (
                        <>
                          {/* Message input row with Send button */}
                          <div className="tj-chat-input-row">
                            <textarea
                              className="tj-chat-reply-input"
                              rows={2}
                              placeholder="Type a message to the technician…"
                              value={adminReply}
                              onChange={(e) => setAdminReply(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage(req._id);
                                }
                              }}
                            />
                            <button
                              className="tj-send-btn"
                              title="Send message"
                              disabled={!adminReply.trim() || sending}
                              onClick={() => handleSendMessage(req._id)}
                            >
                              {sending
                                ? <span className="spinner-border spinner-border-sm" />
                                : <FaPaperPlane />
                              }
                            </button>
                          </div>

                          {/* Accept / Reject */}
                          <div className="tj-chat-action-row">
                            <button
                              className="tj-chat-btn accept"
                              disabled={decidingId === req._id}
                              onClick={() => handleDecision(req._id, 'accepted')}
                            >
                              {decidingId === req._id
                                ? <span className="spinner-border spinner-border-sm me-1" />
                                : '✓ '}
                              Accept Request
                            </button>
                            <button
                              className="tj-chat-btn reject"
                              disabled={decidingId === req._id}
                              onClick={() => handleDecision(req._id, 'rejected')}
                            >
                              {decidingId === req._id
                                ? <span className="spinner-border spinner-border-sm me-1" />
                                : '✕ '}
                              Reject Request
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="tj-chat-decided-note">
                          This request has already been <strong>{req.status}</strong>.
                          No further action needed.
                        </div>
                      )}
                    </div>

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
