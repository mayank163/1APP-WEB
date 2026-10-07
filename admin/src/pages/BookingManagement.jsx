import React, { useEffect, useState } from 'react';
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiFileText,
  FiFilter,
  FiMapPin,
  FiPlus,
  FiSearch,
  FiTool,
  FiUser,
  FiUserPlus,
  FiX,
} from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';

import adminApi from '../services/adminApi';
import { ShimmerBookingTable } from '../components/Shimmer';
import InvoicePreview from '../components/invoice/InvoicePreview';
import TechnicianFormModal from '../components/TechnicianFormModal';
import '../styles/TechnicianOverview.css';
import '../styles/BookingManagement.css';

const statuses = [
  'Pending',
  'Confirmed',
  'Assigned',
  'On the Way',
  'In Progress',
  'Checkout',
  'Completed',
  'Cancelled',
];

const addressText = (address) =>
  typeof address === 'string'
    ? address
    : [address?.addressLine, address?.city, address?.state, address?.zipcode]
        .filter(Boolean)
        .join(', ') || 'Not provided';

const bookingId = (booking) => booking.bookingId || booking._id;
const serviceName = (booking) =>
  booking.services
    ?.map((item) => item.service?.name || item.variantName || 'Service')
    .join(', ') || 'Service booking';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not scheduled';
const time = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

const appointment = (booking) => {
  const start = booking.tracking?.jobDate?.from || booking.serviceDate;
  const end = booking.tracking?.jobDate?.to;
  const day =
    start && new Date(start).toDateString() === new Date().toDateString()
      ? 'Today'
      : date(start);

  return `${day}${time(start) ? `, ${time(start)}` : ''}${end ? ` – ${time(end)}` : ''}`;
};

const eventStatus = (status) =>
  (
    {
      open: 'Job created',
      assigned: 'Technician assigned',
      ontheway: 'On the Way',
      visited: 'Arrived',
      inprogress: 'In Progress',
      'in-progress': 'In Progress',
      completed: 'Completed',
      checkout: 'Checkout',
      closed: 'Closed',
      cancelled: 'Cancelled',
    }[status] || status
  );

function Badge({ value, outlined = false, payment = false }) {
  const tone =
    payment && value === 'Pending'
      ? 'amber'
      : ['Completed', 'Paid'].includes(value)
        ? 'green'
        : ['Pending', 'Confirmed', 'Assigned', 'Authorized'].includes(value)
          ? 'blue'
          : ['Cancelled', 'Failed', 'Emergency'].includes(value)
            ? 'red'
            : 'amber';

  return (
    <span className={`bm-badge bm-${tone} ${outlined ? 'bm-outlined' : ''}`}>
      <i />
      {value === 'Pending' && !outlined && !payment ? 'New / Pending' : value || 'Unknown'}
    </span>
  );
}

function Card({ title, Icon, children, className = '', action }) {
  return (
    <section className={`bm-card ${className}`}>
      <div className="bm-card-heading">
        <h2>
          <Icon />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="bm-field">
      <h3>{label}</h3>
      <div>{children || 'Not provided'}</div>
    </div>
  );
}

export default function BookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [serviceDetails, setServiceDetails] = useState({});
  const [serviceLoading, setServiceLoading] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);

    adminApi
      .getBookings({ search: query, status, sort, page, limit })
      .then((res) => {
        if (!active) return;
        if (!res.success) throw new Error('Failed to load bookings');

        setBookings(res.data?.bookings || []);
        setTotal(res.pagination?.total ?? res.count ?? 0);
      })
      .catch(() => {
        if (active) toast.error('Failed to load bookings');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, status, sort, page, limit, refresh]);

  useEffect(() => {
    let active = true;
    const ids = [
      ...new Set(
        (selected?.services || [])
          .map((item) =>
            typeof item.service === 'object' ? item.service?._id : item.service,
          )
          .filter(Boolean),
      ),
    ];

    setServiceDetails({});
    setServiceLoading(ids.length > 0);

    if (!ids.length) {
      return () => {
        active = false;
      };
    }

    Promise.all(
      ids.map(async (id) => {
        try {
          const res = await adminApi.getServiceById(id);
          return [id, res.data?.service];
        } catch {
          return [id, null];
        }
      }),
    ).then((results) => {
      if (active) {
        setServiceDetails(Object.fromEntries(results));
        setServiceLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selected]);

  const openUpdate = () => {
    setForm({ status: selected.status, paymentStatus: selected.paymentStatus });
    setModal('update');
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (modal === 'invite') {
        await adminApi.inviteTechnician(form);
        toast.success('Invitation sent');
      } else {
        const res = await adminApi.updateBooking(selected._id, form);

        if (!res.success) throw new Error('Update failed');

        setSelected((current) => ({ ...current, ...res.data.booking }));
        setRefresh((r) => r + 1);
        toast.success('Booking updated');
      }

      setModal(null);
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || 'Could not save changes',
      );
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));
  const pageNumbers = Array.from(
    new Set([
      1,
      ...Array.from({ length: 5 }, (_, i) => page - 2 + i).filter(
        (p) => p > 1 && p < pages,
      ),
      pages,
    ]),
  );
  const category = selected?.services
    ?.map((item) => {
      const s = serviceDetails[item.service?._id || item.service] || item.service;
      return s?.category?.name || s?.subcategory?.name;
    })
    .filter(Boolean)
    .join(', ');
  const history = selected?.tracking?.statusHistory || selected?.statusHistory || [];
  const events = history.length
    ? history.map((e) => ({
        title: eventStatus(e.status),
        at: e.changedAt,
        note: e.note,
      }))
    : selected
      ? [
          { title: 'Booking created', at: selected.createdAt },
          { title: `Current status — ${selected.status}`, at: null },
        ]
      : [];
  const mapQuery =
    selected?.address?.coordinates?.lat != null &&
    selected?.address?.coordinates?.lng != null
      ? `${selected.address.coordinates.lat},${selected.address.coordinates.lng}`
      : addressText(selected?.address);

  return (
    <div className="booking-management">
      <div className="bm-breadcrumb">
        Customer Management <span>›</span> <strong>Booking</strong>
      </div>

      {!selected ? (
        <>
          <header className="bm-page-heading">
            <div>
              <h1>Customer’s Booking</h1>
              <p>{total.toLocaleString()} bookings on record registered</p>
            </div>
            
          </header>

          <form
            className="bm-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
              setPage(1);
            }}
          >
            <div className="bm-search">
              <input
                aria-label="Search bookings"
                placeholder="Search by booking Id, customer or service"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button aria-label="Search" type="submit">
                <FiSearch />
              </button>
            </div>

            <label className="bm-sort">
              <FiFilter />
              <select
                aria-label="Sort bookings"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Oldest first</option>
                <option value="appointment">Appointment</option>
                <option value="amount-desc">Amount: High to low</option>
                <option value="amount-asc">Amount: Low to high</option>
              </select>
            </label>

            <label className="bm-status-filter">
              Status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="bm-button bm-primary"
              onClick={() => {
                setSearch('');
                setQuery('');
                setStatus('');
                setSort('newest');
                setPage(1);
              }}
            >
              <FiX /> Reset
            </button>
          </form>

          <div className="bm-table-wrap">
            {loading ? (
              <ShimmerBookingTable rows={6} />
            ) : (
              <table className="bm-table">
                <thead>
                  <tr>
                    {[
                      'Booking ID',
                      'Customer',
                      'Service',
                      'Technician',
                      'Status',
                      'Payment',
                      'Amount',
                      'Appointment',
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <button
                          className="bm-booking-link"
                          title={bookingId(b)}
                          onClick={() => setSelected(b)}
                        >
                          {bookingId(b)}
                        </button>
                      </td>
                      <td>{b.user?.name || 'Customer'}</td>
                      <td>{serviceName(b)}</td>
                      <td className={!b.assignedTechnician?.name ? 'bm-unassigned' : ''}>
                        {b.assignedTechnician?.name || '— Unassigned'}
                      </td>
                      <td>
                        <Badge value={b.status} />
                      </td>
                      <td>
                        <Badge value={b.paymentStatus} payment />
                      </td>
                      <td>
                        <strong>{money(b.totalAmount)}</strong>
                      </td>
                      <td>{appointment(b)}</td>
                    </tr>
                  ))}

                  {!bookings.length && (
                    <tr>
                      <td colSpan={8} className="bm-empty">
                        No booking matches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <footer className="bm-pagination">
            <span>
              Showing {total ? (page - 1) * limit + 1 : 0} to{' '}
              {Math.min(page * limit, total)} of {total} booking{total === 1 ? '' : 's'}
            </span>

            <div className="bm-pages">
              <button
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <FiChevronLeft />
              </button>

              {pageNumbers.map((p, i) => (
                <React.Fragment key={p}>
                  {i > 0 && p - pageNumbers[i - 1] > 1 && <span>…</span>}
                  <button
                    className={page === p ? 'active' : ''}
                    onClick={() => setPage(p)}
                  >
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

            <select
              aria-label="Bookings per page"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </footer>
        </>
      ) : (
        <>
          <button className="bm-back" onClick={() => setSelected(null)}>
            <FiArrowLeft /> Back to Bookings
          </button>

          <section className="bm-card bm-booking-hero">
            <div>
              <div className="bm-hero-badges">
                <span className="bm-id">{bookingId(selected)}</span>
                <Badge value={selected.status} outlined />
                {(selected.isEmergency || selected.priority === 'emergency') && (
                  <Badge value="Emergency" outlined />
                )}
              </div>
              <h1>
                {serviceName(selected)} for {selected.user?.name || 'Customer'}
              </h1>
              <p>
                <strong>{appointment(selected)}</strong>
                <span>•</span>
                {selected.address?.city || addressText(selected.address)}
              </p>
            </div>
            <button className="bm-button bm-primary" onClick={openUpdate}>
              <FiCheckCircle /> Confirm Booking
            </button>
          </section>

          <Card title="Customer" Icon={FiUser} className="bm-customer-card">
            <div className="bm-field-grid">
              <Field label="Name">{selected.user?.name}</Field>
              <Field label="Phone">{selected.phone || selected.user?.phone}</Field>
              <Field label="Address">{addressText(selected.address)}</Field>
              <Field label="Rating">
                {selected.user?.rating ? (
                  <span className="bm-rating">
                    <FaStar />
                    {selected.user.rating}
                  </span>
                ) : (
                  'Not rated'
                )}
              </Field>
            </div>
          </Card>

          <div className="bm-detail-columns">
            <div className="bm-detail-main">
              <Card title="Technician & tracking" Icon={FiTool}>
                <div className="bm-field-grid bm-tech-summary">
                  <Field label="Technician">
                    {selected.assignedTechnician?.name || 'Unassigned'}
                  </Field>
                  <Field label="Status">
                    <Badge value={selected.status} outlined />
                  </Field>
                </div>

                <div className="bm-timeline">
                  {events.map((e, i) => (
                    <div
                      className={`bm-event ${i === events.length - 1 ? 'current' : ''}`}
                      key={i}
                    >
                      <i />
                      <div>
                        <strong>{e.title}</strong>
                        {e.note && <p>{e.note}</p>}
                        {e.at && (
                          <small>
                            {time(e.at)} <span>{date(e.at)}</span>
                          </small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Payment & completion"
                Icon={FiCreditCard}
                action={
                  <button className="bm-text-button" onClick={openUpdate}>
                    Update booking
                  </button>
                }
              >
                <div className="bm-field-grid">
                  <Field label="Amount">
                    <strong className="bm-amount">{money(selected.totalAmount)}</strong>
                  </Field>
                  <Field label="Payment status">
                    <Badge value={selected.paymentStatus} outlined />
                  </Field>
                  <Field label="Completion">
                    {selected.status === 'Completed' ? 'Completed' : 'Not yet'}
                  </Field>
                  {selected.paymentDetails?.provider && (
                    <Field label="Provider">{selected.paymentDetails.provider}</Field>
                  )}
                </div>
                {selected.paymentDetails?.transactionId && (
                  <p className="bm-payment-reference">
                    Transaction ID: {selected.paymentDetails.transactionId}
                  </p>
                )}
              </Card>
            </div>

            <aside className="bm-detail-side">
              <Card title="SERVICE" Icon={FiBriefcase}>
                <dl className="bm-service-values">
                  <div>
                    <dt>Service</dt>
                    <dd>{serviceName(selected)}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{category || (serviceLoading ? 'Loading...' : 'Not specified')}</dd>
                  </div>
                </dl>

                <p className="bm-notes">
                  {selected.specialInstructions || '“No specific customer notes provided.”'}
                </p>

                {selected.services?.map(
                  (item, i) =>
                    (item.variantName ||
                      item.selectedAddons?.length > 0 ||
                      item.quantity > 1) && (
                      <div className="bm-service-item" key={i}>
                        {item.variantName && <p>Variant: {item.variantName}</p>}
                        <p>Quantity: {item.quantity || 1}</p>
                        {item.selectedAddons?.map((a, n) => (
                          <p key={n}>
                            {a.name} · {money(a.price)}
                          </p>
                        ))}
                      </div>
                    ),
                )}

                {selected.additionalCharges?.map((c) => (
                  <div className="bm-additional-charge" key={c._id}>
                    <strong>Additional charges</strong>
                    <p>
                      +{money(c.agreedAmount ?? c.requestedAmount)} · {c.label}
                      {c.description && ` · ${c.description}`} · {c.status}
                    </p>
                  </div>
                ))}
              </Card>

              <Card title="SERVICE LOCATION" Icon={FiMapPin}>
                <a
                  className="bm-map-preview"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open service location on map"
                >
                  <FiMapPin />
                  <span>{selected.address?.label || 'Service address'}</span>
                </a>

                <dl className="bm-service-values">
                  <div>
                    <dt>Address</dt>
                    <dd>{addressText(selected.address)}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{selected.address?.label || 'Not specified'}</dd>
                  </div>
                </dl>

                <a
                  className="bm-map-button"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Map
                </a>
              </Card>
            </aside>
          </div>

          <Card title="INVOICE" Icon={FiFileText} className="bm-invoice">
            {selected.status === 'Completed' ? (
              <div className="bm-invoice-ready">
                <p>Booking completed. Your invoice is ready to download.</p>
                <button
                  className="bm-button bm-primary"
                  onClick={() => setShowInvoice(true)}
                >
                  <FiFileText /> View Invoice
                </button>
              </div>
            ) : (
              <p>Invoice will be generated on completion.</p>
            )}
          </Card>
        </>
      )}

      {showInvoice && selected && (
        <InvoicePreview
          bookingId={selected._id}
          onClose={() => setShowInvoice(false)}
        />
      )}

      {modal === 'add' && (
        <TechnicianFormModal
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            toast.success('Technician added');
          }}
        />
      )}

      {['update', 'invite'].includes(modal) && (
        <div
          className="bm-modal-backdrop"
          onClick={() => !busy && setModal(null)}
        >
          <section
            className="bm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'update' ? 'Confirm booking' : 'Invite technician'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bm-modal-heading">
              <h2>{modal === 'update' ? 'Confirm Booking' : 'Invite Technician'}</h2>
              <button
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={save}>
              {modal === 'update' ? (
                <>
                  <label>
                    Service Status
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, status: e.target.value }))
                      }
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Payment Status
                    <select
                      value={form.paymentStatus}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paymentStatus: e.target.value }))
                      }
                    >
                      {['Pending', 'Paid', 'Failed'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Name
                    <input
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Invitation channel
                    <select
                      value={form.channel}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, channel: e.target.value }))
                      }
                    >
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </select>
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      required={form.channel === 'email'}
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Phone
                    <input
                      type="tel"
                      required={form.channel === 'phone'}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </label>
                </>
              )}

              <div className="bm-modal-actions">
                <button
                  type="button"
                  className="bm-button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button className="bm-button bm-primary" disabled={busy}>
                  {busy
                    ? 'Saving...'
                    : modal === 'invite'
                      ? 'Send Invitation'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
