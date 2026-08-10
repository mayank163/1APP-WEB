import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import bookingService from '../services/bookingService';
import { resolveImageUrl } from '../services/api';

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

    const handleSubmit = async () => {
        if (!selectedStar || !current) return;
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

    return (
        <div style={popupStyles.overlay} onClick={onClose}>
            <div style={popupStyles.sheet} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={popupStyles.header}>
                    <div>
                        <div style={popupStyles.eyebrow}>Rate your experience</div>
                        <div style={popupStyles.title}>Write a Review</div>
                    </div>
                    <button style={popupStyles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading…</div>
                ) : services.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        No services available for review.
                    </div>
                ) : (
                    <>
                        {/* Service tabs — only show when multiple services */}
                        {services.length > 1 && (
                            <div style={popupStyles.tabRow}>
                                {services.map((s, i) => (
                                    <button
                                        key={s.service._id}
                                        onClick={() => switchService(i)}
                                        style={{
                                            ...popupStyles.tab,
                                            ...(i === activeIdx ? popupStyles.tabActive : {}),
                                        }}
                                    >
                                        {s.service.name}
                                        {s.existingReview && (
                                            <span style={popupStyles.reviewedDot} title="Already reviewed">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Service info */}
                        <div style={popupStyles.serviceCard}>
                            {current.service.featuredImage && (
                                <img
                                    src={resolveImageUrl(current.service.featuredImage)}
                                    alt={current.service.name}
                                    style={popupStyles.serviceImg}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={popupStyles.serviceName}>{current.service.name}</div>
                                {existing && (
                                    <div style={popupStyles.existingBadge}>
                                        ✓ Already reviewed — you can update it
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Star rating */}
                        <div style={popupStyles.starLabel}>Your rating</div>
                        <div style={popupStyles.starRow}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <span
                                    key={s}
                                    onMouseEnter={() => setHoverStar(s)}
                                    onMouseLeave={() => setHoverStar(0)}
                                    onClick={() => setSelectedStar(s)}
                                    style={{
                                        fontSize: 38,
                                        cursor: 'pointer',
                                        color: s <= (hoverStar || selectedStar) ? '#F59E0B' : '#E5E7EB',
                                        transition: 'color 0.1s',
                                        lineHeight: 1,
                                        userSelect: 'none',
                                    }}
                                >★</span>
                            ))}
                        </div>
                        {selectedStar > 0 && (
                            <div style={popupStyles.starCaption}>
                                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][selectedStar]}
                            </div>
                        )}

                        {/* Review text */}
                        <textarea
                            rows={4}
                            placeholder="Share your experience (optional)..."
                            value={reviewText}
                            onChange={e => setReviewText(e.target.value)}
                            maxLength={1000}
                            style={popupStyles.textarea}
                        />

                        {/* Actions */}
                        <div style={popupStyles.actions}>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !selectedStar}
                                style={{
                                    ...popupStyles.submitBtn,
                                    opacity: selectedStar ? 1 : 0.5,
                                    cursor: selectedStar ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {submitting
                                    ? 'Submitting…'
                                    : existing
                                        ? 'Update Review'
                                        : activeIdx < services.length - 1
                                            ? 'Submit & Next →'
                                            : 'Submit Review'}
                            </button>
                            <button onClick={onClose} style={popupStyles.cancelBtn}>Cancel</button>
                        </div>

                        {/* Progress indicator for multiple services */}
                        {services.length > 1 && (
                            <div style={popupStyles.progress}>
                                {activeIdx + 1} of {services.length} services
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/* ─────────────── BookingCard ─────────────── */
const BookingCard = ({ booking, onCancelled }) => {
    const [cancelling, setCancelling] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [showReview, setShowReview] = useState(false);

    const isCompleted = (booking.status || '').toLowerCase() === 'completed';

    const serviceDateFormatted = new Date(booking.serviceDate).toLocaleDateString('en-US', {
        weekday: 'short', day: 'numeric', month: 'short',
    });

    const statusLabel = booking.status?.toUpperCase();
    const address = booking.address || 'N/A';
    const technician = booking.assignedTechnician || {};

    const getStatusStyle = () => {
        const s = (booking.status || '').toLowerCase();
        if (s === 'completed') return styles.completedBadge;
        if (s === 'cancelled') return styles.cancelledBadge;
        if (s === 'confirmed') return styles.confirmedBadge;
        if (s === 'pending' || s === 'in progress') return styles.pendingBadge;
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
            <div style={styles.card}>
                <div style={styles.header}>
                    <span style={styles.headerLabel}>
                        {isCompleted ? 'COMPLETED SERVICE' : 'UPCOMING SERVICE'}
                    </span>
                    <span style={{ ...styles.badge, ...getStatusStyle() }}>{statusLabel}</span>
                </div>

                <div style={styles.body}>
                    <div style={styles.serviceRow}>
                        <div style={styles.serviceName}>
                            {booking.services?.[0]?.service?.name || 'Service'}
                        </div>
                        <div style={styles.price}>${booking.totalAmount?.toLocaleString('en-US')}</div>
                    </div>

                    <div style={styles.infoBox}>
                        <span style={styles.infoIcon}>📅</span>
                        <div>
                            <div style={styles.infoLabel}>Date &amp; Time</div>
                            <div style={styles.infoValue}>{serviceDateFormatted} · {booking.timeSlot}</div>
                        </div>
                    </div>

                    <div style={styles.infoBox}>
                        <span style={styles.infoIcon}>📍</span>
                        <div>
                            <div style={styles.infoLabel}>Location</div>
                            <div style={styles.infoValue}>{address}</div>
                        </div>
                    </div>

                    {technician?.name || technician?.phone ? (
                        <div style={styles.infoBox}>
                            <span style={styles.infoIcon}>🧑‍🔧</span>
                            <div>
                                <div style={styles.infoLabel}>Technician Assigned</div>
                                <div style={styles.infoValue}>
                                    {technician.name || 'Technician assigned'}
                                    {technician.phone ? ` • ${technician.phone}` : ''}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ ...styles.infoBox, backgroundColor: '#f9fbf9' }}>
                            <span style={styles.infoIcon}>🧑‍🔧</span>
                            <div>
                                <div style={styles.infoLabel}>Technician Assigned</div>
                                <div style={styles.infoValue}>Awaiting assignment</div>
                            </div>
                        </div>
                    )}

                    <button style={styles.btnPrimary} onClick={() => setShowDetails(true)}>
                        View Details
                    </button>

                    {/* Rate & Review — only for completed bookings */}
                    {isCompleted && (
                        <button style={styles.btnReview} onClick={() => setShowReview(true)}>
                            ★ Rate &amp; Review
                        </button>
                    )}

                    {!['completed', 'cancelled'].includes((booking.status || '').toLowerCase()) && (
                        <button style={styles.btnSecondary} onClick={handleCancel} disabled={cancelling}>
                            {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                    )}
                </div>
            </div>

            {/* Review popup */}
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
                                <div style={styles.detailBlock}><div style={styles.detailLabel}>Time Slot</div><div style={styles.detailValue}>{booking.timeSlot || 'N/A'}</div></div>
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

/* ─────────────── Popup styles ─────────────── */
const popupStyles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '0',
    },
    sheet: {
        width: '100%',
        maxWidth: 540,
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        padding: '28px 24px 36px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.4,
        color: '#000000',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: 800,
        color: '#111',
    },
    closeBtn: {
        border: 'none',
        background: '#f3f3f3',
        borderRadius: '50%',
        width: 36,
        height: 36,
        cursor: 'pointer',
        fontSize: 16,
        color: '#333',
        flexShrink: 0,
    },
    tabRow: {
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        marginBottom: 16,
        paddingBottom: 4,
        scrollbarWidth: 'none',
    },
    tab: {
        padding: '7px 14px',
        borderRadius: 20,
        border: '1.5px solid #ddd',
        background: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        color: '#555',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    tabActive: {
        border: '1.5px solid #000000',
        background: '#fdf5ea',
        color: '#000000',
    },
    reviewedDot: {
        fontSize: 11,
        color: '#22c55e',
        fontWeight: 800,
    },
    serviceCard: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: '#f7f8fa',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 20,
    },
    serviceImg: {
        width: 56,
        height: 56,
        borderRadius: 10,
        objectFit: 'cover',
        flexShrink: 0,
    },
    serviceName: {
        fontWeight: 700,
        fontSize: 15,
        color: '#111',
    },
    existingBadge: {
        marginTop: 4,
        fontSize: 12,
        color: '#22c55e',
        fontWeight: 600,
    },
    starLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: '#555',
        marginBottom: 8,
    },
    starRow: {
        display: 'flex',
        gap: 6,
        marginBottom: 8,
    },
    starCaption: {
        fontSize: 13,
        fontWeight: 700,
        color: '#F59E0B',
        marginBottom: 16,
    },
    textarea: {
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        border: '1.5px solid #e5e7eb',
        fontSize: 14,
        resize: 'vertical',
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        color: '#111',
        marginBottom: 16,
    },
    actions: {
        display: 'flex',
        gap: 10,
    },
    submitBtn: {
        flex: 1,
        padding: '13px',
        background: '#1a1a2e',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
    },
    cancelBtn: {
        padding: '13px 20px',
        background: '#fff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        color: '#555',
    },
    progress: {
        textAlign: 'center',
        fontSize: 13,
        color: '#888',
        marginTop: 14,
    },
};

/* ─────────────── Card styles (unchanged) ─────────────── */
const styles = {
    card: { border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 24 },
    header: { backgroundColor: '#f2f2f2', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    headerLabel: { fontSize: 12, fontWeight: 600, letterSpacing: 1.5, color: '#555', textTransform: 'uppercase' },
    badge: { color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '4px 12px', borderRadius: 4 },
    completedBadge: { backgroundColor: '#000000' },
    cancelledBadge: { backgroundColor: '#c62828' },
    confirmedBadge: { backgroundColor: '#f57c00' },
    pendingBadge: { backgroundColor: '#1976d2' },
    rescheduledBadge: { backgroundColor: '#5e35b1' },
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
    btnReview: { width: '100%', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontWeight: 600, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer', marginBottom: 8 },
    btnSecondary: { width: '100%', backgroundColor: '#fff', color: '#c62828', border: '1.5px solid #c62828', borderRadius: 8, padding: '13px', fontWeight: 600, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer' },
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
