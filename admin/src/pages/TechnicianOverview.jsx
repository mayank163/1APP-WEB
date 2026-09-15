import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiUserPlus, FiSearch, FiFilter, FiCalendar, FiX, FiChevronLeft, FiChevronRight, FiMoreVertical, FiEdit2, FiClipboard, FiShield, FiMessageSquare, FiUserX, FiPhone, FiMail, FiArrowRight, FiCheckCircle, FiClock, FiUsers, FiBriefcase, FiBarChart2, FiFileText, FiDollarSign, FiActivity, FiMapPin } from 'react-icons/fi';
import { useAdminAuth } from '../context/AdminAuthContext';
import adminApi from '../services/adminApi';
import { getImageUrl } from '../utils/helpers';
import TechnicianFormModal, { DEFAULT_TRADES, DetailList, errorMessage } from '../components/TechnicianFormModal';
import '../styles/TechnicianOverview.css';
const initialFilters = {
  search: '',
  verification: 'all',
  availability: 'all',
  service: 'all',
  location: 'all',
  rating: 'all',
  performance: 'all',
  account: 'all',
  from: '',
  to: '',
  sort: 'newest'
};
const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const verification = t => t.verificationStatus === 'approved' ? 'approved' : t.verificationStatus === 'rejected' ? 'rejected' : t.verificationStatus === 'pending' ? 'under_review' : 'pending';
const availability = t => ['suspended', 'blocked'].includes(t.accountStatus) ? 'blocked' : t.accountStatus === 'invited' ? 'invited' : t.isOnline ? 'online' : 'offline';
const labels = {
  approved: 'Verified',
  rejected: 'Action Required',
  under_review: 'Under Review',
  pending: 'Pending',
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  blocked: 'Blocked',
  online: 'Online',
  offline: 'Offline'
};
function Badge({
  status
}) {
  return <span className={`to-badge to-badge-${status}`}>{status === 'approved' ? <FiCheckCircle /> : status === 'under_review' ? <FiClock /> : ['online', 'offline', 'invited'].includes(status) ? <span>•</span> : null}{labels[status] || status}</span>;
}
function Avatar({
  technician,
  large = false
}) {
  const [failed, setFailed] = useState(false);
  return <div className={`to-avatar${large ? ' to-avatar-large' : ''}`}>{technician.photoUrl && !failed ? <img src={getImageUrl(technician.photoUrl)} alt="" onError={() => setFailed(true)} /> : initials(technician.name || '?')}</div>;
}
function Rating({
  technician
}) {
  return <div className="to-rating"><span><i>★</i> {technician.rating == null ? 'NA' : Number(technician.rating).toFixed(1)}</span>{technician.ratingCount != null && <small>({technician.ratingCount})</small>}</div>;
}

function TechnicianProfileModal({ technician, jobs, canWrite, onClose, onEdit }) {
  const [tab, setTab] = useState('overview');
  const documents = technician.documents || [];
  const approvedDocuments = documents.filter(document => document.status === 'approved').length;
  const earnings = Number(technician.totalEarnings || 0);
  const withdrawn = Number(technician.totalWithdrawn || 0);
  const available = Math.max(earnings - withdrawn, 0);
  const technicianJobs = (jobs || []).filter(job => String(job.assignedTechnician?._id || job.assignedTechnician || '') === String(technician._id));
  const profileRows = [
    ['Full Name', technician.name],
    ['Email', technician.email || 'Not available'],
    ['Phone', technician.phone || 'Not available'],
    ['Technician ID', technician.technicianId || 'Not available'],
    ['Primary Service', technician.primaryService || 'Not available'],
    ['Experience', technician.yearsOfExperience != null ? `${technician.yearsOfExperience} years` : 'Not available'],
    ['Service Area', technician.serviceArea || 'Not available'],
    ['Service Radius', technician.serviceRadius ? `${technician.serviceRadius} km` : 'Not available'],
  ];
  const tabs = [
    ['overview', 'Overview', FiUsers],
    ['jobs', 'Jobs', FiBriefcase],
    ['performance', 'Performance', FiBarChart2],
    ['documents', 'Documents', FiFileText],
    ['earnings', 'Earnings & Payouts', FiDollarSign],
    ['activity', 'Activity', FiActivity],
  ];

  return <div className="to-profile-screen" aria-labelledby="to-profile-title">
    <div className="to-profile-workspace-header">
      <div className="to-profile-heading"><div><div className="to-breadcrumb">Field Operations <FiChevronRight /> Technicians <FiChevronRight /> <span>Profile</span></div><h2 id="to-profile-title">Technician’s Profile</h2><p>Manage and monitor technician activity.</p></div></div>
      <div className="to-profile-header-actions"><button className="to-btn-outline" onClick={onClose}><FiX /> Close</button>{canWrite && <button className="to-btn-primary" onClick={onEdit}><FiEdit2 /> Edit Profile</button>}</div>
    </div>
    <div className="to-profile-summary"><Avatar technician={technician} /><div className="to-profile-summary-main"><h3>{technician.name} <Badge status={verification(technician)} /></h3><p>{technician.technicianId || 'Technician'} · {technician.primaryService || 'Service not added'}</p><p><FiMapPin /> {technician.serviceArea || 'Location not available'}</p><div className="to-profile-summary-status"><Badge status={availability(technician)} /><span>Last active: {technician.isOnline ? 'Now' : 'Not available'}</span></div></div><div className="to-profile-summary-actions"><button className="to-btn-outline" onClick={() => technician.phone && (window.location.href = `tel:${technician.phone}`)}><FiPhone /> Call</button><button className="to-btn-soft" onClick={() => technician.email && (window.location.href = `mailto:${technician.email}`)}><FiMail /> Email</button></div></div>
    <div className="to-profile-tabs" role="tablist">{tabs.map(([key, label, Icon]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon />{label}</button>)}</div>
    <div className="to-profile-workspace-body">
      {tab === 'overview' && <div className="to-profile-grid"><section className="to-profile-panel to-profile-panel-wide"><h3>Personal Information</h3><div className="to-detail-grid">{profileRows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section><section className="to-profile-panel"><h3>Verification Summary</h3><div className="to-verification-summary"><Badge status={verification(technician)} /><strong>{approvedDocuments} / {documents.length || 0} Documents Approved</strong>{documents.length ? documents.map(document => <div key={document.documentId}><FiCheckCircle />{document.label || document.documentId}<span>{document.status || 'pending'}</span></div>) : <p>No documents uploaded.</p>}</div></section><section className="to-profile-panel"><h3>Skills & Tools</h3><div className="to-tag-list">{(technician.skills || []).length ? technician.skills.map(skill => <span key={skill}>{skill}</span>) : <p>Not available</p>}</div></section><section className="to-profile-panel"><h3>Account Information</h3><div className="to-detail-list"><div><dt>Account status</dt><dd><Badge status={technician.accountStatus || 'active'} /></dd></div><div><dt>Phone verification</dt><dd>{technician.isPhoneVerified ? 'Verified' : 'Not verified'}</dd></div><div><dt>Joined</dt><dd>{technician.createdAt ? new Date(technician.createdAt).toLocaleDateString('en-IN') : 'Not available'}</dd></div></div></section></div>}
      {tab === 'jobs' && <section className="to-profile-panel"><div className="to-profile-panel-title"><h3>Jobs completed by {technician.name}</h3><span className="to-job-count">{technicianJobs.length} jobs</span></div>{technicianJobs.length ? <div className="to-profile-jobs"><div className="to-profile-job-row to-profile-job-head"><span>Job</span><span>Status</span><span>Scheduled</span><span>Amount</span></div>{technicianJobs.map(job => <div className="to-profile-job-row" key={job._id}><strong>{job.title || 'Untitled job'}</strong><Badge status={job.status === 'completed' ? 'approved' : job.status === 'checkout' ? 'under_review' : 'pending'} /><span>{job.jobDate?.from ? new Date(job.jobDate.from).toLocaleDateString('en-IN') : 'Not scheduled'}</span><span>${Number(job.finalPrice || job.pay?.fixedAmount || 0).toLocaleString()}</span></div>)}</div> : <ProfileEmptyState icon={FiBriefcase} title="No jobs found" text="No jobs are currently assigned to this technician." />}</section>}
      {tab === 'performance' && <div className="to-profile-grid"><MetricCard label="Completion Rate" value={technician.performance != null ? `${technician.performance}%` : 'Not available'} icon={FiBarChart2} /><MetricCard label="Average Rating" value={technician.rating != null ? Number(technician.rating).toFixed(1) : 'Not available'} icon={FiCheckCircle} /><MetricCard label="Reviews" value={technician.ratingCount != null ? technician.ratingCount : 'Not available'} icon={FiUsers} /><ProfileEmptyState icon={FiClock} title="Response time" text="Response-time metrics are not available from the current technician API." /> </div>}
      {tab === 'documents' && <section className="to-profile-panel"><div className="to-profile-panel-title"><h3>All Documents</h3><Badge status={verification(technician)} /></div>{documents.length ? <div className="to-document-list">{documents.map(document => <div key={document.documentId}><FiFileText /><div><strong>{document.label || document.documentId}</strong><small>{document.status || 'pending'}</small></div><span>{document.rejectionReason || 'No additional notes'}</span></div>)}</div> : <ProfileEmptyState icon={FiFileText} title="No documents uploaded" text="Documents submitted by this technician will appear here." />}</section>}
      {tab === 'earnings' && <div className="to-profile-grid"><MetricCard label="Total Earnings" value={`$${earnings.toLocaleString()}`} icon={FiDollarSign} /><MetricCard label="Total Paid Out" value={`$${withdrawn.toLocaleString()}`} icon={FiDollarSign} /><MetricCard label="Available Balance" value={`$${available.toLocaleString()}`} icon={FiDollarSign} /><ProfileEmptyState icon={FiActivity} title="Earnings transactions" text="Detailed payout transactions are not available from the current technician API." /></div>}
      {tab === 'activity' && <ProfileEmptyState icon={FiActivity} title="No activity history" text="Technician activity events will appear here when the activity feed API is connected." />}
    </div>
  </div>;
}

function MetricCard({ label, value, icon: Icon }) {
  return <div className="to-profile-metric"><Icon /><span>{label}</span><strong>{value}</strong></div>;
}

function ProfileEmptyState({ icon: Icon, title, text, value }) {
  return <section className="to-profile-panel to-profile-empty"><Icon /><h3>{title}{value != null ? ` (${value})` : ''}</h3><p>{text}</p></section>;
}
function InviteModal({
  onClose,
  technician
}) {
  const [channel, setChannel] = useState('email');
  const [form, setForm] = useState({
    name: technician?.name || '',
    email: technician?.email || '',
    phone: technician?.phone || ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.inviteTechnician({
        ...form,
        channel
      });
      toast.success('Invitation sent successfully.');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return <Modal show centered onHide={() => !busy && onClose()} dialogClassName="to-modal to-invite-modal" aria-labelledby="to-invite-title"><Modal.Header><Modal.Title id="to-invite-title">Invite Technician</Modal.Title><button className="to-icon-btn" aria-label="Close" disabled={busy} onClick={onClose}><FiX /></button></Modal.Header><form onSubmit={submit}><Modal.Body>
    <div className="to-invite-tabs">{['email', 'phone'].map(c => <button type="button" key={c} className={c === channel ? 'active' : ''} aria-pressed={c === channel} onClick={() => {
            setChannel(c);
            setError('');
          }}>Invite Via {c === 'email' ? 'Email' : 'Phone'}</button>)}</div>
    {error && <div className="to-alert to-error" role="alert">{error}</div>}
    <label className="to-field"><span>Full Name</span><input required maxLength={120} value={form.name} onChange={e => setForm({
            ...form,
            name: e.target.value
          })} placeholder="e.g. John Doe" /></label>
    <label className="to-field"><span>{channel === 'email' ? 'Email Address' : 'Mobile Number'}</span><input required type={channel === 'email' ? 'email' : 'tel'} value={form[channel]} onChange={e => setForm({
            ...form,
            [channel]: e.target.value
          })} placeholder={channel === 'email' ? 'john@example.com' : '+91 98765 43210'} /></label>
  </Modal.Body><Modal.Footer><button type="button" className="to-btn-neutral" onClick={onClose} disabled={busy}>Cancel</button><button className="to-btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send Invitation'}</button></Modal.Footer></form></Modal>;
}
function ActionModal({
  action,
  technician,
  onClose,
  onSaved
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [requestId, setRequestId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(action === 'assign' || action === 'message');
  useEffect(() => {
    if (!loading) return;
    let active = true;
    adminApi.getTechnicianRequests().then(res => {
      const data = res.data || res;
      if (active) setRequests((data.requests || []).filter(r => String(r.technician?._id || r.technician) === technician._id && (action !== 'assign' || (r.initiatedBy !== 'admin' && r.job?.status === 'open' && ['pending', 'counter-offer'].includes(r.status)))));
    }).catch(err => {
      if (active) setError(errorMessage(err));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // Load once for the selected technician and action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technician._id, action]);
  const suspend = action === 'suspend';
  const restoring = ['suspended', 'blocked'].includes(technician.accountStatus);
  const title = suspend ? `${restoring ? 'Restore' : 'Suspend'} Account` : action === 'assign' ? 'Assign to Job' : 'Message Technician';
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (suspend) await adminApi.updateTechnicianAccount(technician._id, restoring ? 'active' : 'suspended');else if (action === 'assign') await adminApi.updateTechnicianRequest(requestId, {
        status: 'accepted',
        adminMessage: 'Assigned by administrator.'
      });else await adminApi.sendTechnicianRequestMessage(requestId, message);
      toast.success(suspend ? 'Account status updated.' : action === 'assign' ? 'Technician assigned to job.' : 'Message sent.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return <Modal show centered onHide={() => !busy && onClose()} dialogClassName="to-modal to-action-modal" aria-labelledby="to-action-title"><Modal.Header><Modal.Title id="to-action-title">{title}</Modal.Title><button className="to-icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><FiX /></button></Modal.Header><form onSubmit={submit}><Modal.Body>
    <p className="to-muted">{technician.name} · {technician.technicianId}</p>
    {error && <div role="alert" className="to-alert to-error">{error}</div>}
    {suspend ? <p>{restoring ? 'Restore access for this technician?' : 'This technician will lose account access until an administrator restores it.'}</p> : loading ? <p>Loading job conversations…</p> : <><label className="to-field"><span>{action === 'assign' ? 'Select an open job request' : 'Job conversation'}</span><select required value={requestId} onChange={e => setRequestId(e.target.value)}><option value="">Select job</option>{requests.map(r => <option key={r._id} value={r._id}>{r.job?.title || 'Job'} · {r.status}</option>)}</select></label>{requests.length === 0 && <p className="to-muted">{action === 'assign' ? 'This technician has no pending requests for open jobs.' : 'No job conversations are available for this technician.'} <Link to="/technician-jobs">View technician jobs</Link></p>}{action === 'message' && <label className="to-field"><span>Message</span><textarea required maxLength={2000} rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message…" /></label>}</>}
  </Modal.Body><Modal.Footer><button type="button" className="to-btn-neutral" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={`to-btn-primary${suspend && !restoring ? ' to-btn-danger' : ''}`} disabled={busy || !suspend && (!requestId || loading)}>{busy ? 'Saving…' : title}</button></Modal.Footer></form></Modal>;
}
export default function TechnicianOverview() {
  const {
    can
  } = useAdminAuth();
  const canWrite = can('technician_jobs', 'write');
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateOpen, setDateOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [trades, setTrades] = useState(DEFAULT_TRADES);
  const [jobs, setJobs] = useState([]);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [techniciansRes, jobsRes] = await Promise.all([adminApi.getTechnicians(), adminApi.getTechnicianJobs()]);
      setRaw((techniciansRes.data || techniciansRes).technicians || []);
      setJobs((jobsRes.data || jobsRes).jobs || []);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let active = true;
    adminApi.getCategories().then(res => {
      const categories = (res.data || res).categories || [];
      if (active && categories.length) setTrades(categories.map(c => c.name));
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPage(1);
  };
  const matchesTab = (t, key) => key === 'all' || (key === 'suspended' ? t.accountStatus === 'suspended' : verification(t) === key);
  const counts = useMemo(() => Object.fromEntries(['all', 'approved', 'under_review', 'rejected', 'suspended'].map(key => [key, raw.filter(t => matchesTab(t, key)).length])), [raw]);
  const locations = [...new Set(raw.map(t => t.serviceArea).filter(Boolean))].sort();
  const services = [...new Set([...trades, ...raw.map(t => t.primaryService)].filter(Boolean))].sort();
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const result = raw.filter(t => {
      const joinDate = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-CA') : '';
      return matchesTab(t, tab) && (!q || [t.name, t.email, t.phone, t.technicianId, t.primaryService, ...(t.skills || [])].join(' ').toLowerCase().includes(q)) && (filters.verification === 'all' || verification(t) === filters.verification) && (filters.availability === 'all' || availability(t) === filters.availability) && (filters.service === 'all' || t.primaryService === filters.service) && (filters.location === 'all' || t.serviceArea === filters.location) && (filters.rating === 'all' || t.rating != null && Number(t.rating) >= Number(filters.rating)) && (filters.performance === 'all' || t.performance != null && Number(t.performance) >= Number(filters.performance)) && (filters.account === 'all' || t.accountStatus === filters.account) && (!filters.from || joinDate && joinDate >= filters.from) && (!filters.to || joinDate && joinDate <= filters.to);
    });
    return result.sort((a, b) => filters.sort === 'name' ? a.name.localeCompare(b.name) : filters.sort === 'jobs' ? b.totalJobsDone - a.totalJobsDone : filters.sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) : filters.sort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt));
  }, [raw, filters, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageNumbers = Array.from({
    length: totalPages
  }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - currentPage) < 2);
  const clear = () => {
    setFilters(initialFilters);
    setTab('all');
    setPage(1);
  };
  const filter = (key, label, options) => <label className="to-filter-group" key={key}><span>{label}</span><select value={filters[key]} onChange={e => updateFilter(key, e.target.value)}><option value="all">All</option>{options.map(o => <option key={Array.isArray(o) ? o[0] : o} value={Array.isArray(o) ? o[0] : o}>{Array.isArray(o) ? o[1] : o}</option>)}</select></label>;
  const selected = modal?.technician;
  if (['profile', 'full-profile'].includes(modal?.type) && selected) {
    return <div className="to-page"><TechnicianProfileModal technician={selected} jobs={jobs} canWrite={canWrite} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'edit', technician: selected })} /></div>;
  }
  return <div className="to-page">
    <div className="to-page-header"><div><div className="to-breadcrumb">Field Operations <FiChevronRight /> <span>Technicians</span></div><h1>Technician’s Overview</h1><p>{loading ? 'Loading technicians…' : `${raw.length.toLocaleString()} technicians registered on this platform,`} Manage and monitor all technicians on the platform.</p></div><div className="to-header-actions"><button className="to-btn-primary" disabled={!canWrite} onClick={() => setModal({
          type: 'add'
        })}><FiPlus /> Add Technician</button><button className="to-btn-soft" disabled={!canWrite} onClick={() => setModal({
          type: 'invite'
        })}><FiUserPlus /> Invite Technician</button></div></div>
    <section className="to-filter-card" aria-label="Filter technicians"><div className="to-search-row"><div className="to-search-wrap"><input aria-label="Search technicians" placeholder="Search by name or ID" value={filters.search} onChange={e => updateFilter('search', e.target.value)} /><span className="to-search-symbol"><FiSearch /></span></div><label className="to-sort-wrap"><FiFilter /><select aria-label="Sort technicians" value={filters.sort} onChange={e => updateFilter('sort', e.target.value)}><option value="newest">Sort: Newest</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="rating">Highest rating</option><option value="jobs">Most jobs</option></select></label></div><div className="to-filters-row">
      {filter('verification', 'Verification Status', ['approved', 'under_review', 'rejected', 'pending'].map(s => [s, labels[s]]))}
      {filter('availability', 'Availability', ['online', 'offline', 'invited', 'blocked'].map(s => [s, labels[s]]))}
      {filter('service', 'Service / Category', services)}{filter('location', 'Location', locations)}
      {filter('rating', 'Rating', [['4.5', '4.5 & above'], ['4', '4 & above'], ['3', '3 & above']])}
      {filter('performance', 'Performance', [['90', '90% & above'], ['75', '75% & above'], ['50', '50% & above']])}
      {filter('account', 'Account Status', ['active', 'invited', 'suspended', 'blocked'].map(s => [s, labels[s]]))}
    </div><div className="to-date-row"><div><span className="to-filter-label">Join Date</span><button className="to-date-btn" aria-expanded={dateOpen} onClick={() => setDateOpen(v => !v)}><FiCalendar />{filters.from || filters.to ? `${filters.from || 'Start'} — ${filters.to || 'Today'}` : 'Select Date Range'}</button></div><button className="to-btn-primary" onClick={clear}><FiX /> Clear Filters</button></div>{dateOpen && <div className="to-date-inputs"><label>From<input type="date" value={filters.from} max={filters.to || undefined} onChange={e => updateFilter('from', e.target.value)} /></label><label>To<input type="date" value={filters.to} min={filters.from || undefined} onChange={e => updateFilter('to', e.target.value)} /></label></div>}</section>
    <div className="to-tabs" aria-label="Technician status">{[['all', 'All'], ['approved', 'Verified'], ['under_review', 'Under Review'], ['rejected', 'Action Required'], ['suspended', 'Suspended']].map(([key, label]) => <button key={key} aria-pressed={tab === key} className={`to-tab${tab === key ? ' active' : ''}`} onClick={() => {
        setTab(key);
        setPage(1);
      }}>{label} <span>{counts[key].toLocaleString()}</span></button>)}</div>
    <div className="to-table-card" aria-busy={loading}>{loading ? <div className="to-empty" role="status"><div className="spinner-border spinner-border-sm" />Loading technicians…</div> : loadError ? <div className="to-empty" role="alert"><p>{loadError}</p><button className="to-btn-outline" onClick={load}>Try again</button></div> : <div className="to-table-scroll"><table className="to-table"><thead><tr>{['Technician Name', 'Service / Trade', 'Verification', 'Availability', 'Ratings', 'Jobs', 'Performance', 'Account Status', ''].map((label, i) => <th scope="col" key={i}>{label || <span className="visually-hidden">Actions</span>}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={9}><div className="to-empty"><FiUsers /><strong>No technicians found</strong><span>Try adjusting your filters or add a technician.</span></div></td></tr> : rows.map(t => <tr key={t._id}>
      <td><button className="to-tech-cell" onClick={() => setModal({
                  type: 'profile',
                  technician: t
                })}><Avatar technician={t} /><span><strong>{t.name}</strong><small title={t.technicianId}>{t.technicianId}</small></span></button></td><td className="to-trade">{t.primaryService || '—'}</td><td><Badge status={verification(t)} /></td><td><Badge status={availability(t)} /></td><td><Rating technician={t} /></td><td className="to-number">{t.totalJobsDone}</td><td className="to-number"><strong>{t.performance == null ? 'NA' : `${t.performance}%`}</strong></td><td><Badge status={t.accountStatus} /></td><td><Dropdown align="end"><Dropdown.Toggle className="to-menu-toggle" variant="link" aria-label={`Actions for ${t.name}`}><FiMoreVertical /></Dropdown.Toggle><Dropdown.Menu className="to-action-menu" popperConfig={{
                    strategy: 'fixed'
                  }}>
        <Dropdown.Item disabled={!canWrite} onClick={() => setModal({
                      type: 'edit',
                      technician: t
                    })}><FiEdit2 /> Edit Profile</Dropdown.Item>
        <Dropdown.Item disabled={!canWrite || t.accountStatus !== 'active'} onClick={() => setModal({
                      type: 'assign',
                      technician: t
                    })}><FiClipboard /> Assign to Job</Dropdown.Item>
        <Dropdown.Item as={Link} disabled={!can('technician_verification', 'read')} to={`/technician-verification?technician=${t._id}`}><FiShield /> Verify Documents</Dropdown.Item>
        <Dropdown.Item disabled={!canWrite} onClick={() => setModal({
                      type: 'message',
                      technician: t
                    })}><FiMessageSquare /> Message Technician</Dropdown.Item>
        {t.accountStatus === 'invited' && <Dropdown.Item disabled={!canWrite} onClick={() => setModal({
                      type: 'invite',
                      technician: t
                    })}><FiUserPlus /> Send Invitation</Dropdown.Item>}
        <Dropdown.Divider /><Dropdown.Item className="to-text-danger" disabled={!canWrite} onClick={() => setModal({
                      type: 'suspend',
                      technician: t
                    })}><FiUserX /> {['suspended', 'blocked'].includes(t.accountStatus) ? 'Restore Account' : 'Suspend Account'}</Dropdown.Item>
      </Dropdown.Menu></Dropdown></td>
    </tr>)}</tbody></table></div>}</div>
    {!loading && !loadError && <div className="to-pagination"><span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length.toLocaleString()} technicians</span><nav aria-label="Technician pages"><button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><FiChevronLeft /></button>{pageNumbers.map((n, i) => <React.Fragment key={n}>{i > 0 && n - pageNumbers[i - 1] > 1 && <span>…</span>}<button className={currentPage === n ? 'active' : ''} aria-current={currentPage === n ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button></React.Fragment>)}<button aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><FiChevronRight /></button></nav><select aria-label="Technicians per page" value={pageSize} onChange={e => {
        setPageSize(Number(e.target.value));
        setPage(1);
      }}>{[10, 25, 50].map(s => <option key={s} value={s}>{s} per page</option>)}</select></div>}
    {['add', 'edit'].includes(modal?.type) && <TechnicianFormModal technician={selected} trades={services} onClose={() => setModal(null)} onSaved={load} />}
    {modal?.type === 'invite' && <InviteModal technician={selected} onClose={() => setModal(null)} />}
    {['assign', 'message', 'suspend'].includes(modal?.type) && <ActionModal action={modal.type} technician={selected} onClose={() => setModal(null)} onSaved={load} />}
  </div>;
}
