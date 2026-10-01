import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { ShimmerBookingTable } from '../components/Shimmer';
import { FaSearch, FaEye, FaUser, FaPhone, FaMapMarkerAlt, FaDollarSign, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Pagination from '../components/Pagination';

const formatAddress = (address) => {
    if (typeof address === 'string') return address.trim() || 'N/A';
    if (!address || typeof address !== 'object') return 'N/A';

    return [address.addressLine, address.city, address.state, address.zipcode]
        .filter(part => typeof part === 'string' && part.trim())
        .map(part => part.trim())
        .join(', ') || 'N/A';
};

const BookingManagement = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    
    // Details Drawer States
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [serviceDetails, setServiceDetails] = useState({});
    const [serviceDetailsLoading, setServiceDetailsLoading] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [newPaymentStatus, setNewPaymentStatus] = useState('');
    const [newPaymentDetails, setNewPaymentDetails] = useState('');
    const [techName, setTechName] = useState('');
    const [techPhone, setTechPhone] = useState('');
    const [updating, setUpdating] = useState(false);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getBookings({
                status: statusFilter,
                search: searchQuery,
                page,
                limit: pageSize
            });
            if (res.success) {
                setBookings(res.data.bookings);
                setPagination(res.pagination || { page, limit: pageSize, total: res.count || 0, totalPages: Math.max(1, Math.ceil((res.count || 0) / pageSize)) });
            }
        } catch (err) {
            toast.error('Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [statusFilter, page, pageSize]);

    useEffect(() => {
        let active = true;
        const serviceItems = selectedBooking?.services || [];
        const serviceIds = [...new Set(serviceItems.map(item => (
            typeof item.service === 'object' ? item.service?._id : item.service
        )).filter(Boolean))];

        setServiceDetails({});
        setServiceDetailsLoading(serviceIds.length > 0);

        Promise.all(serviceIds.map(async id => {
            try {
                const response = await adminApi.getServiceById(id);
                return [id, response.data?.service || null];
            } catch {
                return [id, null];
            }
        })).then(results => {
            if (active) setServiceDetails(Object.fromEntries(results));
        }).finally(() => {
            if (active) setServiceDetailsLoading(false);
        });

        return () => { active = false; };
    }, [selectedBooking]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchBookings();
    };

    const handleOpenDetails = (booking) => {
        setSelectedBooking(booking);
        setNewStatus(booking.status);
        setNewPaymentStatus(booking.paymentStatus);
        setNewPaymentDetails(booking.paymentDetails);
        setTechName(booking.assignedTechnician?.name || '');
        setTechPhone(booking.assignedTechnician?.phone || '');
    };

    const handleUpdateBooking = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            const payload = {
                status: newStatus,
                paymentStatus: newPaymentStatus,
                paymentDetails: newPaymentDetails,
                technicianName: techName,
                technicianPhone: techPhone
            };

            const res = await adminApi.updateBooking(selectedBooking._id, payload);
            if (res.success) {
                toast.success('Booking details updated successfully!');
                // Refresh list and update currently selected
                setSelectedBooking(res.data.booking);
                fetchBookings();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setUpdating(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pending': return 'text-white';
            case 'Confirmed': return 'bg-info text-dark';
            case 'Assigned': return 'bg-primary text-light';
            case 'On the Way': return 'bg-primary text-light';
            case 'In Progress': return 'bg-primary text-light';
            case 'Checkout': return 'bg-warning text-dark';
            case 'Completed': return 'bg-success text-light';
            case 'Cancelled': return 'bg-danger text-light';
            default: return 'bg-secondary text-light';
        }
    };

    const getStatusStyle = (status) => {
        if (status === 'Pending') return { background: '#A5732F', color: '#fff' };
        return {};
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-extrabold text-dark mb-1">Manage Bookings</h1>
                    <p className="text-muted">Review schedules, allocate technicians, and update status cards.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm rounded-3 bg-white p-3 mb-4">
                <form onSubmit={handleSearchSubmit} className="row g-3 align-items-center">
                    <div className="col-md-5">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-0"><FaSearch className="text-muted" /></span>
                            <input 
                                type="text"
                                className="form-control bg-light border-0"
                                placeholder="Search by customer name, phone, email or Booking ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="col-md-4">
                        <select 
                            className="form-select bg-light border-0"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Assigned">Assigned</option>
                            <option value="On the Way">On the Way</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Checkout">Checkout</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="col-md-3">
                        <button type="submit" className="btn btn-brand w-100 fw-bold">Apply Filter</button>
                    </div>
                </form>
            </div>

            <div className="row g-4">
                {/* Bookings Table */}
                <div className={selectedBooking ? 'col-lg-7' : 'col-12'}>
                    <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
                        {loading ? (
                            <ShimmerBookingTable rows={7} />
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light border-0">
                                        <tr>
                                            <th>ID / Customer</th>
                                            <th>Date</th>
                                            <th>Total</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bookings.map((booking) => (
                                            <tr key={booking._id} className={selectedBooking?._id === booking._id ? 'table-dark-subtle' : ''}>
                                                <td>
                                                    <div className="fw-bold text-dark font-monospace" style={{ fontSize: '0.85rem' }}>{booking._id.substring(12)}...</div>
                                                    <small className="text-muted d-block">{booking.user?.name || 'N/A'}</small>
                                                </td>
                                                <td>
                                                    <small className="d-block text-dark fw-semibold">{new Date(booking.serviceDate).toLocaleDateString()}</small>
                                                </td>
                                                <td className="font-monospace fw-bold" style={{ color: "#A5732F" }}>${booking.totalAmount}</td>
                                                <td>
                                                    <span className={`badge ${getStatusBadge(booking.status)} px-2.5 py-1 text-uppercase`} style={{ fontSize: '0.7rem', ...getStatusStyle(booking.status) }}>
                                                        {booking.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button 
                                                        onClick={() => handleOpenDetails(booking)}
                                                        className="btn btn-sm btn-light border d-flex align-items-center gap-1"
                                                    >
                                                        <FaEye />
                                                        <span>View</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {bookings.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="text-center py-5 text-muted">No booking matches found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!loading && <Pagination {...pagination} page={page} limit={pageSize} onPageChange={setPage} onLimitChange={size => { setPageSize(size); setPage(1); }} />}
                    </div>
                </div>

                {/* Details/Action Panel */}
                {selectedBooking && (
                    <div className="col-lg-5">
                        <div className="card border-0 shadow-sm rounded-3 bg-white p-4 sticky-lg-top" style={{ top: '100px', zIndex: 10 }}>
                            <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
                                <h5 className="fw-bold text-dark mb-0">Booking Details</h5>
                                <button onClick={() => setSelectedBooking(null)} className="btn-close" aria-label="Close"></button>
                            </div>

                            {/* Customer profile block */}
                            <div className="mb-4 bg-light rounded-3 p-3">
                                <div className="d-flex align-items-center gap-2 mb-2 text-muted">
                                    <FaUser style={{ color: "#A5732F" }} />
                                    <span className="fw-bold text-dark">{selectedBooking.user?.name || 'Customer'}</span>
                                    <small className="font-monospace">({selectedBooking.user?.email})</small>
                                </div>
                                <div className="d-flex align-items-center gap-2 mb-2 text-muted small">
                                    <FaPhone />
                                    <span>Phone Contact: <strong>{selectedBooking.phone}</strong></span>
                                </div>
                                <div className="d-flex align-items-start gap-2 text-muted small">
                                    <FaMapMarkerAlt className="mt-1" />
                                    <div>
                                        <span>Service Location: <strong>{formatAddress(selectedBooking.address)}</strong></span>
                                        {selectedBooking.address && typeof selectedBooking.address === 'object' && (
                                            <div className="mt-1" style={{ lineHeight: 1.6 }}>
                                                {selectedBooking.address.label && <span className="badge bg-secondary me-1">{selectedBooking.address.label}</span>}
                                                {selectedBooking.address.name && <span className="d-block">Name: {selectedBooking.address.name}</span>}
                                                {selectedBooking.address.city && <span className="d-block">City: {selectedBooking.address.city}</span>}
                                                {selectedBooking.address.state && <span className="d-block">State: {selectedBooking.address.state}</span>}
                                                {selectedBooking.address.zipcode && <span className="d-block">ZIP: {selectedBooking.address.zipcode}</span>}
                                                {selectedBooking.address.coordinates?.lat && (
                                                    <span className="d-block">📍 {selectedBooking.address.coordinates.lat.toFixed(5)}, {selectedBooking.address.coordinates.lng.toFixed(5)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Appointment summary */}
                            <div className="row g-3 mb-4 border-bottom pb-4">
                                <div className="col-6 d-flex align-items-center gap-2">
                                    <FaCalendarAlt style={{ color: "#A5732F" }} />
                                    <div>
                                        <small className="text-muted d-block">Scheduled</small>
                                        <span className="fw-bold text-dark small">{new Date(selectedBooking.serviceDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-bottom pb-4 mb-4">
                                <h6 className="fw-bold text-dark mb-3">Booked Services</h6>
                                {serviceDetailsLoading && <p className="text-muted small">Loading service details...</p>}
                                {(selectedBooking.services || []).map((item, index) => {
                                    const serviceId = typeof item.service === 'object' ? item.service?._id : item.service;
                                    const service = serviceDetails[serviceId] || (typeof item.service === 'object' ? item.service : null);
                                    const description = service?.longDescription || service?.shortDescription?.join(' ');

                                    return (
                                        <div key={serviceId || index} className="bg-light rounded-3 p-3 mb-2">
                                            <div className="d-flex justify-content-between align-items-start gap-3">
                                                <div>
                                                    <div className="fw-bold text-dark">{service?.name || 'Service details unavailable'}</div>
                                                    {(service?.category?.name || service?.subcategory?.name) && (
                                                        <small className="text-muted">
                                                            {[service.category?.name, service.subcategory?.name].filter(Boolean).join(' / ')}
                                                        </small>
                                                    )}
                                                </div>
                                                <div className="text-end fw-bold text-nowrap" style={{ color: '#A5732F' }}>
                                                    ${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)}
                                                </div>
                                            </div>
                                            {description && <p className="small text-muted mt-2 mb-2">{description}</p>}
                                            <div className="small text-muted">
                                                <span>Quantity: {item.quantity || 1}</span>
                                                {item.variantName && <span> · Variant: {item.variantName}</span>}
                                            </div>
                                            {item.selectedAddons?.length > 0 && (
                                                <div className="small mt-2">
                                                    <span className="text-muted">Add-ons: </span>
                                                    {item.selectedAddons.map(addon => `${addon.name} ($${Number(addon.price || 0).toFixed(2)})`).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {!serviceDetailsLoading && !selectedBooking.services?.length && (
                                    <p className="text-muted small mb-0">No service items were saved with this booking.</p>
                                )}
                            </div>

                            {/* Payment Information */}
<div className="card border-0 bg-light mb-4">
    <div className="card-body">
        <h6 className="fw-bold mb-3">
            <FaDollarSign className="me-2 text-success" />
            Payment Details
        </h6>

        <div className="row g-3">
            <div className="col-md-6">
                <small className="text-muted d-block">Amount</small>
                <div className="fw-bold fs-5" style={{ color: "#A5732F" }}>
                    ${selectedBooking.totalAmount}
                </div>
            </div>

            <div className="col-md-6">
                <small className="text-muted d-block">Payment Status</small>
                <span
                    className={`badge ${
                        selectedBooking.paymentStatus === "Paid"
                            ? "bg-success"
                            : selectedBooking.paymentStatus === "Pending"
                            ? "bg-warning text-dark"
                            : "bg-danger"
                    }`}
                >
                    {selectedBooking.paymentStatus}
                </span>
            </div>

            <div className="col-12">
                <small className="text-muted">Provider</small>
                <div className="fw-semibold text-capitalize">
                    {selectedBooking.paymentDetails?.provider || "-"}
                </div>
            </div>

            <div className="col-12">
                <small className="text-muted">Order ID</small>
                <div className="font-monospace small text-break">
                    {selectedBooking.paymentDetails?.orderId || "-"}
                </div>
            </div>

            <div className="col-12">
                <small className="text-muted">Payment ID</small>
                <div className="font-monospace small text-break">
                    {selectedBooking.paymentDetails?.paymentId || "-"}
                </div>
            </div>

            <div className="col-12">
                <small className="text-muted">Transaction ID</small>
                <div className="font-monospace small text-break">
                    {selectedBooking.paymentDetails?.transactionId || "-"}
                </div>
            </div>
        </div>
    </div>
</div>

                            {/* Status updates Form */}
                            <form onSubmit={handleUpdateBooking}>
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <label className="form-label text-muted small fw-bold mb-1">Service Status</label>
                                        <select 
                                            className="form-select bg-light border-0 fw-semibold"
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label text-muted small fw-bold mb-1">Payment Status</label>
                                        <select 
                                            className="form-select bg-light border-0 fw-semibold"
                                            value={newPaymentStatus}
                                            onChange={(e) => setNewPaymentStatus(e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Paid">Paid</option>
                                            <option value="Failed">Failed</option>
                                        </select>
                                    </div>
                                </div>

                                <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Assign Service Technician</h6>
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <input 
                                            type="text" 
                                            className="form-control bg-light border-0 small" 
                                            placeholder="Technician Name"
                                            value={techName}
                                            onChange={(e) => setTechName(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-6">
                                        <input 
                                            type="tel" 
                                            className="form-control bg-light border-0 small" 
                                            placeholder="Contact Phone"
                                            value={techPhone}
                                            onChange={(e) => setTechPhone(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={updating}
                                    className="btn btn-brand w-100 fw-bold py-2.5 shadow-sm"
                                >
                                    {updating ? 'Saving changes...' : 'Save Configuration'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingManagement;
