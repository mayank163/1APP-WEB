import React, { useContext, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import bookingService from '../services/bookingService';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaMapMarkerAlt, FaPhone, FaCalendarAlt, FaClock, FaLock, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';

const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #e0e0e0',
    background: '#f9f9f9',
    fontSize: 14,
    color: '#333',
    outline: 'none',
    boxSizing: 'border-box'
};

const labelStyle = { fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 };
const cardStyle = { background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };

const StripePaymentForm = ({ bookingDetails, paymentOrder, amount, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements) {
            toast.error('Stripe is still loading. Please try again.');
            return;
        }

        setProcessing(true);
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required'
            });

            if (error) {
                toast.error(error.message || 'Payment failed');
                setProcessing(false);
                return;
            }

            if (!paymentIntent || paymentIntent.status !== 'succeeded') {
                toast.error('Payment was not completed.');
                setProcessing(false);
                return;
            }

            const res = await bookingService.verifyStripePayment(bookingDetails._id, paymentIntent.id);
            if (res.success) {
                onSuccess();
            } else {
                toast.error('Payment completed, but booking verification failed.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Payment failed');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ padding: '28px 24px' }}>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Payment Intent</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#333', wordBreak: 'break-all' }}>{paymentOrder?.id}</div>
            </div>

            <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Amount to Pay</div>
                <div style={{ fontWeight: 800, fontSize: '2rem', color: '#2e7d32', fontFamily: 'monospace' }}>₹{amount.toFixed(2)}</div>
            </div>

            <div style={{ marginBottom: 18 }}>
                <PaymentElement />
            </div>

            {processing ? (
                <LoadingSpinner message="Processing your Stripe payment..." />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                        type="submit"
                        disabled={!stripe || !elements}
                        style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                    >
                        Pay ₹{amount.toFixed(2)}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginTop: 4 }}
                    >
                        Cancel Transaction
                    </button>
                </div>
            )}
        </form>
    );
};

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

    const bookingDate = sessionStorage.getItem('1App_booking_date');
    const bookingSlot = sessionStorage.getItem('1App_booking_slot');
    const total = getCartTotal();

    const stripePromise = useMemo(() => {
        const publishableKey = paymentOrder?.publishableKey || process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
        return publishableKey?.startsWith('pk_') ? loadStripe(publishableKey) : null;
    }, [paymentOrder?.publishableKey]);

    useEffect(() => {
        if (cartItems.length === 0) {
            navigate('/cart');
            return;
        }

        if (!bookingDate || !bookingSlot) {
            toast.warn('Please schedule your service date and slot first.');
            navigate('/cart');
            return;
        }

        if (user) {
            setAddress(user.address || '');
            setPhone(user.phone || '');
        }
    }, [user, cartItems, bookingDate, bookingSlot, navigate]);

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (!address.trim() || !phone.trim()) {
            toast.error('Address and phone are required!');
            return;
        }

        setSubmitting(true);
        try {
            const res = await bookingService.createBooking({
                services: cartItems.map(item => ({ service: item.service._id, quantity: item.quantity })),
                address,
                phone,
                serviceDate: bookingDate,
                timeSlot: bookingSlot,
                specialInstructions: instructions
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

    const handlePaymentSuccess = () => {
        toast.success('Payment completed & booking confirmed!');
        clearCart();
        sessionStorage.removeItem('1App_booking_date');
        sessionStorage.removeItem('1App_booking_slot');
        navigate('/bookings');
    };

    if (showGateway) {
        const stripeReady = paymentOrder?.provider === 'stripe' && paymentOrder?.clientSecret && stripePromise;

        return (
            <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ ...cardStyle, width: '100%', maxWidth: 460, padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: '#111', padding: '28px 24px', textAlign: 'center' }}>
                        <FaLock size={28} color="#635bff" style={{ marginBottom: 10 }} />
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>Stripe Secure Payment</div>
                        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Complete payment to confirm your booking</div>
                    </div>

                    {stripeReady ? (
                        <Elements stripe={stripePromise} options={{ clientSecret: paymentOrder.clientSecret }}>
                            <StripePaymentForm
                                bookingDetails={bookingDetails}
                                paymentOrder={paymentOrder}
                                amount={total}
                                onSuccess={handlePaymentSuccess}
                                onCancel={() => setShowGateway(false)}
                            />
                        </Elements>
                    ) : (
                        <div style={{ padding: 24, textAlign: 'center' }}>
                            <p style={{ color: '#c62828', fontWeight: 700 }}>Stripe is not configured for this payment.</p>
                            <button onClick={() => setShowGateway(false)} style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', cursor: 'pointer', fontWeight: 700 }}>
                                Back to checkout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <FaArrowLeft size={18} color="#111" />
                    </button>
                    <h2 style={{ fontWeight: 800, fontSize: '1.5rem', margin: 0, color: '#111' }}>Confirm Checkout</h2>
                </div>

                {submitting ? (
                    <LoadingSpinner message="Creating Stripe payment..." />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                                        Proceed to Stripe Payment
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
