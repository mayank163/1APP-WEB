import React, { useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import bookingService from '../services/bookingService';
import { CheckoutShimmer } from '../components/Shimmer';
import LocationPicker from '../components/LocationPicker';
import PayPalPayment from '../components/PayPalPayment';
import {
    FaMapMarkerAlt, FaPhoneAlt, FaCalendarAlt, FaLock,
    FaArrowLeft, FaHome, FaBriefcase, FaPlus, FaCheck, FaTimes
} from 'react-icons/fa';
import { toast } from 'react-toastify';

/* ─── helpers ─── */
const labelIcon = (label = '') => {
    const l = label.toLowerCase();
    if (l === 'home') return <FaHome size={12} />;
    if (l === 'office' || l === 'work') return <FaBriefcase size={12} />;
    return <FaMapMarkerAlt size={12} />;
};

const emptyAddr = { label: 'Home', name: '', addressLine: '', city: '', state: '', zipcode: '' };
const safeStr = (v) => (v && typeof v === 'string' ? v.trim() : '');
const LABEL_OPTIONS = ['Home', 'Office', 'Work', 'Other'];

const fmtAddress = (a) =>
    [a.addressLine, a.city, a.state, a.zipcode].filter(Boolean).join(', ');

/* ─── styles ─── */
const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid #e0e0e0', background: '#f9f9f9',
    fontSize: 14, color: '#333', outline: 'none', boxSizing: 'border-box'
};
const labelStyle = { fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 };
const cardStyle = { background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };

/* ─── Stripe sub-form (unchanged logic) ─── */
const StripePaymentForm = ({ paymentAttempt, paymentOrder, amount, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) { toast.error('Stripe is still loading.'); return; }
        setProcessing(true);
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: { return_url: window.location.origin + '/bookings' },
                redirect: 'if_required'
            });
            if (error) { toast.error(error.message || 'Payment failed'); return; }
            if (!paymentIntent || paymentIntent.status !== 'succeeded') {
                toast.error('Payment was not completed.'); return;
            }
            const res = await bookingService.verifyStripePayment(paymentAttempt._id, paymentIntent.id);
            if (res.success) onSuccess();
            else toast.error('Payment completed, but booking verification failed.');
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
                <div style={{ fontWeight: 800, fontSize: '2rem', color: '#000', fontFamily: 'monospace' }}>${amount.toFixed(2)}</div>
            </div>
            <div style={{ marginBottom: 18 }}>
                <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }} />
            </div>
            {processing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
                    <div className="shimmer" style={{ height: 48, borderRadius: 12 }} />
                    <div className="shimmer" style={{ height: 48, borderRadius: 12 }} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button type="submit" disabled={!stripe || !elements} style={{ width: '100%', background: '#000', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                        Pay ${amount.toFixed(2)}
                    </button>
                    <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                        Cancel Transaction
                    </button>
                </div>
            )}
        </form>
    );
};

/* ─── Main Checkout ─── */
const Checkout = () => {
    const { cartItems, getCartTotal, clearCart, updateQuantity, removeFromCart } = useContext(CartContext);
    const { user, updateProfile } = useContext(AuthContext);
    const navigate = useNavigate();

    const savedAddresses = user?.addresses || [];

    // Which saved address is selected (by _id), or 'new' for a manual entry
    const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0] || null;
    const [selectedAddrId, setSelectedAddrId] = useState(defaultAddr?._id || (savedAddresses.length === 0 ? 'new' : null));

    // Manual / new address form
    const [manualAddr, setManualAddr] = useState(emptyAddr);
    const [locationValue, setLocationValue] = useState(null);  // { address, lat, lng }
    const [saveNew, setSaveNew] = useState(false);   // whether to persist new addr to profile

    const [phone, setPhone] = useState(user?.phone || '');
    const [instructions, setInstructions] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [paymentProvider, setPaymentProvider] = useState('stripe');
    const [paymentAttempt, setPaymentAttempt] = useState(null);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [showGateway, setShowGateway] = useState(false);

    const stripePromiseRef = useRef(null);

    const bookingDate = sessionStorage.getItem('1App_booking_date') || new Date().toISOString();
    const total = getCartTotal();

    // Redirect if cart is empty
    useEffect(() => {
        if (!showGateway && cartItems.length === 0) navigate('/cart');
    }, [cartItems, showGateway, navigate]);

    // Initialize phone + address ONCE when user data first loads
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!user || initializedRef.current) return;
        initializedRef.current = true;

        setPhone(user.phone || '');
        const def = (user.addresses || []).find(a => a.isDefault) || (user.addresses || [])[0] || null;
        if (def) {
            setSelectedAddrId(def._id);
        } else {
            setSelectedAddrId('new');
            setManualAddr(f => ({ ...f, addressLine: safeStr(user.address) }));
        }
    }, [user]);

    /* ── derived selected address object ── */
    const resolvedAddress = selectedAddrId === 'new'
        ? manualAddr
        : savedAddresses.find(a => a._id === selectedAddrId) || manualAddr;

    const patchManual = (key) => (e) => setManualAddr(f => ({ ...f, [key]: e.target.value }));

    // Called when user picks a place on the map — auto-fills address fields
    const handleLocationChange = ({ address, lat, lng, addressLine, city, state, zipcode }) => {
        setLocationValue({ address: safeStr(address) || address, lat, lng });
        setManualAddr(f => ({
            ...f,
            addressLine: safeStr(addressLine) || safeStr(address) || f.addressLine,
            city:        safeStr(city)        || f.city,
            state:       safeStr(state)       || f.state,
            zipcode:     safeStr(zipcode)     || f.zipcode,
        }));
    };

    /* ── submit ── */
    const handleCreateOrder = async (e) => {
        e.preventDefault();

        const addr = resolvedAddress;
        const addrLine = safeStr(addr.addressLine);
        if (!addrLine) {
            toast.error('Please enter the address line');
            return;
        }
        if (!phone.trim()) {
            toast.error('Contact phone is required');
            return;
        }

        // Optionally save the new address to the user profile
        if (selectedAddrId === 'new' && saveNew && addrLine) {
            try {
                await updateProfile({
                    addAddress: {
                        ...addr,
                        isDefault: savedAddresses.length === 0,
                        ...(locationValue?.lat ? { coordinates: { lat: locationValue.lat, lng: locationValue.lng } } : {})
                    }
                });
            } catch {
                // non-blocking — proceed with booking even if save fails
            }
        }

        setSubmitting(true);
        try {
            const res = await bookingService.createBooking({
                services: cartItems.map(item => ({ service: item.service._id, quantity: item.quantity, variantId: item.variantId, addonIds: (item.selectedAddons || []).map(addon => addon.addonId) })),
                address: {
                    label:       safeStr(addr.label)       || 'Home',
                    name:        safeStr(addr.name)        || '',
                    addressLine: addrLine,
                    city:        safeStr(addr.city)        || '',
                    state:       safeStr(addr.state)       || '',
                    zipcode:     safeStr(addr.zipcode)     || '',
                    coordinates: selectedAddrId === 'new'
                        ? (locationValue?.lat ? { lat: locationValue.lat, lng: locationValue.lng } : { lat: null, lng: null })
                        : (resolvedAddress?.coordinates?.lat
                            ? { lat: resolvedAddress.coordinates.lat, lng: resolvedAddress.coordinates.lng }
                            : { lat: null, lng: null })
                },
                phone,
                serviceDate: bookingDate,
                specialInstructions: instructions,
                paymentProvider
            });

            if (res.success) {
                const order = res.data.paymentOrder;
                const publishableKey = order?.publishableKey || process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
                if (publishableKey?.startsWith('pk_') && !stripePromiseRef.current) {
                    stripePromiseRef.current = loadStripe(publishableKey);
                }
                setPaymentAttempt(res.data.paymentAttempt);
                setPaymentOrder(order);
                setShowGateway(true);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to place booking order');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePaymentSuccess = () => {
        toast.success('Payment completed. Your booking is pending confirmation.');
        clearCart();
        sessionStorage.removeItem('1App_booking_date');
        navigate('/bookings');
    };

    /* ── Stripe gateway screen ── */
    if (showGateway) {
        const stripeReady = paymentOrder?.provider === 'stripe' && paymentOrder?.clientSecret && stripePromiseRef.current;
        return (
            <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ ...cardStyle, width: '100%', maxWidth: 460, padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: '#111', padding: '28px 24px', textAlign: 'center' }}>
                        <FaLock size={28} color="#635bff" style={{ marginBottom: 10 }} />
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{paymentOrder?.provider === 'paypal' ? 'PayPal' : 'Stripe'} Secure Payment</div>
                        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Complete payment to confirm your booking</div>
                    </div>
                    {paymentOrder?.provider === 'paypal' ? (
                        <PayPalPayment paymentAttempt={paymentAttempt} paymentOrder={paymentOrder}
                            onSuccess={handlePaymentSuccess} onCancel={() => setShowGateway(false)} />
                    ) : stripeReady ? (
                        <Elements stripe={stripePromiseRef.current} options={{ clientSecret: paymentOrder.clientSecret, appearance: { theme: 'stripe' } }}>
                            <StripePaymentForm
                                paymentAttempt={paymentAttempt}
                                paymentOrder={paymentOrder}
                                amount={paymentAttempt?.totalAmount ?? total}
                                onSuccess={handlePaymentSuccess}
                                onCancel={() => setShowGateway(false)}
                            />
                        </Elements>
                    ) : (
                        <div style={{ padding: 24, textAlign: 'center' }}>
                            <p style={{ color: '#c62828', fontWeight: 700 }}>Stripe is not configured for this payment.</p>
                            <button onClick={() => setShowGateway(false)} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', cursor: 'pointer', fontWeight: 700 }}>
                                Back to checkout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ── Main checkout screen ── */
    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <FaArrowLeft size={18} color="#111" />
                    </button>
                    <h2 style={{ fontWeight: 800, fontSize: '1.5rem', margin: 0, color: '#111' }}>Cart &amp; Checkout</h2>
                </div>

                {submitting ? (
                    <CheckoutShimmer />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 20, alignItems: 'start' }}>
                        {/* ── Left column ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 18 }}>
                                    Delivery Address &amp; Contact
                                </div>

                                <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                                    {/* ── Saved address cards ── */}
                                    {savedAddresses.length > 0 && (
                                        <div>
                                            <div style={labelStyle}><FaMapMarkerAlt color="#000" /> Choose Address</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {savedAddresses.map(addr => {
                                                    const isSelected = selectedAddrId === addr._id;
                                                    return (
                                                        <div
                                                            key={addr._id}
                                                            onClick={() => setSelectedAddrId(addr._id)}
                                                            style={{
                                                                display: 'flex', alignItems: 'flex-start', gap: 12,
                                                                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                                                                border: `2px solid ${isSelected ? '#111' : '#e0e0e0'}`,
                                                                background: isSelected ? '#f9f9f9' : '#fff',
                                                                transition: 'border-color 0.15s, background 0.15s'
                                                            }}
                                                        >
                                                            {/* Radio dot */}
                                                            <div style={{ marginTop: 2, width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isSelected ? '#111' : '#ccc'}`, background: isSelected ? '#111' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                {isSelected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                                                            </div>

                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                                                    <span style={{ fontSize: 10, background: '#e9ecef', color: '#555', borderRadius: 20, padding: '2px 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        {labelIcon(addr.label)} {addr.label || 'Home'}
                                                                    </span>
                                                                    {addr.isDefault && (
                                                                        <span style={{ fontSize: 10, background: '#d8f3dc', color: '#2d6a4f', borderRadius: 20, padding: '2px 7px', fontWeight: 700 }}>Default</span>
                                                                    )}
                                                                </div>
                                                                {addr.name && (
                                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 2 }}>{addr.name}</div>
                                                                )}
                                                                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>
                                                                    {fmtAddress(addr)}
                                                                </div>
                                                            </div>

                                                            {isSelected && (
                                                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    <FaCheck size={9} color="#fff" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Use a different / new address */}
                                                <div
                                                    onClick={() => setSelectedAddrId('new')}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 12,
                                                        padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                                                        border: `2px dashed ${selectedAddrId === 'new' ? '#111' : '#ccc'}`,
                                                        background: selectedAddrId === 'new' ? '#f9f9f9' : '#fff',
                                                        transition: 'border-color 0.15s'
                                                    }}
                                                >
                                                    <FaPlus size={13} color={selectedAddrId === 'new' ? '#111' : '#aaa'} />
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: selectedAddrId === 'new' ? '#111' : '#888' }}>
                                                        Use a different address
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── New / manual address form ── */}
                                    {selectedAddrId === 'new' && (
                                        <div style={{ background: '#f8fffe', border: '1.5px solid #d8f3dc', borderRadius: 10, padding: '14px 16px' }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#333', marginBottom: 12 }}>
                                                {savedAddresses.length === 0 ? 'Enter Delivery Address' : 'New Address'}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {/* Map-based location picker */}
                                                <div>
                                                    <div style={{ ...labelStyle, marginBottom: 5, color: '#555' }}>
                                                        <FaMapMarkerAlt size={12} /> Search on Map
                                                    </div>
                                                    <LocationPicker
                                                        value={locationValue}
                                                        onChange={handleLocationChange}
                                                        inputStyle={{ borderRadius: 10, border: '1.5px solid #e0e0e0', background: '#f9f9f9', marginBottom: 0 }}
                                                    />
                                                </div>

                                                {/* Address line */}
                                                <div>
                                                    <div style={{ ...labelStyle, marginBottom: 5 }}>Address Line <span style={{ color: '#e53935' }}>*</span></div>
                                                    <input
                                                        type="text"
                                                        required={selectedAddrId === 'new'}
                                                        style={inputStyle}
                                                        placeholder="Flat / House No., Building, Street..."
                                                        value={manualAddr.addressLine}
                                                        onChange={patchManual('addressLine')}
                                                    />
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    <div>
                                                        <div style={{ ...labelStyle, marginBottom: 5 }}>City</div>
                                                        <input type="text" style={inputStyle} placeholder="City" value={manualAddr.city} onChange={patchManual('city')} />
                                                    </div>
                                                    <div>
                                                        <div style={{ ...labelStyle, marginBottom: 5 }}>State</div>
                                                        <input type="text" style={inputStyle} placeholder="State" value={manualAddr.state} onChange={patchManual('state')} />
                                                    </div>
                                                </div>

                                                <div style={{ maxWidth: '50%' }}>
                                                    <div style={{ ...labelStyle, marginBottom: 5 }}>ZIP / Postal Code</div>
                                                    <input type="text" style={inputStyle} placeholder="e.g. 10001" value={manualAddr.zipcode} onChange={patchManual('zipcode')} />
                                                </div>

                                                {/* ── Save as ── */}
                                                <div style={{ paddingTop: 10, borderTop: '1px solid #e0e0e0' }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Save as</div>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                                        {LABEL_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => setManualAddr(f => ({ ...f, label: opt }))}
                                                                style={{
                                                                    borderRadius: 20, border: '1.5px solid',
                                                                    borderColor: manualAddr.label === opt ? '#2d6a4f' : '#dee2e6',
                                                                    background: manualAddr.label === opt ? '#d8f3dc' : '#fff',
                                                                    color: manualAddr.label === opt ? '#2d6a4f' : '#6c757d',
                                                                    fontWeight: manualAddr.label === opt ? 700 : 400,
                                                                    fontSize: 12, padding: '4px 12px', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', gap: 5
                                                                }}
                                                            >
                                                                {labelIcon(opt)} {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        style={{ ...inputStyle, marginBottom: 0 }}
                                                        placeholder={`e.g. My ${manualAddr.label}, Friend's ${manualAddr.label}…`}
                                                        value={manualAddr.name}
                                                        maxLength={40}
                                                        onChange={(e) => setManualAddr(f => ({ ...f, name: e.target.value }))}
                                                    />
                                                </div>

                                                {/* Save to profile toggle */}
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#555', userSelect: 'none', marginTop: 2 }}>
                                                    <div
                                                        onClick={() => setSaveNew(v => !v)}
                                                        style={{
                                                            width: 18, height: 18, borderRadius: 4,
                                                            border: `2px solid ${saveNew ? '#2d6a4f' : '#ccc'}`,
                                                            background: saveNew ? '#2d6a4f' : '#fff',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0, transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {saveNew && <FaCheck size={9} color="#fff" />}
                                                    </div>
                                                    Save this address to my profile
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Phone */}
                                    <div>
                                        <label style={labelStyle}>
                                            <FaPhoneAlt color="#000" /> Contact Number
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

                                    {/* Special instructions */}
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

                                    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                                        <legend style={labelStyle}>Payment method</legend>
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            {[['stripe', 'Credit / Debit Card (Stripe)'], ['paypal', 'PayPal']].map(([value, label]) => (
                                                <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 14 }}>
                                                    <input type="radio" name="paymentProvider" value={value} checked={paymentProvider === value} onChange={() => setPaymentProvider(value)} />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>

                                    <button
                                        type="submit"
                                        style={{ width: '100%', background: '#000', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}
                                    >
                                        Proceed to Payment
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* ── Right column: summary ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Selected address preview */}
                            {selectedAddrId !== 'new' && resolvedAddress?.addressLine && (
                                <div style={cardStyle}>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 10 }}>Address</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {labelIcon(resolvedAddress.label)}
                                        </div>
                                        <div>
                                            {/* <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                                <span style={{ fontSize: 10, background: '#e9ecef', color: '#555', borderRadius: 20, padding: '2px 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {labelIcon(resolvedAddress.label)} {resolvedAddress.label || 'Home'}
                                                </span>
                                            </div> */}
                                            {resolvedAddress.name && (
                                                <div style={{ fontWeight: 700, fontSize: 13, color: '#333', marginBottom: 2 }}>{resolvedAddress.name}</div>
                                            )}
                                            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>{fmtAddress(resolvedAddress)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Booking schedule */}
                            <div style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 14 }}>Service Date</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555' }}>
                                        <FaCalendarAlt color="#000" />
                                        <span>Date:</span>
                                        <strong style={{ color: '#111' }}>{new Date(bookingDate).toLocaleDateString()}</strong>
                                    </div>
                                    
                                </div>
                            </div>

                            {/* Payment summary */}
                            <div style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 18 }}>Payment Summary</div>
                                {cartItems.map(item => (
                                    <div key={item.service._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, fontSize: 14, color: '#555' }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>{item.service.name}{item.selectedAddons?.length > 0 && <small style={{ display: 'block', marginTop: 3, color: '#777' }}>Add-ons: {item.selectedAddons.map(addon => addon.name).join(', ')}</small>}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                            <button type="button" aria-label={`Decrease ${item.service.name} quantity`} onClick={() => item.quantity <= 1 ? removeFromCart(item.service._id) : updateQuantity(item.service._id, item.quantity - 1)} style={{ width: 26, height: 28, border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>-</button>
                                            <span style={{ minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                                            <button type="button" aria-label={`Increase ${item.service.name} quantity`} onClick={() => updateQuantity(item.service._id, item.quantity + 1)} style={{ width: 26, height: 28, border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>+</button>
                                            <button type="button" aria-label={`Remove ${item.service.name}`} onClick={() => removeFromCart(item.service._id)} style={{ width: 26, height: 28, border: 'none', background: 'transparent', color: '#777', cursor: 'pointer' }}><FaTimes size={12} /></button>
                                            <strong style={{ minWidth: 60, textAlign: 'right', color: '#111' }}>${(item.service.price * item.quantity).toFixed(2)}</strong>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                                    <span style={{ color: '#000', fontWeight: 600 }}>Free service offer</span>
                                    <span style={{ color: '#000', fontWeight: 600 }}>-$0.00</span>
                                </div>
                                <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '10px 0 14px' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Amount to pay</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#111' }}>${total.toFixed(2)}</span>
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
