import React, { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';

export default function JobInvitationModal({ job, onClose, onSent }) {
  const [technicians, setTechnicians] = useState([]);
  const [requests, setRequests] = useState([]);
  const [technicianId, setTechnicianId] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    Promise.all([adminApi.getTechnicians(), adminApi.getTechnicianRequests()]).then(([people, response]) => {
      if (!active) return;
      setTechnicians((people.data?.technicians || []).filter(t => t.accountStatus === 'active'));
      setRequests((response.data?.requests || []).filter(r => String(r.job?._id || r.job) === job._id && r.initiatedBy === 'admin'));
    }).catch(err => { if (active) setError(err.response?.data?.message || 'Could not load technicians.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [job._id, retry]);
  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await adminApi.sendJobInvitation(job._id, { technicianId, message });
      toast.success('Job request sent. Waiting for the technician to accept.'); onSent(); onClose();
    } catch (err) { setError(err.response?.data?.message || 'Could not send the invitation.'); }
    finally { setSaving(false); }
  };
  const matches = technicians.filter(t => [t.name, t.phone, t.primaryService].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <Modal show centered size="lg" onHide={() => !saving && onClose()} backdrop={saving ? 'static' : true} aria-labelledby="job-invitation-title">
    <Modal.Header closeButton={!saving}><Modal.Title id="job-invitation-title">Assign Technician</Modal.Title></Modal.Header>
    <form onSubmit={submit}><Modal.Body>
      <h5>{job.title}</h5><p className="text-muted">{job.location}</p>
      <div className="alert alert-light border">Send a request to a technician. This job stays unassigned until they accept. They can also reject the request.</div>
      {error && <div role="alert" className="alert alert-danger">{error} <button type="button" className="btn btn-link btn-sm" disabled={saving} onClick={() => setRetry(n => n + 1)}>Reload list</button></div>}
      <label htmlFor="invite-technician-search" className="tj-label">Search Technicians</label><input id="invite-technician-search" className="form-control tj-input mb-3" placeholder="Name, phone or service" value={search} onChange={e => { setSearch(e.target.value); setTechnicianId(''); }} disabled={saving} />
      <label htmlFor="invite-technician" className="tj-label">Technician</label><select id="invite-technician" className="form-select tj-input mb-3" required disabled={loading || saving} value={technicianId} onChange={e => setTechnicianId(e.target.value)}><option value="">{loading ? 'Loading…' : 'Select technician'}</option>{matches.map(t => <option key={t._id} value={t._id} disabled={requests.some(r => String(r.technician?._id || r.technician) === t._id)}>{t.name} · {t.primaryService || 'Technician'} · {t.phone}{requests.some(r => String(r.technician?._id || r.technician) === t._id) ? ' (already invited)' : ''}</option>)}</select>
      {!loading && !matches.length && <p className="text-muted">No active technicians match your search.</p>}
      <label htmlFor="invite-message" className="tj-label">Message (optional)</label><textarea id="invite-message" className="form-control tj-input" rows={3} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} disabled={saving} placeholder="Add job instructions for the technician…" />
      {requests.length > 0 && <div className="mt-4"><h6>Sent Requests</h6><ul className="list-group">{requests.map(r => <li className="list-group-item d-flex justify-content-between" key={r._id}><span>{r.technician?.name || 'Technician'}</span><span>{r.status === 'pending' ? 'Awaiting technician response' : r.status === 'accepted' ? 'Accepted' : 'Declined / unavailable'}</span></li>)}</ul></div>}
    </Modal.Body><Modal.Footer><button type="button" className="btn tj-btn-ghost" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn tj-btn-primary-gold" disabled={saving || loading || !technicianId}>{saving ? 'Sending…' : 'Send Job Request'}</button></Modal.Footer></form>
  </Modal>;
}
