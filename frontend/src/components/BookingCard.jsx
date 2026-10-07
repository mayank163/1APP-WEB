import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Modal from 'react-bootstrap/Modal';
import { FaStar } from 'react-icons/fa';
import bookingService from '../services/bookingService';
import InvoicePreview from './invoice/InvoicePreview';
import { resolveImageUrl } from '../services/api';
import { FiCalendar, FiMapPin, FiUser, FiArrowRight, FiStar, FiTool } from "react-icons/fi";

import '../styles/Bookings.css';
import '../styles/ReviewPopup.css';

const formatAddress = (address) => {
    if (!address) return 'N/A';
    if (typeof address === 'string') return address;

    return [address.addressLine, address.city, address.state, address.zipcode]
        .filter(Boolean)
        .join(', ') || 'N/A';
};

/* ─────────────── Review Popup ─────────────── */
const ReviewPopup = ({ bookingId, onClose, onReviewed }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);
    const [hoverStar, setHoverStar] = useState(0);
    const [selectedStar, setSelectedStar] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        bookingService.getReviewableServices(bookingId)
            .then(res => {
                if (res.success) {
                    setServices(res.data.services || []);
                    const first = res.data.services?.[0];
                    if (first?.existingReview) {
                        setSelectedStar(first.existingReview.rating);
                        setReviewText(first.existingReview.review || '');
                    }
                }
            })
            .catch(() => toast.error('Failed to load services'))
            .finally(() => setLoading(false));
    }, [bookingId]);

    const current = services[activeIdx];
    const existing = current?.existingReview;

    const switchService = (idx) => {
        setActiveIdx(idx);
        const item = services[idx];
        setSelectedStar(item?.existingReview?.rating || 0);
        setReviewText(item?.existingReview?.review || '');
        setHoverStar(0);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedStar || !current || submitting) return;
        setSubmitting(true);
        try {
            const payload = { rating: selectedStar, review: reviewText.trim(), bookingId };
            await bookingService.submitServiceReview(current.service._id, payload);
            toast.success(existing ? 'Review updated!' : 'Review submitted!');
            if (activeIdx < services.length - 1) {
                switchService(activeIdx + 1);
            } else {
                if (onReviewed) onReviewed();
                onClose();
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const characterLimit = Math.max(500, existing?.review?.length || 0);

    return (
        <Modal show centered scrollable dialogClassName="service-review-dialog" aria-labelledby="service-review-title"
            onHide={() => { if (!submitting) onClose(); }} backdrop={submitting ? 'static' : true} keyboard={!submitting}>
            <Modal.Body>
                <div className="service-review-handle" aria-hidden="true" />
                <button className="service-review-close" type="button" onClick={onClose} disabled={submitting} aria-label="Close review">×</button>
                <header className="service-review-header">
                    <h2 id="service-review-title">Rate &amp; Review Service</h2>
                    <p>Your feedback helps us improve and serve you better.</p>
                </header>
                {loading ? <div className="service-review-message" role="status">Loading…</div>
                    : services.length === 0 ? <div className="service-review-message">No services available for review.</div> : (
                    <>
                        {services.length > 1 && <div className="service-review-tabs" aria-label="Choose a service to review">
                            {services.map((item, index) => <button key={item.service._id} type="button" disabled={submitting}
                                className={index === activeIdx ? 'active' : ''} aria-pressed={index === activeIdx} onClick={() => switchService(index)}>
                                {item.service.name}{item.existingReview && <span title="Already reviewed"> ✓</span>}
                            </button>)}
                        </div>}
                        <div className="service-review-preview">
                            <div className="service-review-photo">
                                <FiTool aria-hidden="true" />
                                {current.service.featuredImage && <img src={resolveImageUrl(current.service.featuredImage)} alt={current.service.name}
                                    onError={event => { event.currentTarget.style.display = 'none'; }} />}
                            </div>
                            <div className="service-review-service-info">
                                <h3>{current.service.name}</h3>
                                <div className="service-review-completed"><span /> Completed service</div>
                                {existing && <div className="service-review-existing">Already reviewed — you can update it</div>}
                            </div>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="service-review-rating-section">
                                <h3 id="service-review-rating-label">How was your service?</h3>
                                <p>Tap a star to rate your experience.</p>
                                <div className="service-review-stars" role="group" aria-labelledby="service-review-rating-label" onMouseLeave={() => setHoverStar(0)}>
                                    {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" disabled={submitting}
                                        className={star <= (hoverStar || selectedStar) ? 'filled' : ''}
                                        aria-label={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`} aria-pressed={selectedStar === star}
                                        onMouseEnter={() => setHoverStar(star)} onFocus={() => setHoverStar(star)} onBlur={() => setHoverStar(0)}
                                        onClick={() => setSelectedStar(star)}>
                                        {star <= (hoverStar || selectedStar) ? <FaStar /> : <FiStar />}
                                    </button>)}
                                </div>
                                <span className="visually-hidden" role="status">{selectedStar ? `${selectedStar} out of 5 stars selected` : 'No rating selected'}</span>
                            </div>
                            <label className="service-review-comment-label" htmlFor="service-review-comment">Share your experience <span>(Optional)</span></label>
                            <div className="service-review-comment-box">
                                <textarea id="service-review-comment" rows={4} placeholder="Tell us about your experience (optional)"
                                    disabled={submitting} value={reviewText} onChange={event => setReviewText(event.target.value)}
                                    maxLength={characterLimit} aria-describedby="service-review-count" />
                                <span id="service-review-count" className="service-review-count">{reviewText.length}/{characterLimit}</span>
                            </div>
                            <button className="service-review-submit" type="submit" disabled={submitting || !selectedStar}>
                                {submitting ? 'Submitting…' : existing ? 'Update Review' : activeIdx < services.length - 1 ? 'Submit & Next' : 'Submit Review'} <FiArrowRight aria-hidden="true" />
                            </button>
                        </form>
                        {services.length > 1 && <p className="service-review-progress">{activeIdx + 1} of {services.length} services</p>}
                        <p className="service-review-footer">Your feedback helps us improve our service.</p>
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

/* ─────────────── BookingCard ─────────────── */
const BookingCard = ({ booking, onCancelled }) => {
    const [cancelling, setCancelling] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [showReview, setShowReview] = useState(false);

    const [showInvoice, setShowInvoice] = useState(false);
    const status = (booking.status || 'pending').toLowerCase();
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';
    const canCancel = !['assigned', 'on the way', 'in progress', 'checkout', 'completed', 'cancelled'].includes(status);
    const service = booking.services?.[0]?.service;
    const serviceName = service?.name || 'Service';
    const imageUrl = resolveImageUrl(service?.featuredImage);
    const badgeTone = isCompleted ? 'completed' : isCancelled ? 'cancelled' : ['pending', 'checkout'].includes(status) ? 'pending' : 'confirmed';
    const date = new Date(booking.serviceDate);
    const serviceTime = !Number.isNaN(date.getTime()) && (date.getHours() || date.getMinutes())
        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

    const serviceDateFormatted = new Date(booking.serviceDate).toLocaleDateString('en-US', {
        weekday: 'short', day: 'numeric', month: 'short',
    });

    const statusLabel = status === 'pending' ? 'PENDING CONFIRMATION' : status.toUpperCase();
    const address = formatAddress(booking.address);
    const technician = booking.assignedTechnician || {};

    const getStatusStyle = () => {
        const s = (booking.status || '').toLowerCase();
        if (s === 'completed') return styles.completedBadge;
        if (s === 'cancelled') return styles.cancelledBadge;
        if (s === 'confirmed') return styles.confirmedBadge;
        if (s === 'assigned' || s === 'on the way') return styles.confirmedBadge;
        if (s === 'pending' || s === 'in progress' || s === 'checkout') return styles.pendingBadge;
        if (s === 'rescheduled') return styles.rescheduledBadge;
        return styles.defaultBadge;
    };

    const handleCancel = async () => {
        if (!booking?._id) return;
        setCancelling(true);
        try {
            const res = await bookingService.cancelBooking(booking._id);
            if (res?.success) {
                toast.success('Booking cancelled successfully');
                if (onCancelled) onCancelled(booking._id);
            } else {
                toast.error(res?.message || 'Unable to cancel booking');
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Unable to cancel booking');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <>
            <article className="booking-card">
                <div className="booking-card-photo">
                    <div className="booking-card-photo-fallback"><FiTool aria-hidden="true" /><span>{serviceName}</span></div>
                    {imageUrl && <img src={imageUrl} alt={serviceName} loading="lazy"
                        onError={event => { event.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="booking-card-status-row">
                    <span className="booking-card-category"><i className={`booking-status-dot ${badgeTone}`} />
                        {isCompleted ? 'Completed service' : isCancelled ? 'Cancelled service' : 'Upcoming service'}
                    </span>
                    <span className={`booking-status-badge ${badgeTone}`}>{statusLabel}</span>
                </div>
                <div className="booking-card-title-row">
                    <h2>{serviceName}{booking.services?.length > 1 && <small> +{booking.services.length - 1} more</small>}</h2>
                    <span className="booking-card-price">${Number(booking.totalAmount || 0).toLocaleString('en-US')}</span>
                </div>
                <div className="booking-card-info">
                    <div className="booking-card-info-row">
                        <span className="booking-card-info-icon"><FiCalendar /></span>
                        <div><span className="booking-card-info-label">Date &amp; Time</span>
                            <div className="booking-card-info-value strong">{Number.isNaN(date.getTime()) ? 'Not scheduled' : serviceDateFormatted}{serviceTime && ` • ${serviceTime}`}</div>
                        </div>
                    </div>
                    <div className="booking-card-info-row">
                        <span className="booking-card-info-icon"><FiMapPin /></span>
                        <div><span className="booking-card-info-label">Location</span><div className="booking-card-info-value">{address}</div></div>
                    </div>
                    <div className="booking-card-info-row">
                        <span className="booking-card-info-icon"><FiUser /></span>
                        <div><span className="booking-card-info-label">Technician Assigned</span>
                            <div className={`booking-card-info-value ${technician.name || technician.phone ? 'strong' : 'awaiting'}`}>
                                {technician.name || (technician.phone ? 'Technician assigned' : 'Awaiting assignment')}{technician.phone && ` • ${technician.phone}`}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="booking-card-actions">
                    <button className="booking-action-primary" onClick={isCompleted ? () => setShowInvoice(true) : () => setShowDetails(true)}>
                        {isCompleted ? 'Download Invoice' : technician.name ? 'View Specialist & Booking Details' : 'View Booking Details'} <FiArrowRight />
                    </button>
                    {isCompleted && <div className="booking-card-secondary-actions">
                        <button className="booking-action-secondary" onClick={() => setShowDetails(true)}>View Details</button>
                        <button className="booking-action-secondary" onClick={() => setShowReview(true)}><FiStar /> Rate &amp; Review Service</button>
                    </div>}
                    {canCancel && <button className="booking-action-secondary" onClick={handleCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel Booking'}</button>}
                </div>
            </article>

            {/* Review popup */}
            {showInvoice && <InvoicePreview bookingId={booking._id} onClose={() => setShowInvoice(false)} />}
            {showReview && (
                <ReviewPopup
                    bookingId={booking._id}
                    onClose={() => setShowReview(false)}
                    onReviewed={() => { if (onCancelled) onCancelled(); }}
                />
            )}


            {/* Details modal — unchanged */}
            {showDetails && (
                <div style={styles.modalOverlay} onClick={() => setShowDetails(false)}>
                    <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.closeButton} onClick={() => setShowDetails(false)} aria-label="Close">✕</button>
                        <div style={styles.modalHeader}>
                            <div>
                                <div style={styles.modalEyebrow}>Booking Details</div>
                                <div style={styles.modalTitle}>{booking.services?.[0]?.service?.name || 'Service Booking'}</div>
                            </div>
                            <span style={{ ...styles.badge, ...getStatusStyle() }}>{statusLabel}</span>
                        </div>
                        <div style={styles.modalBody}>
                            <div style={styles.detailGrid}>
                                <div style={styles.detailBlock}><div style={styles.detailLabel}>Booking ID</div><div style={styles.detailValue}>{booking._id}</div></div>
                                <div style={styles.detailBlock}><div style={styles.detailLabel}>Payment</div><div style={styles.detailValue}>{booking.paymentStatus || 'N/A'}</div></div>
                                <div style={styles.detailBlock}><div style={styles.detailLabel}>Date</div><div style={styles.detailValue}>{serviceDateFormatted}</div></div>
                                <div style={styles.detailBlock}><div style={styles.detailLabel}>Phone</div><div style={styles.detailValue}>{booking.phone || 'N/A'}</div></div>
                                <div style={styles.detailBlock}><div style={styles.detailLabel}>Address</div><div style={styles.detailValue}>{address}</div></div>
                            </div>
                            <div style={styles.sectionCard}>
                                <div style={styles.sectionTitle}>Service Summary</div>
                                <div style={styles.serviceSummaryRow}>
                                    <div><div style={styles.sectionLabel}>Service</div><div style={styles.sectionValue}>{booking.services?.[0]?.service?.name || 'Service'}</div></div>
                                    <div><div style={styles.sectionLabel}>Quantity</div><div style={styles.sectionValue}>{booking.services?.[0]?.quantity || 1}</div></div>
                                    <div><div style={styles.sectionLabel}>Amount</div><div style={styles.sectionValue}>${booking.totalAmount?.toLocaleString('en-US')}</div></div>
                                </div>
                                <div style={styles.mutedText}>{booking.services?.[0]?.service?.description || booking.services?.[0]?.service?.longDescription || 'No description provided.'}</div>
                            </div>
                            <div style={styles.sectionCard}>
                                <div style={styles.sectionTitle}>Technician & Instructions</div>

                                {technician?.name ? (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "12px",
                                            marginBottom: "16px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "40px",
                                                    height: "40px",
                                                    borderRadius: "50%",
                                                    background: "#F3F4F6",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "18px",
                                                }}
                                            >
                                                👤
                                            </div>

                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#6B7280",
                                                        textTransform: "uppercase",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Technician
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "16px",
                                                        fontWeight: 600,
                                                        color: "#111827",
                                                    }}
                                                >
                                                    {technician.name}
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "40px",
                                                    height: "40px",
                                                    borderRadius: "50%",
                                                    background: "#F3F4F6",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "18px",
                                                }}
                                            >
                                                📞
                                            </div>

                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#6B7280",
                                                        textTransform: "uppercase",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Phone
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "16px",
                                                        fontWeight: 600,
                                                        color: "#111827",
                                                    }}
                                                >
                                                    {technician.phone || "No phone"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            padding: "14px",
                                            background: "#F9FAFB",
                                            border: "1px solid #E5E7EB",
                                            borderRadius: "10px",
                                            color: "#6B7280",
                                            marginBottom: "16px",
                                        }}
                                    >
                                        👨‍🔧 Awaiting assignment
                                    </div>
                                )}

                                <div
                                    style={{
                                        borderTop: "1px solid #E5E7EB",
                                        paddingTop: "16px",
                                        display: "flex",
                                        gap: "12px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "50%",
                                            background: "#F3F4F6",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "18px",
                                            flexShrink: 0,
                                        }}
                                    >
                                        📝
                                    </div>

                                    <div>
                                        <div
                                            style={{
                                                fontSize: "12px",
                                                color: "#6B7280",
                                                textTransform: "uppercase",
                                                fontWeight: 600,
                                                marginBottom: "4px",
                                            }}
                                        >
                                            Special Instructions
                                        </div>

                                        <div
                                            style={{
                                                color: "#374151",
                                                lineHeight: "22px",
                                                fontSize: "14px",
                                            }}
                                        >
                                            {booking.specialInstructions ||
                                                "No special instructions provided."}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* <div style={styles.sectionCard}>
                                <div style={styles.sectionTitle}>Extras</div>
                                <div style={styles.mutedText}>Service type: {booking.services?.[0]?.service?.serviceType || 'N/A'}</div>
                                <div style={styles.mutedText}>Duration: {booking.services?.[0]?.service?.serviceDuration || booking.services?.[0]?.service?.duration || 'N/A'} mins</div>
                                <div style={styles.mutedText}>Created: {new Date(booking.createdAt).toLocaleString()}</div>
                                <div style={styles.mutedText}>Updated: {new Date(booking.updatedAt).toLocaleString()}</div>
                            </div> */}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

/* ─────────────── Card styles (unchanged) ─────────────── */
const styles = {
    card: { border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 24 },
    header: { backgroundColor: '#f2f2f2', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    headerLabel: { fontSize: 12, fontWeight: 600, letterSpacing: 1.5, color: '#555', textTransform: 'uppercase' },
    badge: { color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '4px 12px', borderRadius: 4 },
    completedBadge: { backgroundColor: '#ecfdf5', color: '#047857' },
    cancelledBadge: { backgroundColor: '#fef2f2', color: '#b91c1c' },
    confirmedBadge: { backgroundColor: '#eff6ff', color: '#2563eb' },
    pendingBadge: { backgroundColor: '#fffbeb', color: '#b45309' },
    rescheduledBadge: { backgroundColor: '#000000' },
    defaultBadge: { backgroundColor: '#111' },
    body: { padding: '20px' },
    serviceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    serviceName: { fontWeight: 700, fontSize: 16, color: '#111' },
    price: { fontWeight: 700, fontSize: 16, color: '#111', whiteSpace: 'nowrap' },
    infoBox: { display: 'flex', alignItems: 'flex-start', gap: 12, backgroundColor: '#f7f7f7', borderRadius: 8, padding: '12px 16px', marginBottom: 10 },
    infoIcon: { fontSize: 18, marginTop: 2 },
    infoLabel: { fontSize: 12, color: '#888', fontWeight: 500 },
    infoValue: { fontSize: 14, color: '#111', fontWeight: 500, marginTop: 2 },
    btnPrimary: { width: '100%', backgroundColor: '#000000', color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontWeight: 600, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer', marginTop: 12, marginBottom: 8 },
    btnReview: { width: '100%', backgroundColor: '#000000', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontWeight: 600, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer', marginBottom: 8 },
    btnSecondary: { width: '100%', backgroundColor: '#fff', color: '#000000', border: '1.5px solid #000000', borderRadius: 8, padding: '13px', fontWeight: 600, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 2000 },
    modalCard: { width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', position: 'relative', padding: 24 },
    closeButton: { position: 'absolute', top: 12, right: 12, border: 'none', background: '#f3f3f3', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#333' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
    modalEyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.4, color: '#6b7280', fontWeight: 700, marginBottom: 6 },
    modalTitle: { fontSize: 22, fontWeight: 800, color: '#111' },
    modalBody: { display: 'flex', flexDirection: 'column', gap: 14 },
    detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
    detailBlock: { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 },
    detailLabel: { fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
    detailValue: { fontSize: 14, color: '#111', fontWeight: 600, lineHeight: 1.5 },
    sectionCard: { background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' },
    sectionTitle: { fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 8 },
    serviceSummaryRow: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
    sectionLabel: { fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' },
    sectionValue: { fontSize: 14, color: '#111', fontWeight: 700 },
    mutedText: { fontSize: 13, color: '#4b5563', lineHeight: 1.6, marginTop: 4 },
};

export default BookingCard;
