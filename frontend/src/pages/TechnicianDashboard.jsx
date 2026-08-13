import React, { useEffect, useRef, useState } from 'react';

const BASE = 'http://localhost:5000/api';

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

const card = {
  border: '1px solid #e9e0d5', borderRadius: 12, padding: '1rem 1.25rem',
  background: '#fff', marginBottom: 12,
};

const btn = (bg = '#1a1208', disabled = false) => ({
  background: disabled ? '#ccc' : bg,
  color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 18px', fontWeight: 700, fontSize: '0.85rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const TechnicianDashboard = () => {
  const [jobs, setJobs]         = useState([]);
  const [myJobs, setMyJobs]     = useState([]); // assigned jobs for this tech
  const [requests, setRequests] = useState([]);
  const [summary, setSummary]   = useState({
    totalJobsDone: 0, totalEarnings: 0, totalWithdrawn: 0, availableBalance: 0,
  });
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [reuploadingDoc, setReuploadingDoc] = useState(null); // documentId being uploaded

  // Profile image upload
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage]           = useState(false);
  const imageInputRef = useRef(null);

  const apiHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('1App_token')}`,
  });

  const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    ...apiHeaders(),
  });

  const loadData = async () => {
    try {
      const token = localStorage.getItem('1App_token');
      if (!token) return;

      const [dashRes, jobsRes, profileRes] = await Promise.all([
        fetch(`${BASE}/technician/dashboard`,      { headers: jsonHeaders() }),
        fetch(`${BASE}/technician/jobs`,           { headers: jsonHeaders() }),
        fetch(`${BASE}/technician-auth/me`,        { headers: jsonHeaders() }),
      ]);

      const dashData    = await dashRes.json();
      const jobsData    = await jobsRes.json();
      const profileData = await profileRes.json();

      if (dashData.success) {
        const tech = dashData.data.technician;
        setSummary({
          totalJobsDone:    tech.totalJobsDone    || 0,
          totalEarnings:    tech.totalEarnings    || 0,
          totalWithdrawn:   tech.totalWithdrawn   || 0,
          availableBalance: tech.availableBalance || 0,
        });
        setRequests(dashData.data.requests || []);
      }

      if (jobsData.success) setJobs(jobsData.data.jobs || []);

      if (profileData.success) {
        const u = profileData.data.user;
        setProfile(u);
        const img = u.profileImage?.url || u.technicianProfile?.photoUrl || '';
        if (img) setProfileImagePreview(img);
      }

      // Derive assigned jobs: accepted requests where job still exists
      if (dashData.success) {
        const accepted = (dashData.data.requests || [])
          .filter((r) => r.status === 'accepted' && r.job);
        setMyJobs(accepted.map((r) => r.job));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);


  // ── Profile image ────────────────────────────────────────────────────────────
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    const file = imageInputRef.current?.files[0];
    if (!file) return alert('Please select an image first');
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('profileImage', file);
      const res = await fetch(`${BASE}/technician-auth/upload-profile-image`, {
        method: 'POST',
        headers: apiHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        alert('Profile image updated!');
        setProfileImagePreview(data.data.profileImageUrl);
      } else {
        alert(data.message || 'Upload failed');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Job actions ──────────────────────────────────────────────────────────────
  const requestJob = async (jobId) => {
    try {
      const res = await fetch(`${BASE}/technician/jobs/${jobId}/request`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ note: 'I am interested in this job and can complete it efficiently.' }),
      });
      const data = await res.json();
      alert(data.message || 'Request sent');
      if (data.success) loadData();
    } catch { alert('Unable to request this job'); }
  };

  const markReached = async (jobId) => {
    try {
      const res = await fetch(`${BASE}/technician/jobs/${jobId}/reached`, {
        method: 'PATCH', headers: jsonHeaders(),
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Reached location recorded!' : 'Failed'));
      if (data.success) loadData();
    } catch { alert('Failed to mark reached'); }
  };

  const markCompleted = async (jobId) => {
    if (!window.confirm('Mark this job as completed? Admin will be notified.')) return;
    try {
      const res = await fetch(`${BASE}/technician/jobs/${jobId}/complete`, {
        method: 'PATCH', headers: jsonHeaders(),
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Job completion recorded!' : 'Failed'));
      if (data.success) loadData();
    } catch { alert('Failed to mark completed'); }
  };

  const withdraw = async () => {
    const amount = Number(prompt('Enter amount to withdraw', summary.availableBalance || 0));
    if (!amount) return;
    try {
      const res = await fetch(`${BASE}/technician/withdraw`, {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ amount, method: 'bank-transfer', details: 'Bank transfer withdrawal' }),
      });
      const data = await res.json();
      alert(data.message || 'Withdrawal requested');
      if (data.success) loadData();
    } catch { alert('Withdrawal failed'); }
  };

  const reuploadDocument = async (documentId, file) => {
    if (!file) return;
    setReuploadingDoc(documentId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE}/technician-auth/documents/${documentId}`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: fd,
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Document re-uploaded!' : 'Upload failed'));
      if (data.success) loadData();
    } catch { alert('Re-upload failed'); } finally {
      setReuploadingDoc(null);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Loading technician dashboard…</div>;


  const tabStyle = (key) => ({
    padding: '8px 18px', border: 'none', borderRadius: '8px 8px 0 0',
    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
    background: activeTab === key ? '#1a1208' : 'transparent',
    color: activeTab === key ? '#fff' : '#6c757d',
    borderBottom: activeTab === key ? '3px solid #A5732F' : '3px solid transparent',
  });

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h2 style={{ fontWeight: 800, color: '#1a1208', marginBottom: 4 }}>Technician Dashboard</h2>

      {/* ── Profile image section ──────────────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {profileImagePreview ? (
            <img src={profileImagePreview} alt="Profile"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                border: '3px solid #A5732F' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#A5732F,#d4a050)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.8rem', fontWeight: 800, border: '3px solid #A5732F' }}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1208' }}>{profile?.name || 'Technician'}</div>
          <div style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: 8 }}>{profile?.email || ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ ...btn('#A5732F'), display: 'inline-block', cursor: 'pointer' }}>
              {profileImagePreview ? '📷 Change Photo' : '📷 Upload Photo'}
              <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
            </label>
            {imageInputRef.current?.files?.[0] && (
              <button style={btn('#16a34a', uploadingImage)} onClick={handleUploadImage} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : '✓ Save Photo'}
              </button>
            )}
          </div>
          {profileImagePreview && !imageInputRef.current?.files?.[0] && (
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 4 }}>✓ Profile photo set</div>
          )}
        </div>
      </div>

      {/* ── Earnings summary ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Jobs',    value: summary.totalJobsDone,    color: '#1a1208' },
          { label: 'Total Earned',  value: `$${summary.totalEarnings}`, color: '#A5732F' },
          { label: 'Withdrawn',     value: `$${summary.totalWithdrawn}`, color: '#dc3545' },
          { label: 'Available',     value: `$${summary.availableBalance}`, color: '#16a34a' },
        ].map((s) => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <button style={{ ...btn('#1a1208'), marginBottom: 20 }} onClick={withdraw}>
        💸 Withdraw Amount
      </button>


      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #f0e8dc', marginBottom: 20 }}>
        {[
          { key: 'open',      label: `Open Jobs (${jobs.length})` },
          { key: 'my',        label: `My Jobs (${myJobs.length})` },
          { key: 'requests',  label: `My Requests (${requests.length})` },
          { key: 'documents', label: 'My Documents' },
        ].map((t) => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Open Jobs ───────────────────────────────────────────────────── */}
      {activeTab === 'open' && (
        <div>
          <h4 style={{ fontWeight: 700, marginBottom: 12 }}>Available Jobs</h4>
          {jobs.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No open jobs right now.</div>
          ) : jobs.map((job) => (
            <div key={job._id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1208' }}>{job.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{job.category} &nbsp;·&nbsp; {job.location}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: '#A5732F', fontSize: '1.05rem' }}>${job.budget}</div>
                  {job.estimatedTime && (
                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>⏱ {job.estimatedTime}</div>
                  )}
                </div>
              </div>
              <p style={{ color: '#495057', fontSize: '0.875rem', margin: '8px 0' }}>{job.description}</p>
              {job.deadline && (
                <div style={{ fontSize: '0.75rem', color: '#dc3545', marginBottom: 8 }}>
                  📅 Deadline: {new Date(job.deadline).toLocaleDateString('en-IN')}
                </div>
              )}
              <button style={btn('#1a1208')} onClick={() => requestJob(job._id)}>Request Job</button>
            </div>
          ))}
        </div>
      )}

      {/* ── My Assigned Jobs ────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <div>
          <h4 style={{ fontWeight: 700, marginBottom: 12 }}>My Assigned Jobs</h4>
          {myJobs.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No jobs assigned to you yet.</div>
          ) : myJobs.map((job) => {
            const alreadyReached   = !!job.reachedAt;
            const alreadyCompleted = !!job.jobCompletedAt;
            return (
              <div key={job._id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1208' }}>{job.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{job.category} &nbsp;·&nbsp; {job.location}</div>
                  </div>
                  <div>
                    <span style={{
                      padding: '3px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                      background: job.status === 'in-progress' ? 'rgba(37,99,235,0.12)' :
                                  job.status === 'completed'   ? 'rgba(22,163,74,0.12)' : 'rgba(165,115,47,0.12)',
                      color:      job.status === 'in-progress' ? '#2563eb' :
                                  job.status === 'completed'   ? '#16a34a' : '#A5732F',
                    }}>
                      {job.status}
                    </span>
                  </div>
                </div>

                {job.estimatedTime && (
                  <div style={{ fontSize: '0.8rem', color: '#A5732F', fontWeight: 600, margin: '6px 0' }}>
                    ⏱ Estimated: {job.estimatedTime}
                  </div>
                )}

                {/* Timeline info */}
                {(alreadyReached || alreadyCompleted) && (
                  <div style={{ background: '#fdf9f5', borderRadius: 8, padding: '8px 12px', margin: '8px 0',
                    border: '1px solid #f0e8dc', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {alreadyReached && (
                      <div><span style={{ color: '#2563eb', fontWeight: 700 }}>📍 Reached:</span> {fmtDT(job.reachedAt)}</div>
                    )}
                    {alreadyCompleted && (
                      <div><span style={{ color: '#16a34a', fontWeight: 700 }}>✅ Completed:</span> {fmtDT(job.jobCompletedAt)}</div>
                    )}
                    {job.jobDurationMinutes != null && (
                      <div><span style={{ color: '#A5732F', fontWeight: 700 }}>⏱ Duration:</span> {formatDuration(job.jobDurationMinutes)}</div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  {!alreadyReached && job.status !== 'completed' && (
                    <button style={btn('#2563eb')} onClick={() => markReached(job._id)}>
                      📍 I Reached the Location
                    </button>
                  )}
                  {alreadyReached && !alreadyCompleted && job.status !== 'completed' && (
                    <button style={btn('#16a34a')} onClick={() => markCompleted(job._id)}>
                      ✅ Mark Job Completed
                    </button>
                  )}
                  {alreadyCompleted && (
                    <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 700, padding: '8px 0' }}>
                      ✓ Waiting for admin to close job & process payment
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* ── My Requests ─────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div>
          <h4 style={{ fontWeight: 700, marginBottom: 12 }}>My Job Requests</h4>
          {requests.length === 0 ? (
            <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No requests yet.</div>
          ) : requests.map((req) => (
            <div key={req._id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1a1208' }}>{req.job?.title || 'Job'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{req.job?.location || ''}</div>
                </div>
                <span style={{
                  padding: '3px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                  background:
                    req.status === 'accepted'      ? 'rgba(22,163,74,0.12)' :
                    req.status === 'rejected'      ? 'rgba(220,53,69,0.1)'  :
                    req.status === 'counter-offer' ? 'rgba(234,179,8,0.15)' : 'rgba(108,117,125,0.1)',
                  color:
                    req.status === 'accepted'      ? '#16a34a' :
                    req.status === 'rejected'      ? '#dc3545' :
                    req.status === 'counter-offer' ? '#b45309' : '#6c757d',
                }}>
                  {req.status
                    ? req.status.charAt(0).toUpperCase() + req.status.slice(1)
                    : 'Pending'}
                </span>
              </div>
              {req.job?.estimatedTime && (
                <div style={{ fontSize: '0.8rem', color: '#A5732F', fontWeight: 600, marginTop: 4 }}>
                  ⏱ Est. {req.job.estimatedTime}
                </div>
              )}
              {req.note && (
                <p style={{ color: '#6c757d', fontSize: '0.82rem', margin: '6px 0 0', fontStyle: 'italic' }}>
                  "{req.note}"
                </p>
              )}
              {req.adminMessage && (
                <div style={{ background: '#fdf9f5', borderRadius: 8, padding: '6px 10px', marginTop: 6,
                  border: '1px solid #f0e8dc', fontSize: '0.82rem', color: '#495057' }}>
                  <strong>Admin:</strong> {req.adminMessage}
                </div>
              )}
              {req.amountEarned > 0 && (
                <div style={{ marginTop: 6, fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>
                  💰 Earned: ${req.amountEarned}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── My Documents ────────────────────────────────────────────────── */}
      {activeTab === 'documents' && (() => {
        const docs = profile?.technicianProfile?.documents || [];
        const statusColor = { approved: '#16a34a', rejected: '#dc3545', pending: '#b45309' };
        const statusIcon  = { approved: '✓', rejected: '✗', pending: '⏳' };
        return (
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: 12 }}>My Documents</h4>
            {docs.length === 0 ? (
              <div style={{ color: '#adb5bd', padding: '2rem', textAlign: 'center' }}>No documents uploaded yet.</div>
            ) : docs.map((doc) => (
              <div key={doc.documentId} style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#1a1208', marginBottom: 4 }}>{doc.label || doc.documentId}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                    background: doc.status === 'approved' ? 'rgba(22,163,74,0.1)' :
                                doc.status === 'rejected' ? 'rgba(220,53,69,0.1)' : 'rgba(180,83,9,0.1)',
                    color: statusColor[doc.status] || '#6c757d' }}>
                    {statusIcon[doc.status]} {doc.status}
                  </div>
                  {doc.status === 'rejected' && doc.rejectionReason && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: '#fff5f5',
                      border: '1px solid #fecaca', borderRadius: 8, fontSize: '0.82rem', color: '#dc3545' }}>
                      <strong>Reason:</strong> {doc.rejectionReason}
                    </div>
                  )}
                </div>
                {doc.status === 'rejected' && (
                  <label style={{ ...btn('#A5732F'), display: 'inline-block', cursor: 'pointer',
                    opacity: reuploadingDoc === doc.documentId ? 0.6 : 1 }}>
                    {reuploadingDoc === doc.documentId ? 'Uploading…' : '↑ Re-upload'}
                    <input
                      type="file"
                      hidden
                      disabled={reuploadingDoc === doc.documentId}
                      onChange={(e) => reuploadDocument(doc.documentId, e.target.files[0])}
                    />
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
