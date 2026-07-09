import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import bookingService from '../services/bookingService';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaMapMarkerAlt, FaPhone, FaCalendarAlt, FaClock, FaLock, FaCheckCircle, FaExclamationTriangle, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Checkout = () => {
    const { cartItems, getCartTotal, clearCart } = useContext(CartContext);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [instructions, setInstructions] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [bookingDetails, setBookingDetails] = useState(null);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [showGateway, setShowGateway] = useState(false);
    const [gatewayProcessing, setGatewayProcessing] = useState(false);

    const bookingDate = sessionStorage.getItem('1App_booking_date');
    const bookingSlot = sessionStorage.getItem('1App_booking_slot');

    useEffect(() => {
        if (cartItems.length === 0) { navigate('/cart'); return; }

        const hasStoredSelection = Boolean(bookingDate && bookingSlot);
        if (!hasStoredSelection) {
            toast.warn('Please schedule your service date and slot first.');
            navigate('/cart');
            return;
        }

        if (user) { setAddress(user.address || ''); setPhone(user.phone || ''); }
    }, [user, cartItems, bookingDate, bookingSlot, navigate]);

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (!address.trim() || !phone.trim()) { toast.error('Address and phone are required!'); return; }
        setSubmitting(true);
        try {
            const res = await bookingService.createBooking({
                services: cartItems.map(item => ({ service: item.service._id, quantity: item.quantity })),
                address, phone, serviceDate: bookingDate, timeSlot: bookingSlot, specialInstructions: instructions
            });
            if (res.success) {
                setBookingDetails(res.data.booking);
                setPaymentOrder(res.data.paymentOrder);
                setShowGateway(true);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to place booking order');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSimulatePayment = async (status) => {
        setGatewayProcessing(true);
        try {
            const res = await bookingService.verifyPayment({
                bookingId: bookingDetails._id,
                razorpayOrderId: paymentOrder.id,
                razorpayPaymentId: status === 'success' ? `pay_mock_${Math.random().toString(36).substring(2, 10)}` : 'pay_failed',
                razorpaySignature: `sig_mock_${Math.random().toString(36).substring(2, 12)}`,
                status
            });
            if (res.success) {
                toast.success('Payment completed & booking confirmed!');
                clearCart();
                sessionStorage.removeItem('1App_booking_date');
                sessionStorage.removeItem('1App_booking_slot');
                navigate('/bookings');
            } else {
                toast.error('Payment failed!');
                setShowGateway(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Payment simulation failed');
            setShowGateway(false);
        } finally {
            setGatewayProcessing(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0',
        background: '#f9f9f9', fontSize: 14, color: '#333', outline: 'none', boxSizing: 'border-box'
    };
    const labelStyle = { fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 };
    const cardStyle = { background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };

    // ── Payment Gateway ──
    if (showGateway) {
        return (
            <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ ...cardStyle, width: '100%', maxWidth: 420, padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: '#111', padding: '28px 24px', textAlign: 'center' }}>
                        <FaLock size={28} color="#f5a623" style={{ marginBottom: 10 }} />
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>1App SECURE PAY</div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Simulated Payment Gateway</div>
                    </div>

                    <div style={{ padding: '28px 24px', textAlign: 'center' }}>
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Order ID</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#333' }}>{paymentOrder?.id}</div>
                        </div>

                        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Amount to Pay</div>
                            <div style={{ fontWeight: 800, fontSize: '2rem', color: '#2e7d32', fontFamily: 'monospace' }}>₹{getCartTotal().toFixed(2)}</div>
                        </div>
                        

                        {gatewayProcessing ? (
                            <LoadingSpinner message="Processing your transaction securely..." />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <button
                                    onClick={() => handleSimulatePayment('success')}
                                    style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                >
                                    <FaCheckCircle /> Simulate Success (Pay ₹{getCartTotal()})
                                </button>
                                <button
                                    onClick={() => handleSimulatePayment('failed')}
                                    style={{ width: '100%', background: '#fff', color: '#c62828', border: '1.5px solid #c62828', borderRadius: 12, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                >
                                    <FaExclamationTriangle /> Simulate Payment Failure
                                </button>
                                <button
                                    onClick={() => setShowGateway(false)}
                                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginTop: 4 }}
                                >
                                    Cancel Transaction
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const total = getCartTotal();

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <FaArrowLeft size={18} color="#111" />
                    </button>
                    <h2 style={{ fontWeight: 800, fontSize: '1.5rem', margin: 0, color: '#111' }}>Confirm Checkout</h2>
                </div>

                {submitting ? (
                    <LoadingSpinner message="Creating booking order..." />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

                        {/* ── LEFT ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Address & Contact */}
                            <div style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 18 }}>Delivery Address & Contact</div>

                                <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <label style={labelStyle}>
                                            <FaMapMarkerAlt color="#2e7d32" /> Full Address
                                        </label>
                                        <textarea
                                            rows="3"
                                            required
                                            style={{ ...inputStyle, resize: 'vertical' }}
                                            placeholder="House No, Building, Street, City..."
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label style={labelStyle}>
                                            <FaPhone color="#2e7d32" /> Contact Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            style={inputStyle}
                                            placeholder="Enter contact number..."
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ ...labelStyle, color: '#888' }}>Special Instructions (Optional)</label>
                                        <textarea
                                            rows="2"
                                            style={{ ...inputStyle, resize: 'vertical' }}
                                            placeholder="Any notes for technicians..."
                                            value={instructions}
                                            onChange={(e) => setInstructions(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}
                                    >
                                        Proceed to Secure Payment
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* ── RIGHT ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Booking Schedule */}
                            <div style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 14 }}>Booking Schedule</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555' }}>
                                        <FaCalendarAlt color="#2e7d32" />
                                        <span>Date:</span>
                                        <strong style={{ color: '#111' }}>{new Date(bookingDate).toLocaleDateString()}</strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555' }}>
                                        <FaClock color="#2e7d32" />
                                        <span>Slot:</span>
                                        <strong style={{ color: '#111' }}>{bookingSlot}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Cart Summary */}
                            <div style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 18 }}>Payment summary</div>

                                {cartItems.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#555' }}>
                                        <span>{item.service.name} x{item.quantity}</span>
                                        <span>₹{(item.service.price * item.quantity).toLocaleString('en-IN')}</span>
                                    </div>
                                ))}

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                                    <span style={{ color: '#2e7d32', fontWeight: 600 }}>Free service offer</span>
                                    <span style={{ color: '#2e7d32', fontWeight: 600 }}>-₹0</span>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '10px 0 14px' }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Amount to pay</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#111' }}>₹{total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Checkout;
