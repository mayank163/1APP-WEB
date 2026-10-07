import React, { useEffect, useRef, useState } from 'react';
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiEdit2,
  FiHome,
  FiMapPin,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiSlash,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import { FaCrown, FaRupeeSign, FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';

import adminApi from '../services/adminApi';
import { ShimmerUserTable } from '../components/Shimmer';
import CustomerDetails from '../components/CustomerDetails';
import '../styles/UserManagement.css';

const date = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const money = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN')}`;
const blocked = (user) => ['inactive', 'blocked', 'suspended'].includes(user.accountStatus);
const customerId = (user) => user.customerId || user._id;
const plans = (user) => user.planPurchases || [];
const activePlan = (user) =>
  plans(user).find(
    (p) => p.status === 'active' && (!p.expiresAt || new Date(p.expiresAt) > new Date()),
  );
const serviceName = (booking) =>
  booking?.services
    ?.map((s) => s.service?.name || s.variantName || 'Service')
    .join(', ') || 'Service booking';
const addressText = (address) =>
  typeof address === 'string'
    ? address
    : [address?.addressLine, address?.city, address?.state, address?.zipcode]
        .filter(Boolean)
        .join(', ');

function Avatar({ user, large = false }) {
  const photo = user.profileImage?.url || user.profilePhoto || user.avatar || user.photoUrl;
  const [failedPhoto, setFailedPhoto] = useState(null);

  return (
    <span className={`cm-avatar ${large ? 'cm-avatar-large' : ''}`}>
      {photo && failedPhoto !== photo ? (
        <img src={photo} alt={user.name} onError={() => setFailedPhoto(photo)} />
      ) : (
        (user.name || 'Customer')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
      )}
    </span>
  );
}

function Status({ user }) {
  return (
    <span className={`cm-status ${blocked(user) ? 'is-blocked' : ''}`}>
      <i />
      {blocked(user) ? 'Blocked' : 'Active'}
    </span>
  );
}

function Membership({ user }) {
  const plan = activePlan(user) || plans(user)[0];

  return plan ? (
    <>
      <span className={`cm-badge ${activePlan(user) ? 'green' : 'red'}`}>
        {activePlan(user) ? 'Active' : 'Expired'}
      </span>
      <small>
        {plan.expiresAt
          ? `${activePlan(user) ? 'Valid till' : 'Expired on'} ${date(plan.expiresAt)}`
          : plan.planName}
      </small>
    </>
  ) : (
    <span className="cm-badge gray">None</span>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="cm-panel">
      <div className="cm-panel-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    registration: '',
    activity: '',
    membership: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [detailOnly, setDetailOnly] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const detailRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await adminApi.getUsers({ search, sort: 'asc', page, limit, ...filters });

        if (!cancelled) {
          const rows = res.data?.users || [];
          setUsers(rows);
          setTotal(res.pagination?.total ?? res.count ?? rows.length);
          setSelectedId((id) => (rows.some((u) => u._id === id) ? id : rows[0]?._id || null));
          setChecked([]);
        }
      } catch (err) {
        if (!cancelled) toast.error('Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, filters, page, limit, refresh]);

  const user = users.find((u) => u._id === selectedId);
  const bookings = user?.bookings || [];
  const last = bookings[0];
  const plan = user && (activePlan(user) || plans(user)[0]);
  const addresses = user?.addresses?.length
    ? user.addresses
    : user?.address
      ? [{ label: 'Home', addressLine: user.address }]
      : [];
  const address = addresses.find((a) => a.isDefault) || addresses[0];
  const pages = Math.max(1, Math.ceil(total / limit));

  const changeFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const view = (row) => {
    setSelectedId(row._id);
    setTab('Overview');
    setDetailOnly(true);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const edit = (row) => {
    setForm({
      name: row.name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth?.slice(0, 10) || '',
    });
    setModal({ type: 'edit', user: row });
  };

  const changeStatus = async (row) => {
    if (!window.confirm(`${blocked(row) ? 'Unblock' : 'Block'} ${row.name}'s account?`)) {
      return;
    }

    setSaving(true);

    try {
      const status = blocked(row) ? 'active' : 'inactive';
      const res = await adminApi.updateUserAccount(row._id, status);
      setUsers((current) =>
        current.map((u) =>
          u._id === row._id ? { ...u, ...res.data?.user, accountStatus: status } : u,
        ),
      );
      toast.success(`Customer ${status === 'active' ? 'unblocked' : 'blocked'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update customer');
    } finally {
      setSaving(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (modal.type === 'add') await adminApi.createCustomer(form);
      else await adminApi.updateCustomer(modal.user._id, form);

      toast.success(modal.type === 'add' ? 'Customer added' : 'Customer updated');
      setModal(null);
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save customer');
    } finally {
      setSaving(false);
    }
  };

  const exportCustomers = () => {
    const rows = checked.length ? users.filter((u) => checked.includes(u._id)) : users;
    const csv = [
      ['Customer ID', 'Name', 'Email', 'Phone', 'Status'],
      ...rows.map((u) => [
        customerId(u),
        u.name,
        u.email,
        u.phone,
        blocked(u) ? 'Blocked' : 'Active',
      ]),
    ]
      .map((row) =>
        row
          .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const overview = (
    <>
      <div className="cm-stats">
        {[
          [FiCalendar, bookings.length, 'Total Bookings', 'gold'],
          [
            FiCheckCircle,
            bookings.filter((b) => b.status === 'Completed').length,
            'Completed',
            'green',
          ],
          [
            FiXCircle,
            bookings.filter((b) => b.status === 'Cancelled').length,
            'Cancelled',
            'red',
          ],
          [
            FiClock,
            bookings.filter((b) => !['Completed', 'Cancelled'].includes(b.status)).length,
            'Active Booking',
            'red',
          ],
          [
            FaRupeeSign,
            money(
              bookings
                .filter((b) => b.paymentStatus === 'Paid')
                .reduce((sum, b) => sum + b.totalAmount, 0),
            ),
            'Total Spent',
            'gold',
          ],
          [FaStar, user?.rating ? Number(user.rating).toFixed(1) : '—', 'Average Rating', 'gold'],
        ].map(([Icon, value, label, color]) => (
          <div className="cm-stat" key={label}>
            <span className={`cm-stat-icon ${color}`}>
              <Icon />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
              {label === 'Average Rating' && <small>({user?.ratingCount || 0} reviews)</small>}
            </div>
          </div>
        ))}
      </div>

      <div className="cm-detail-grid">
        <Panel
          title="Customer Information"
          action={
            <button className="cm-button cm-small" onClick={() => edit(user)}>
              <FiEdit2 /> Edit
            </button>
          }
        >
          <dl className="cm-info">
            {[
              ['Full Name', user?.name],
              ['Customer ID', user && customerId(user)],
              ['Mobile Number', user?.phone],
              ['Email', user?.email],
              ['Date of Birth', date(user?.dateOfBirth)],
              ['Language', user?.language || '—'],
              ['Account Status', user && <Status user={user} />],
            ].map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Panel>

        <Panel
          title="Last Booking"
          action={
            <button className="cm-link" onClick={() => setTab('Bookings')}>
              View All
            </button>
          }
        >
          {last ? (
            <div className="cm-last-booking">
              <div className="cm-service-image">
                <FiCalendar />
              </div>
              <div className="cm-booking-copy">
                <strong>{serviceName(last)}</strong>
                <small>Booking ID: {last._id}</small>
                <span className={`cm-badge ${last.status === 'Completed' ? 'green' : 'gray'}`}>
                  {last.status}
                </span>
                <p>
                  <FiCalendar /> {date(last.serviceDate)}
                </p>
                <p>
                  <FiMapPin /> {addressText(last.address)}
                </p>
                <div className="cm-booking-bottom">
                  <span>
                    {last.assignedTechnician?.name || 'Unassigned'}
                    <small>Technician</small>
                  </span>
                  <button className="cm-button" onClick={() => setTab('Bookings')}>
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="cm-empty">No bookings yet.</p>
          )}
        </Panel>

        <Panel
          title="Saved Address"
          action={
            <button className="cm-link" onClick={() => setTab('Addresses')}>
              View All
            </button>
          }
        >
          {address ? (
            <div className="cm-address">
              <span className="cm-stat-icon gray">
                <FiHome />
              </span>
              <div>
                <strong>{address.label || 'Home'}</strong>{' '}
                {address.isDefault && <span className="cm-badge green">Default</span>}
                <p>{addressText(address)}</p>
                <a
                  className="cm-button cm-neutral"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(address))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FiMapPin /> View on Map
                </a>
              </div>
            </div>
          ) : (
            <p className="cm-empty">No saved addresses.</p>
          )}
        </Panel>

        <Panel
          title="Membership"
          action={
            <button className="cm-link" onClick={() => setTab('Membership')}>
              View Details
            </button>
          }
        >
          {plan ? (
            <>
              <div className="cm-plan">
                <span className="cm-stat-icon gold">
                  <FaCrown />
                </span>
                <div>
                  <strong>{plan.planName}</strong>
                  <Membership user={user} />
                </div>
              </div>
              <p className="cm-muted">Membership ID: {plan._id}</p>
              <div className="cm-benefit">
                <FiCheckCircle /> Plan Status{' '}
                <span className="cm-badge green">{plan.status}</span>
              </div>
            </>
          ) : (
            <p className="cm-empty">No membership purchased.</p>
          )}
        </Panel>
      </div>
    </>
  );

  return (
    <div className="customer-management">
      <section className="cm-directory" hidden={detailOnly}>
        <header className="cm-heading">
          <div>
            <h1>Customer Management</h1>
            <p>Manage customer profiles, accounts, bookings and activity.</p>
          </div>
          <button
            className="cm-button cm-primary"
            onClick={() => {
              setForm({ name: '', email: '', phone: '', password: '' });
              setModal({ type: 'add' });
            }}
          >
            <FiPlus /> Add Customer
          </button>
        </header>

        <div className="cm-filters">
          <label className="cm-search">
            <FiSearch />
            <input
              aria-label="Search customers"
              placeholder="Search customers by name, phone, email or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>

          {[
            ['status', 'Status', [['', 'All'], ['active', 'Active'], ['blocked', 'Blocked']]],
            [
              'registration',
              'Registration Date',
              [['', 'All Time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last year']],
            ],
            ['activity', 'Booking Activity', [['', 'All'], ['has', 'Has bookings'], ['none', 'No bookings']]],
            ['membership', 'Membership', [['', 'All'], ['active', 'Active'], ['expired', 'Expired'], ['none', 'None']]],
          ].map(([key, label, options]) => (
            <label className="cm-filter" key={key}>
              <span>{label}</span>
              <select value={filters[key]} onChange={(e) => changeFilter(key, e.target.value)}>
                {options.map(([value, text]) => (
                  <option value={value} key={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <button
            className="cm-button cm-neutral cm-reset"
            onClick={() => {
              setSearch('');
              setFilters({ status: '', registration: '', activity: '', membership: '' });
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>

        {checked.length > 0 && (
          <div className="cm-selection">
            {checked.length} customers selected{' '}
            <button className="cm-link" onClick={exportCustomers}>
              <FiDownload /> Export selected
            </button>
          </div>
        )}

        <div className="cm-table-wrap">
          {loading ? (
            <ShimmerUserTable rows={5} />
          ) : (
            <table className="cm-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all customers"
                      checked={users.length > 0 && checked.length === users.length}
                      onChange={(e) => setChecked(e.target.checked ? users.map((u) => u._id) : [])}
                    />
                  </th>
                  {[
                    'Customer',
                    'Contact',
                    'Bookings',
                    'Last Booking',
                    'Membership',
                    'Rating',
                    'Status',
                    'Registered',
                    'Action',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.name}`}
                        checked={checked.includes(row._id)}
                        onChange={(e) =>
                          setChecked((ids) =>
                            e.target.checked ? [...ids, row._id] : ids.filter((id) => id !== row._id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="cm-customer-cell">
                        <Avatar user={row} />
                        <div>
                          <strong>{row.name}</strong>
                          <small title={customerId(row)}>{customerId(row)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.phone}
                      <small>{row.email}</small>
                    </td>
                    <td className="cm-center">{row.bookings?.length || 0}</td>
                    <td>
                      {date(row.bookings?.[0]?.serviceDate)}
                      <small>{row.bookings?.[0] ? serviceName(row.bookings[0]) : ''}</small>
                    </td>
                    <td>
                      <Membership user={row} />
                    </td>
                    <td>
                      {row.rating ? (
                        <span className="cm-rating">
                          <FaStar /> {Number(row.rating).toFixed(1)} ({row.ratingCount || 0})
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Status user={row} />
                    </td>
                    <td>{date(row.createdAt)}</td>
                    <td>
                      <div className="cm-row-actions">
                        <button className="cm-button cm-view" onClick={() => view(row)}>
                          View <FiArrowRight />
                        </button>
                        <details className="cm-menu">
                          <summary aria-label={`Actions for ${row.name}`}>
                            <FiMoreVertical />
                          </summary>
                          <div>
                            <button onClick={() => edit(row)}>
                              <FiEdit2 /> Edit customer
                            </button>
                            <button disabled={saving} onClick={() => changeStatus(row)}>
                              <FiSlash /> {blocked(row) ? 'Unblock' : 'Block'} customer
                            </button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}

                {!users.length && (
                  <tr>
                    <td colSpan={10} className="cm-empty">
                      No customers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <footer className="cm-pagination">
          <span>
            Showing {total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)} of {' '}
            {total} customers
          </span>

          <div className="cm-pages">
            <button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <FiChevronLeft />
            </button>

            {Array.from(
              new Set([
                1,
                ...Array.from({ length: 5 }, (_, i) => page - 2 + i).filter(
                  (p) => p > 1 && p < pages,
                ),
                pages,
              ]),
            ).map((p, i, a) => (
              <React.Fragment key={p}>
                {i > 0 && p - a[i - 1] > 1 && <span>…</span>}
                <button className={page === p ? 'selected' : ''} onClick={() => setPage(p)}>
                  {p}
                </button>
              </React.Fragment>
            ))}

            <button
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <FiChevronRight />
            </button>
          </div>

          <label>
            Rows per page{' '}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[5, 10, 25, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </footer>
      </section>

      {user && (
        <section ref={detailRef}>
          <CustomerDetails
            user={user}
            tab={tab}
            setTab={setTab}
            overview={overview}
            onEdit={edit}
            onStatus={changeStatus}
            saving={saving}
            onExport={exportCustomers}
            onRefresh={() => setRefresh((r) => r + 1)}
            onBack={() => {
              setDetailOnly(false);
              setTab('Overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </section>
      )}

      {modal && (
        <div className="cm-modal-backdrop" onClick={() => !saving && setModal(null)}>
          <section
            className="cm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-panel-heading">
              <h2 id="customer-form-title">{modal.type === 'add' ? 'Add' : 'Edit'} Customer</h2>
              <button
                className="cm-icon-button"
                aria-label="Close"
                disabled={saving}
                onClick={() => setModal(null)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={save}>
              {[
                ['name', 'Full Name', 'text'],
                ['email', 'Email', 'email'],
                ['phone', 'Mobile Number', 'tel'],
                ...(modal.type === 'add'
                  ? [['password', 'Password', 'password']]
                  : [['dateOfBirth', 'Date of Birth', 'date']]),
              ].map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    type={type}
                    required={key !== 'dateOfBirth'}
                    minLength={key === 'password' ? 6 : undefined}
                    value={form[key] || ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}

              <div className="cm-modal-actions">
                <button
                  type="button"
                  className="cm-button cm-neutral"
                  disabled={saving}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button className="cm-button cm-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
