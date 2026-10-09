import '../styles/BookingCard.css';
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
const ReviewPopup = ({ bookingId, onClose, onReviewed, technicianMode = false }) => {
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
                    const technician = res.data.technician;
                    const items = technicianMode
                        ? (technician?.name || technician?.phone ? [{ service: { _id: bookingId, name: technician.name || 'Assigned technician' }, existingReview: res.data.technicianReview }] : [])
                        : res.data.services || [];
                    setServices(items);
                    const first = items[0];
                    if (first?.existingReview) {
                        setSelectedStar(first.existingReview.rating);
                        setReviewText(first.existingReview.review || '');
                    }
                }
            })
            .catch(() => toast.error('Failed to load services'))
            .finally(() => setLoading(false));
    }, [bookingId, technicianMode]);

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
            if (technicianMode) await bookingService.submitTechnicianReview(bookingId, { rating: selectedStar, review: reviewText.trim() });
            else await bookingService.submitServiceReview(current.service._id, payload);
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
                    <h2 id="service-review-title">{technicianMode ? 'Rate & Review Technician' : 'Rate & Review Service'}</h2>
                    <p>Your feedback helps us improve and serve you better.</p>
                </header>
                {loading ? <div className="service-review-message" role="status">Loading…</div>
                    : services.length === 0 ? <div className="service-review-message">{technicianMode ? 'No technician available for review.' : 'No services available for review.'}</div> : (
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
                                    onError={event => { event.currentTarget.classList.add('ui-image-hidden'); }} />}
                            </div>
                            <div className="service-review-service-info">
                                <h3>{current.service.name}</h3>
                                <div className="service-review-completed"><span /> Completed service</div>
                                {existing && <div className="service-review-existing">Already reviewed — you can update it</div>}
                            </div>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="service-review-rating-section">
                                <h3 id="service-review-rating-label">{technicianMode ? 'How was your technician?' : 'How was your service?'}</h3>
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
    const [showTechnicianReview, setShowTechnicianReview] = useState(false);

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

    const getStatusClass = () => {
        const s = (booking.status || '').toLowerCase();
        if (s === 'completed') return 'booking-detail-status-completed';
        if (s === 'cancelled') return 'booking-detail-status-cancelled';
        if (s === 'confirmed') return 'booking-detail-status-confirmed';
        if (s === 'assigned' || s === 'on the way') return 'booking-detail-status-confirmed';
        if (s === 'pending' || s === 'in progress' || s === 'checkout') return 'booking-detail-status-pending';
        if (s === 'rescheduled') return 'booking-detail-status-rescheduled';
        return 'booking-detail-status-default';
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
                        onError={event => { event.currentTarget.classList.add('ui-image-hidden'); }} />}
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
                            <div className={`booking-card-info-value ${technician.name ? 'strong' : 'awaiting'}`}>
                                {technician.name || 'Awaiting assignment'}
                            </div>
                        </div>
                    </div>
                </div>
                {/* {booking.technicianReview && <p className="booking-card-info-value">Your technician rating: {booking.technicianReview.rating}/5 ★</p>} */}
                <div className="booking-card-actions">
                    <button className="booking-action-primary" onClick={isCompleted ? () => setShowInvoice(true) : () => setShowDetails(true)}>
                        {isCompleted ? 'Download Invoice' : technician.name ? 'View Specialist & Booking Details' : 'View Booking Details'} <FiArrowRight />
                    </button>
                    {isCompleted && <div className="booking-card-secondary-actions">
                        <button className="booking-action-secondary" onClick={() => setShowDetails(true)}>View Details</button>
                        <button className="booking-action-secondary" onClick={() => setShowReview(true)}><FiStar /> Rate Us</button>
                        {(technician.name || technician.phone) && <button className="booking-action-secondary" onClick={() => setShowTechnicianReview(true)}><FiStar /> Rate Technician</button>}
                    </div>}
                    {canCancel && <button className="booking-action-secondary" onClick={handleCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel Booking'}</button>}
                </div>
            </article>

            {showTechnicianReview && <ReviewPopup bookingId={booking._id} technicianMode
                onClose={() => setShowTechnicianReview(false)} onReviewed={() => { if (onCancelled) onCancelled(); }} />}
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
                <div className="ui-bookingcard-1"  onClick={() => setShowDetails(false)}>
                    <div className="ui-bookingcard-2"  onClick={(e) => e.stopPropagation()}>
                        <button className="ui-bookingcard-3"  onClick={() => setShowDetails(false)} aria-label="Close">✕</button>
                        <div className="ui-bookingcard-4" >
                            <div>
                                <div className="ui-bookingcard-5" >Booking Details</div>
                                <div className="ui-bookingcard-6" >{booking.services?.[0]?.service?.name || 'Service Booking'}</div>
                            </div>
                            <span className={`ui-bookingcard-7 ${getStatusClass()}`}>{statusLabel}</span>
                        </div>
                        <div className="ui-bookingcard-8" >
                            <div className="ui-bookingcard-9" >
                                <div className="ui-bookingcard-10" ><div className="ui-bookingcard-11" >Booking ID</div><div className="ui-bookingcard-12" >{booking._id}</div></div>
                                <div className="ui-bookingcard-13" ><div className="ui-bookingcard-14" >Payment</div><div className="ui-bookingcard-15" >{booking.paymentStatus || 'N/A'}</div></div>
                                <div className="ui-bookingcard-16" ><div className="ui-bookingcard-17" >Date</div><div className="ui-bookingcard-18" >{serviceDateFormatted}</div></div>
                                <div className="ui-bookingcard-19" ><div className="ui-bookingcard-20" >Phone</div><div className="ui-bookingcard-21" >{booking.phone || 'N/A'}</div></div>
                                <div className="ui-bookingcard-22" ><div className="ui-bookingcard-23" >Address</div><div className="ui-bookingcard-24" >{address}</div></div>
                            </div>
                            <div className="ui-bookingcard-25" >
                                <div className="ui-bookingcard-26" >Service Summary</div>
                                <div className="ui-bookingcard-27" >
                                    <div><div className="ui-bookingcard-28" >Service</div><div className="ui-bookingcard-29" >{booking.services?.[0]?.service?.name || 'Service'}</div></div>
                                    <div><div className="ui-bookingcard-30" >Quantity</div><div className="ui-bookingcard-31" >{booking.services?.[0]?.quantity || 1}</div></div>
                                    <div><div className="ui-bookingcard-32" >Amount</div><div className="ui-bookingcard-33" >${booking.totalAmount?.toLocaleString('en-US')}</div></div>
                                </div>
                                <div className="ui-bookingcard-34" >{booking.services?.[0]?.service?.description || booking.services?.[0]?.service?.longDescription || 'No description provided.'}</div>
                            </div>
                            <div className="ui-bookingcard-35" >
                                <div className="ui-bookingcard-36" >Technician & Instructions</div>

                                {technician?.name ? (
                                    <div className="ui-bookingcard-37"

                                    >
                                        <div className="ui-bookingcard-38"

                                        >
                                            <div className="ui-bookingcard-39"

                                            >
                                                👤
                                            </div>

                                            <div>
                                                <div className="ui-bookingcard-40"

                                                >
                                                    Technician
                                                </div>
                                                <div className="ui-bookingcard-41"

                                                >
                                                    {technician.name}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ui-bookingcard-42"

                                        >
                                            <div className="ui-bookingcard-43"

                                            >
                                                📞
                                            </div>

                                            <div>
                                                <div className="ui-bookingcard-44"

                                                >
                                                    Phone
                                                </div>
                                                <div className="ui-bookingcard-45"

                                                >
                                                    {technician.phone || "No phone"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ui-bookingcard-46"

                                    >
                                        👨‍🔧 Awaiting assignment
                                    </div>
                                )}

                                <div className="ui-bookingcard-47"

                                >
                                    <div className="ui-bookingcard-48"

                                    >
                                        📝
                                    </div>

                                    <div>
                                        <div className="ui-bookingcard-49"

                                        >
                                            Special Instructions
                                        </div>

                                        <div className="ui-bookingcard-50"

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


export default BookingCard;
