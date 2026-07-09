import React, { useState } from 'react';
import { toast } from 'react-toastify';
import bookingService from '../services/bookingService';

const BookingCard = ({ booking, onCancelled }) => {
    const [cancelling, setCancelling] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const serviceDateFormatted = new Date(booking.serviceDate).toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    const statusLabel = booking.status?.toUpperCase();
    const address = booking.address || 'N/A';
    const technician = booking.assignedTechnician || {};

    const getStatusStyle = () => {
        const status = (booking.status || '').toLowerCase();
        if (status === 'completed') return styles.completedBadge;
        if (status === 'cancelled') return styles.cancelledBadge;
        if (status === 'confirmed') return styles.confirmedBadge;
        if (status === 'pending' || status === 'in progress') return styles.pendingBadge;
        if (status === 'rescheduled') return styles.rescheduledBadge;
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
        <div style={styles.card}>
            <div style={styles.header}>
                <span style={styles.headerLabel}>UPCOMING SERVICE</span>
                <span style={{ ...styles.badge, ...getStatusStyle() }}>{statusLabel}</span>
            </div>

            <div style={styles.body}>
                <div style={styles.serviceRow}>
                    <div>
                        <div style={styles.serviceName}>
                            {booking.services?.[0]?.service?.name || 'Service'}
                        </div>

                    </div>
                    <div style={styles.price}>₹{booking.totalAmount?.toLocaleString('en-IN')}</div>
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

                <button
                    style={styles.btnPrimary}
                    onClick={() => setShowDetails(true)}
                >
                    View Details
                </button>
                {!["completed", "cancelled"].includes((booking.status || "").toLowerCase()) && (
                    <button
                        style={styles.btnSecondary}
                        onClick={handleCancel}
                        disabled={cancelling}
                    >
                        {cancelling ? "Cancelling..." : "Cancel Booking"}
                    </button>
                )}
            </div>

            {showDetails && (
                <div style={styles.modalOverlay} onClick={() => setShowDetails(false)}>
                    <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.closeButton} onClick={() => setShowDetails(false)} aria-label="Close booking details">✕</button>

                        <div style={styles.modalHeader}>
                            <div>
                                <div style={styles.modalEyebrow}>Booking Details</div>
                                <div style={styles.modalTitle}>{booking.services?.[0]?.service?.name || 'Service Booking'}</div>
                            </div>
                            <span style={{ ...styles.badge, ...getStatusStyle() }}>{statusLabel}</span>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.detailGrid}>
                                <div style={styles.detailBlock}>
                                    <div style={styles.detailLabel}>Booking ID</div>
                                    <div style={styles.detailValue}>{booking._id}</div>
                                </div>
                                <div style={styles.detailBlock}>
                                    <div style={styles.detailLabel}>Payment</div>
                                    <div style={styles.detailValue}>{booking.paymentStatus || 'N/A'}</div>
                                </div>
                                <div style={styles.detailBlock}>
                                    <div style={styles.detailLabel}>Date</div>
                                    <div style={styles.detailValue}>{serviceDateFormatted}</div>
                                </div>
                                <div style={styles.detailBlock}>
                                    <div style={styles.detailLabel}>Time Slot</div>
                                    <div style={styles.detailValue}>{booking.timeSlot || 'N/A'}</div>
                                </div>
                                <div style={styles.detailBlock}>
                                    <div style={styles.detailLabel}>Phone</div>
                                    <div style={styles.detailValue}>{booking.phone || 'N/A'}</div>
                                </div>
                                <div style={styles.detailBlock}>
                                    <div style={styles.detailLabel}>Address</div>
                                    <div style={styles.detailValue}>{address}</div>
                                </div>
                            </div>

                            <div style={styles.sectionCard}>
                                <div style={styles.sectionTitle}>Service Summary</div>
                                <div style={styles.serviceSummaryRow}>
                                    <div>
                                        <div style={styles.sectionLabel}>Service</div>
                                        <div style={styles.sectionValue}>{booking.services?.[0]?.service?.name || 'Service'}</div>
                                    </div>
                                    <div>
                                        <div style={styles.sectionLabel}>Quantity</div>
                                        <div style={styles.sectionValue}>{booking.services?.[0]?.quantity || 1}</div>
                                    </div>
                                    <div>
                                        <div style={styles.sectionLabel}>Amount</div>
                                        <div style={styles.sectionValue}>₹{booking.totalAmount?.toLocaleString('en-IN')}</div>
                                    </div>
                                </div>
                                <div style={styles.mutedText}>{booking.services?.[0]?.service?.description || booking.services?.[0]?.service?.longDescription || 'No description provided.'}</div>
                            </div>

                            <div style={styles.sectionCard}>
                                <div style={styles.sectionTitle}>Technician & Instructions</div>
                                <div style={styles.sectionValue}>{technician?.name ? `${technician.name} • ${technician.phone || 'No phone'}` : 'Awaiting assignment'}</div>
                                <div style={styles.mutedText}>{booking.specialInstructions || 'No special instructions provided.'}</div>
                            </div>

                            <div style={styles.sectionCard}>
                                <div style={styles.sectionTitle}>Extras from API</div>
                                <div style={styles.mutedText}>Service type: {booking.services?.[0]?.service?.serviceType || 'N/A'}</div>
                                <div style={styles.mutedText}>Duration: {booking.services?.[0]?.service?.serviceDuration || booking.services?.[0]?.service?.duration || 'N/A'} mins</div>
                                <div style={styles.mutedText}>Created: {new Date(booking.createdAt).toLocaleString()}</div>
                                <div style={styles.mutedText}>Updated: {new Date(booking.updatedAt).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    card: {
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
        marginBottom: 24,
    },
    header: {
        backgroundColor: '#f2f2f2',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLabel: {
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 1.5,
        color: '#555',
        textTransform: 'uppercase',
    },
    badge: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        padding: '4px 12px',
        borderRadius: 4,
    },
    completedBadge: { backgroundColor: '#2e7d32' },
    cancelledBadge: { backgroundColor: '#c62828' },
    confirmedBadge: { backgroundColor: '#f57c00' },
    pendingBadge: { backgroundColor: '#1976d2' },
    rescheduledBadge: { backgroundColor: '#5e35b1' },
    defaultBadge: { backgroundColor: '#111' },
    body: {
        padding: '20px',
    },
    serviceRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    serviceName: {
        fontWeight: 700,
        fontSize: 16,
        color: '#111',
    },
    serviceSubtitle: {
        fontSize: 13,
        color: '#777',
        marginTop: 2,
    },
    price: {
        fontWeight: 700,
        fontSize: 16,
        color: '#111',
        whiteSpace: 'nowrap',
    },
    infoBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#f7f7f7',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 10,
    },
    infoIcon: {
        fontSize: 18,
        marginTop: 2,
    },
    infoLabel: {
        fontSize: 12,
        color: '#888',
        fontWeight: 500,
    },
    infoValue: {
        fontSize: 14,
        color: '#111',
        fontWeight: 500,
        marginTop: 2,
    },
    btnPrimary: {
        width: '100%',
        backgroundColor: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '14px',
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: 0.5,
        cursor: 'pointer',
        marginTop: 12,
        marginBottom: 8,
    },
    btnSecondary: {
        width: '100%',
        backgroundColor: '#fff',
        color: '#c62828',
        border: '1.5px solid #c62828',
        borderRadius: 8,
        padding: '13px',
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: 0.5,
        cursor: 'pointer',
        opacity: 1,
    },
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 2000,
    },
    modalCard: {
        width: '100%',
        maxWidth: 760,
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        position: 'relative',
        padding: 24,
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        border: 'none',
        background: '#f3f3f3',
        borderRadius: '50%',
        width: 36,
        height: 36,
        cursor: 'pointer',
        fontSize: 18,
        color: '#333',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 18,
    },
    modalEyebrow: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1.4,
        color: '#6b7280',
        fontWeight: 700,
        marginBottom: 6,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 800,
        color: '#111',
    },
    modalBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
    },
    detailGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 12,
    },
    detailBlock: {
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: 700,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    detailValue: {
        fontSize: 14,
        color: '#111',
        fontWeight: 600,
        lineHeight: 1.5,
    },
    sectionCard: {
        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
        borderRadius: 12,
        padding: 14,
        border: '1px solid #e5e7eb',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 800,
        color: '#111',
        marginBottom: 8,
    },
    serviceSummaryRow: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    sectionLabel: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: 700,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    sectionValue: {
        fontSize: 14,
        color: '#111',
        fontWeight: 700,
    },
    mutedText: {
        fontSize: 13,
        color: '#4b5563',
        lineHeight: 1.6,
        marginTop: 4,
    },
};

export default BookingCard;
