import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import '../styles/TechnicianOverview.css';

// ── helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

const VerifBadge = ({ status }) => {
  const map = {
    approved:        { cls: 'to-badge-verified',  icon: '◎', label: 'Verified' },
    pending:         { cls: 'to-badge-pending',   icon: '✕', label: 'Pending' },
    rejected:        { cls: 'to-badge-action',    icon: '✕', label: 'Action Required' },
    under_review:    { cls: 'to-badge-review',    icon: '◎', label: 'Under Review' },
    suspended:       { cls: 'to-badge-suspended', icon: '✕', label: 'Suspended' },
  };
  const s = map[status?.toLowerCase()] || map.pending;
  return <span className={`to-badge ${s.cls}`}><span>{s.icon}</span>{s.label}</span>;
};

const AvailBadge = ({ online }) => (
  <span className={`to-badge ${online ? 'to-badge-online' : 'to-badge-offline'}`}>
    <span>•</span>{online ? 'Online' : 'Offline'}
  </span>
);

const AcctBadge = ({ status }) => {
  const map = {
    active:   { cls: 'to-badge-verified',  label: 'Active' },
    invited:  { cls: 'to-badge-invited',   label: 'Invited' },
    suspended:{ cls: 'to-badge-suspended', label: 'Suspended' },
    blocked:  { cls: 'to-badge-action',    label: 'Blocked' },
  };
  const s = map[status?.toLowerCase()] || { cls: 'to-badge-pending', label: status || '—' };
  return <span className={`to-badge ${s.cls}`}>{s.label}</span>;
};

const Stars = ({ rating, count }) => (
  <div className="to-stars">
    <span className="to-star">★</span>
    <span className="to-star-val">{rating ? Number(rating).toFixed(1) : 'NA'}</span>
    {count != null && <span className="to-star-count">({count})</span>}
  </div>
);

// ── map raw technician data from verification endpoint ─────────────────────────
const mapTech = (t, idx) => ({
  _id:            t._id,
  tkId:           `TK-${String(1001 + idx).padStart(4, '0')}`,
  name:           t.name || 'Unknown',
  email:          t.email || '',
  phone:          t.phone || '',
  trade:          (t.skills || []).join(', ') || t.experienceLevel || '—',
  verif:          t.verificationStatus || 'pending',
  online:         t.isOnline || false,
  rating:         t.rating || null,
  ratingCount:    t.ratingCount || null,
  jobs:           t.totalJobsDone ?? 'NA',
  performance:    t.performance != null ? `${t.performance}%` : 'NA',
  accountStatus:  t.accountStatus || 'active',
  joinDate:       t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '—',
});

const PAGE_SIZES = [10, 25, 50];

const TechnicianOverview = () => {
  const [raw, setRaw]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [verifFilter, setVerif] = useState('all');
  const [acctFilter, setAcct]   = useState('all');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTechnicianVerificationRequests();
      setRaw((res.data?.requests || []).map(mapTech));
    } catch {
      toast.error('Failed to load technicians');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── filter + search ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return raw.filter((t) => {
      const matchQ = !q || [t.name, t.email, t.phone, t.tkId, t.trade]
        .join(' ').toLowerCase().includes(q);
      const matchV = verifFilter === 'all' || t.verif === verifFilter;
      const matchA = acctFilter  === 'all' || t.accountStatus === acctFilter;
      return matchQ && matchV && matchA;
    });
  }, [raw, search, verifFilter, acctFilter]);

  // ── tab counts ───────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:          raw.length,
    verified:     raw.filter((t) => t.verif === 'approved').length,
    under_review: raw.filter((t) => t.verif === 'under_review').length,
    action:       raw.filter((t) => t.verif === 'rejected').length,
    suspended:    raw.filter((t) => t.accountStatus === 'suspended').length,
  }), [raw]);

  // ── pagination ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const goPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  const clearFilters = () => {
    setSearch(''); setVerif('all'); setAcct('all'); setPage(1);
  };

  const hasFilters = search || verifFilter !== 'all' || acctFilter !== 'all';

  // ── page numbers to show ─────────────────────────────────────────────────────
  const pageNums = () => {
    const nums = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push('…');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
      if (page < totalPages - 2) nums.push('…');
      nums.push(totalPages);
    }
    return nums;
  };

  return (
    <div className="to-page">

      {/* ── breadcrumb + header ── */}
      <div className="to-breadcrumb">Field Operations › <span>Technicians</span></div>
      <div className="to-page-header">
        <div>
          <h2 className="to-page-title">Technician's Overview</h2>
          <p className="to-page-sub">
            {raw.length.toLocaleString()} technicians registered on this platform.
            Manage and monitor all technicians on the platform.
          </p>
        </div>
        <div className="to-header-actions">
          <button className="to-btn-primary">+ Add Technician</button>
          <button className="to-btn-outline">👥 Invite Technician</button>
        </div>
      </div>

      {/* ── search + filters card ── */}
      <div className="to-filter-card">
        <div className="to-search-row">
          <div className="to-search-wrap">
            <span className="to-search-icon">🔍</span>
            <input
              className="to-search-input"
              placeholder="Search by name or ID"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="to-sort-btn">⊟ Sort ∨</button>
        </div>

        <div className="to-filters-row">
          <div className="to-filter-group">
            <label className="to-filter-label">Verification Status</label>
            <select className="to-filter-select" value={verifFilter}
              onChange={(e) => { setVerif(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="approved">Verified</option>
              <option value="under_review">Under Review</option>
              <option value="rejected">Action Required</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="to-filter-group">
            <label className="to-filter-label">Availability</label>
            <select className="to-filter-select">
              <option>All</option>
              <option>Online</option>
              <option>Offline</option>
            </select>
          </div>
          <div className="to-filter-group">
            <label className="to-filter-label">Service / Category</label>
            <select className="to-filter-select"><option>All</option></select>
          </div>
          <div className="to-filter-group">
            <label className="to-filter-label">Location</label>
            <select className="to-filter-select"><option>All</option></select>
          </div>
          <div className="to-filter-group">
            <label className="to-filter-label">Rating</label>
            <select className="to-filter-select"><option>All</option></select>
          </div>
          <div className="to-filter-group">
            <label className="to-filter-label">Performance</label>
            <select className="to-filter-select"><option>All</option></select>
          </div>
          <div className="to-filter-group">
            <label className="to-filter-label">Account Status</label>
            <select className="to-filter-select" value={acctFilter}
              onChange={(e) => { setAcct(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div className="to-date-row">
          <label className="to-filter-label">Join Date</label>
          <button className="to-date-btn">📅 Select Date Range</button>
          {hasFilters && (
            <button className="to-clear-btn" onClick={clearFilters}>✕ Clear Filters</button>
          )}
        </div>
      </div>

      {/* ── status tabs ── */}
      <div className="to-tabs">
        {[
          { key: 'all',          label: 'All',            count: counts.all },
          { key: 'approved',     label: 'Verified',       count: counts.verified },
          { key: 'under_review', label: 'Under Review',   count: counts.under_review },
          { key: 'rejected',     label: 'Action Required',count: counts.action },
          { key: 'suspended',    label: 'Suspended',      count: counts.suspended },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`to-tab${verifFilter === tab.key || (tab.key === 'all' && verifFilter === 'all') ? ' active' : ''}`}
            onClick={() => { setVerif(tab.key === 'all' ? 'all' : tab.key); setPage(1); }}
          >
            {tab.label} <span className="to-tab-count">{tab.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* ── table ── */}
      <div className="to-table-card">
        {loading ? (
          <div className="to-loading">
            <div className="spinner-border spinner-border-sm" style={{ color: '#A5732F' }} />
            <span>Loading technicians…</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="to-table">
              <thead>
                <tr>
                  <th>Technician Name</th>
                  <th>Service / Trade</th>
                  <th>Verification</th>
                  <th>Availability</th>
                  <th>Ratings</th>
                  <th>Jobs</th>
                  <th>Performance</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="to-empty">
                      <div>👷</div>
                      <span>No technicians found</span>
                    </td>
                  </tr>
                ) : (
                  paginated.map((t) => (
                    <tr key={t._id}>
                      <td>
                        <div className="to-tech-cell">
                          <div className="to-avatar">{getInitials(t.name)}</div>
                          <div>
                            <div className="to-tech-name">{t.name}</div>
                            <div className="to-tech-id">{t.tkId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="to-trade">{t.trade}</td>
                      <td><VerifBadge status={t.verif} /></td>
                      <td><AvailBadge online={t.online} /></td>
                      <td><Stars rating={t.rating} count={t.ratingCount} /></td>
                      <td className="to-jobs">{t.jobs}</td>
                      <td className="to-perf">{t.performance}</td>
                      <td><AcctBadge status={t.accountStatus} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── pagination ── */}
        {!loading && filtered.length > 0 && (
          <div className="to-pagination">
            <span className="to-page-info">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length.toLocaleString()} technicians
            </span>
            <div className="to-page-controls">
              <button className="to-page-btn" onClick={() => goPage(page - 1)} disabled={page === 1}>‹</button>
              {pageNums().map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} className="to-page-ellipsis">…</span>
                  : <button key={n} className={`to-page-btn${page === n ? ' active' : ''}`} onClick={() => goPage(n)}>{n}</button>
              )}
              <button className="to-page-btn" onClick={() => goPage(page + 1)} disabled={page === totalPages}>›</button>
            </div>
            <select className="to-page-size" value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} per page</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicianOverview;
