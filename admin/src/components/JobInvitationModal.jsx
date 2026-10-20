import { kilometersToMiles, formatMiles } from '../utils/distance';
import React, { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
import { getImageUrl } from '../utils/helpers';
import { presenceOnline, lastActiveText } from '../utils/technicianPresence';
import { FiBriefcase, FiMapPin, FiStar, FiSearch, FiSliders, FiHome, FiFileText, FiCalendar, FiSend } from 'react-icons/fi';
import '../styles/JobInvitationModal.css';
import { sortTechnicians, TECHNICIAN_SORT_OPTIONS } from '../utils/technicianSort';

function TechnicianAvatar({ name, photoUrl }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <div className="route-tech-photo" aria-hidden="true">{photoUrl && !failed ? <img src={getImageUrl(photoUrl)} alt="" onError={() => setFailed(true)} /> : initials}</div>;
}

export default function JobInvitationModal({ job, onClose, onSent }) {
  const [technicians, setTechnicians] = useState([]);
  const [now, setNow] = useState(Date.now);
  const [requests, setRequests] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('best_match');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState('available');
  const [service, setService] = useState('');
  const [radius, setRadius] = useState('');
  const [rating, setRating] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const schedule = job.jobDate?.from || job.scheduledDate;
  const scheduleText = schedule && Number.isFinite(new Date(schedule).getTime()) ? new Date(schedule).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled';
  const workLabel = [job.workType?.name, job.additionalWorkType?.name].filter(Boolean).join(' / ') || job.category || 'Matching work';
  const toggle = (id) => setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setSelectedIds([]); setTechnicians([]); setRequests([]);
    Promise.all([adminApi.getJobRoutingCandidates(job._id), adminApi.getTechnicianRequests()]).then(([people, response]) => {
      if (!active) return;
      setTechnicians((people.data?.technicians || []).filter(t => ['active', 'online', 'offline'].includes(t.accountStatus)));
      setRequests((response.data?.requests || []).filter(r => String(r.job?._id || r.job) === job._id && r.initiatedBy === 'admin'));
    }).catch(err => { if (active) setError(err.response?.data?.message || 'Could not load technicians.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [job._id, retry]);
  useEffect(() => {
    let active = true;
    const onPresence = ({ technicianId, isOnline, lastActiveAt }) => {
      setTechnicians(previous => previous.map(t => String(t._id) === String(technicianId)
        ? { ...t, isOnline, lastActiveAt } : t));
      setNow(Date.now());
    };
    const refresh = () => {
      adminApi.getJobRoutingCandidates(job._id).then(response => {
        if (active) setTechnicians((response.data?.technicians || []).filter(t => ['active', 'online', 'offline'].includes(t.accountStatus)));
      }).catch(() => {});
    };
    socket.on('technician:presence', onPresence);
    socket.on('connect', refresh);
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      active = false;
      clearInterval(timer);
      socket.off('technician:presence', onPresence);
      socket.off('connect', refresh);
    };
  }, [job._id]);
  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await adminApi.sendJobInvitation(job._id, { technicianIds: selectedIds, message });
      toast.success(job.assignedTechnician?.name ? 'Replacement request sent. Admin must reopen the job before a replacement can accept.' : `${selectedIds.length} job request${selectedIds.length === 1 ? '' : 's'} sent. Waiting for acceptance.`); onSent(); onClose();
    } catch (err) { setError(err.response?.data?.message || 'Could not send the invitation.'); }
    finally { setSaving(false); }
  };
  const services = [...new Set(technicians.map(t => t.primaryService).filter(Boolean))];
  const matches = sortTechnicians(technicians, sort).filter(t =>
    (tab !== 'selected' || selectedIds.includes(t._id)) &&
    [t.name, t.phone, t.primaryService, t.serviceArea].join(' ').toLowerCase().includes(search.trim().toLowerCase()) &&
    (!service || t.primaryService === service) &&
    (!radius || (t.distanceKm != null && kilometersToMiles(t.distanceKm) <= Number(radius))) &&
    (!rating || (t.ratingCount > 0 && t.rating != null && t.rating >= Number(rating))) &&
    (!onlineOnly || presenceOnline(t, now)));
  const bulkAction = action => {
    if (action === 'all') setSelectedIds(ids => [...new Set([...ids, ...matches.filter(t => !t.alreadyInvited && !t.isCurrentTechnician).map(t => t._id)])]);
    if (action === 'clear') setSelectedIds([]);
  };
  return <Modal show centered size="xl" dialogClassName="route-technician-dialog" onHide={() => !saving && onClose()} backdrop={saving ? 'static' : true} aria-labelledby="job-invitation-title">
    <Modal.Header closeButton={!saving}><div><Modal.Title id="job-invitation-title">Route Technician</Modal.Title><p className="route-subtitle">Assign the best technician(s) based on completed work, skills and availability.</p></div></Modal.Header>
    <form onSubmit={submit} className="route-form"><Modal.Body>
      <div className="route-job-summary">
        <div className="route-summary-card route-summary-main"><span className="route-summary-icon"><FiHome /></span><div><strong>{job.title}</strong><small><FiMapPin /> {job.location || 'Location not provided'}</small></div></div>
        <div className="route-summary-card"><span className="route-summary-icon"><FiFileText /></span><div><small>Job ID</small><strong>#{job.jobId || String(job._id).slice(-8).toUpperCase()}</strong></div></div>
        <div className="route-summary-card"><span className="route-summary-icon"><FiBriefcase /></span><div><small>Service Type</small><strong>{workLabel}</strong></div></div>
        <div className="route-summary-card"><span className="route-summary-icon"><FiCalendar /></span><div><small>Preferred Date</small><strong>{scheduleText}</strong></div></div>
      </div>
      {job.assignedTechnician?.name && <p className="route-notice">{job.assignedTechnician.name} stays assigned. Reopen the job before a replacement can accept.</p>}
      {error && <div role="alert" className="alert alert-danger">{error} <button type="button" className="btn btn-link btn-sm" disabled={saving} onClick={() => setRetry(n => n + 1)}>Reload list</button></div>}
      <div className="route-tabs-bar">
        <div className="route-tabs" role="tablist" aria-label="Technician lists">
          <button type="button" role="tab" aria-selected={tab === 'available'} className={tab === 'available' ? 'active' : ''} onClick={() => setTab('available')}>Available Technicians <span>{technicians.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'selected'} className={tab === 'selected' ? 'active' : ''} onClick={() => setTab('selected')}>Selected Technicians <span>{selectedIds.length}</span></button>
        </div>
        <label className="route-rank">Ranked by: <select aria-label="Sort technicians" value={sort} onChange={e => setSort(e.target.value)} disabled={saving}>{TECHNICIAN_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <fieldset disabled={saving} className="route-filters">
        <label className="route-search"><FiSearch /><input aria-label="Search technicians" placeholder="Search by name, phone or service…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label="Filter by service" value={service} onChange={e => setService(e.target.value)}><option value="">All Services</option>{services.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by distance" value={radius} onChange={e => setRadius(e.target.value)}><option value="">Any distance</option>{[5, 10, 25, 50, 100].map(value => <option key={value} value={value}>Within {value} miles</option>)}</select>
        <select aria-label="Filter by rating" value={rating} onChange={e => setRating(e.target.value)}><option value="">Any rating</option>{[3, 4, 4.5].map(value => <option key={value} value={value}>Rating {value.toFixed(1)}+</option>)}</select>
        <button type="button" aria-expanded={moreFilters} onClick={() => setMoreFilters(value => !value)}><FiSliders /> More Filters</button>
      </fieldset>
      {moreFilters && <div className="route-extra-filters"><label><input type="checkbox" checked={onlineOnly} disabled={saving} onChange={e => setOnlineOnly(e.target.checked)} /> Online technicians only</label><button type="button" disabled={saving} onClick={() => { setService(''); setRadius(''); setRating(''); setOnlineOnly(false); setSearch(''); }}>Reset filters</button><small>Distance uses saved addresses. Success score is completed ÷ (completed + cancelled assigned jobs).</small></div>}
      <div className="route-bulk"><span>{matches.length} technician{matches.length === 1 ? '' : 's'}</span><select aria-label="Bulk actions" value="" disabled={saving || loading} onChange={e => bulkAction(e.target.value)}><option value="">Bulk Actions</option><option value="all">Select all results</option><option value="clear">Clear selection</option></select></div>
      {loading ? <p role="status" className="route-empty">Loading matching technicians…</p> : <div className="route-technician-list">
        {matches.map(t => {
          const unavailable = t.alreadyInvited || t.isCurrentTechnician;
          const selected = selectedIds.includes(t._id);
          return <article className={`route-tech-card${selected ? ' is-selected' : ''}`} key={t._id} aria-label={t.name}>
            <div className="route-tech-person"><input type="checkbox" checked={selected} disabled={unavailable || saving} onChange={() => toggle(t._id)} aria-label={`Select ${t.name}`} /><TechnicianAvatar name={t.name} photoUrl={t.photoUrl} /><div className="route-tech-identity"><div className="route-tech-heading"><h3>{t.name}</h3><span className="route-tech-id">ID-{t.technicianId || String(t._id).slice(-6).toUpperCase()}</span></div><div className="route-tech-presence"><span className={`route-presence-badge ${presenceOnline(t, now) ? 'is-online' : 'is-offline'}`}><span aria-hidden="true">●</span> {presenceOnline(t, now) ? 'Online' : 'Offline'}</span><small title={t.lastActiveAt ? new Date(t.lastActiveAt).toLocaleString() : undefined}>{lastActiveText(t, now)}</small></div></div></div>
            <div className="route-tech-details"><div className="route-tech-metrics">
              <span className="route-rating"><FiStar /> {t.ratingCount > 0 && t.rating != null ? <>{Number(t.rating).toFixed(1)} <small>({t.ratingCount})</small></> : 'Not rated'}</span>
              <span><FiMapPin /> {t.distanceKm != null ? formatMiles(t.distanceKm) : 'Distance unavailable'}</span>
              <span className="route-metric-chip"><FiBriefcase /> Completed {t.completedJobCount} jobs</span>
              <span className="route-metric-chip" title={`${workLabel}: ${t.matchingJobCount} matching jobs`}><FiBriefcase /> <span className="route-work-name">{workLabel}</span></span>
            </div>{unavailable && <div className="route-tech-row-actions"><small>{t.isCurrentTechnician ? 'Currently assigned' : 'Request already sent'}</small></div>}</div>
          </article>;
        })}
        {!matches.length && <p className="route-empty">{tab === 'selected' ? 'No selected technicians match these filters.' : 'No technicians match these filters.'}</p>}
      </div>}
      <div className="route-message"><label htmlFor="invite-message">Message to technicians (optional)</label><textarea id="invite-message" rows={2} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} disabled={saving} placeholder="Add job instructions, special notes, or requirements…" /><span>{message.length}/500</span></div>
      {requests.length > 0 && <details className="route-sent"><summary>Sent Requests ({requests.length})</summary>{requests.map(r => <div key={r._id}><span>{r.technician?.name || 'Technician'}</span><span>{r.status === 'pending' ? 'Awaiting response' : r.status === 'accepted' ? 'Accepted' : 'Declined / unavailable'}</span></div>)}</details>}
    </Modal.Body><Modal.Footer><button type="button" className="route-cancel" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="route-send" disabled={saving || loading || !selectedIds.length}><FiSend /> {saving ? 'Sending…' : `Send Requests (${selectedIds.length})`}</button></Modal.Footer></form>
  </Modal>;
}
