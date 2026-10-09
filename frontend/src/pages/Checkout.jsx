import { cssValue } from '../utils/cssValue';
import '../styles/Checkout.css';
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
        <form className="ui-checkout-1" onSubmit={handleSubmit} >
            <div className="ui-checkout-2" >
                <div className="ui-checkout-3" >Payment Intent</div>
                <div className="ui-checkout-4" >{paymentOrder?.id}</div>
            </div>
            <div className="ui-checkout-5" >
                <div className="ui-checkout-6" >Amount to Pay</div>
                <div className="ui-checkout-7" >${amount.toFixed(2)}</div>
            </div>
            <div className="ui-checkout-8" >
                <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }} />
            </div>
            {processing ? (
                <div className="ui-checkout-9" >
                    <div className="shimmer ui-checkout-10"  />
                    <div className="shimmer ui-checkout-11"  />
                </div>
            ) : (
                <div className="ui-checkout-12" >
                    <button className="ui-checkout-13" type="submit" disabled={!stripe || !elements} >
                        Pay ${amount.toFixed(2)}
                    </button>
                    <button className="ui-checkout-14" type="button" onClick={onCancel} >
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
    const [couponCode, setCouponCode] = useState('');
    const [couponQuote, setCouponQuote] = useState(null);
    const [couponBusy, setCouponBusy] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [availableOffers, setAvailableOffers] = useState([]);
    useEffect(() => { bookingService.getAvailableOffers().then(result => setAvailableOffers(result.data.offers)).catch(() => {}); }, []);
    useEffect(() => { setCouponQuote(null); setCouponError(''); }, [cartItems]);
    const couponServices = () => cartItems.map(item => ({ service: item.service._id, quantity: item.quantity, variantId: item.variantId, addonIds: (item.selectedAddons || []).map(addon => addon.addonId) }));
    const applyCoupon = async () => {
        setCouponBusy(true); setCouponError(''); setCouponQuote(null);
        try { const result = await bookingService.validateCoupon({ code: couponCode, services: couponServices(), paymentProvider }); setCouponQuote(result.data); }
        catch (error) { setCouponError(error.response?.data?.message || 'Unable to apply coupon.'); }
        finally { setCouponBusy(false); }
    };
    const [submitting, setSubmitting] = useState(false);

    const [paymentProvider, setPaymentProvider] = useState('stripe');
    useEffect(() => { setCouponQuote(null); setCouponError(''); }, [paymentProvider]);
    const [paymentAttempt, setPaymentAttempt] = useState(null);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [showGateway, setShowGateway] = useState(false);

    const handleCancelPayment = async () => {
        try { await bookingService.cancelPaymentAttempt(paymentAttempt._id); setShowGateway(false); setPaymentAttempt(null); setPaymentOrder(null); }
        catch (error) { toast.error(error.response?.data?.message || 'Unable to cancel payment.'); }
    };

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
                paymentProvider,
                couponCode: couponQuote?.code || undefined
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
            <div className="ui-checkout-15" >
                <div className="ui-checkout-16" >
                    <div className="ui-checkout-17" >
                        <FaLock className="ui-checkout-18" size={28} color="#635bff"  />
                        <div className="ui-checkout-19" >{paymentOrder?.provider === 'paypal' ? 'PayPal' : 'Stripe'} Secure Payment</div>
                        <div className="ui-checkout-20" >Complete payment to confirm your booking</div>
                    </div>
                    {paymentOrder?.provider === 'paypal' ? (
                        <PayPalPayment paymentAttempt={paymentAttempt} paymentOrder={paymentOrder}
                            onSuccess={handlePaymentSuccess} onCancel={handleCancelPayment} />
                    ) : stripeReady ? (
                        <Elements stripe={stripePromiseRef.current} options={{ clientSecret: paymentOrder.clientSecret, appearance: { theme: 'stripe' } }}>
                            <StripePaymentForm
                                paymentAttempt={paymentAttempt}
                                paymentOrder={paymentOrder}
                                amount={paymentAttempt?.totalAmount ?? total}
                                onSuccess={handlePaymentSuccess}
                                onCancel={handleCancelPayment}
                            />
                        </Elements>
                    ) : (
                        <div className="ui-checkout-21" >
                            <p className="ui-checkout-22" >Stripe is not configured for this payment.</p>
                            <button className="ui-checkout-23" onClick={() => setShowGateway(false)} >
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
        <div className="ui-checkout-24" >
            <div className="ui-checkout-25" >
                {/* Header */}
                <div className="ui-checkout-26" >
                    <button className="ui-checkout-27" onClick={() => navigate(-1)} >
                        <FaArrowLeft size={18} color="#111" />
                    </button>
                    <h2 className="ui-checkout-28" >Cart &amp; Checkout</h2>
                </div>

                {submitting ? (
                    <CheckoutShimmer />
                ) : (
                    <div className="ui-checkout-29" >
                        {/* ── Left column ── */}
                        <div className="ui-checkout-30" >
                            <div className="ui-checkout-31" >
                                <div className="ui-checkout-32" >
                                    Delivery Address &amp; Contact
                                </div>

                                <form className="ui-checkout-33" onSubmit={handleCreateOrder} >

                                    {/* ── Saved address cards ── */}
                                    {savedAddresses.length > 0 && (
                                        <div>
                                            <div className="ui-checkout-34" ><FaMapMarkerAlt color="#000" /> Choose Address</div>
                                            <div className="ui-checkout-35" >
                                                {savedAddresses.map(addr => {
                                                    const isSelected = selectedAddrId === addr._id;
                                                    return (
                                                        <div className="ui-checkout-36"
                                                            key={addr._id}
                                                            onClick={() => setSelectedAddrId(addr._id)}
                                                            style={{ "--ui-checkout-36-border": cssValue(`2px solid ${isSelected ? '#111' : '#e0e0e0'}`, "border"), "--ui-checkout-36-background": cssValue(isSelected ? "var(--ui-color-31)" : "var(--ui-color-2)", "background") }}
                                                        >
                                                            {/* Radio dot */}
                                                            <div className="ui-checkout-37" style={{ "--ui-checkout-37-border": cssValue(`2px solid ${isSelected ? '#111' : '#ccc'}`, "border"), "--ui-checkout-37-background": cssValue(isSelected ? "var(--ui-color-5)" : "var(--ui-color-120)", "background") }}>
                                                                {isSelected && <div className="ui-checkout-38"  />}
                                                            </div>

                                                            <div className="ui-checkout-39" >
                                                                <div className="ui-checkout-40" >
                                                                    <span className="ui-checkout-41" >
                                                                        {labelIcon(addr.label)} {addr.label || 'Home'}
                                                                    </span>
                                                                    {addr.isDefault && (
                                                                        <span className="ui-checkout-42" >Default</span>
                                                                    )}
                                                                </div>
                                                                {addr.name && (
                                                                    <div className="ui-checkout-43" >{addr.name}</div>
                                                                )}
                                                                <div className="ui-checkout-44" >
                                                                    {fmtAddress(addr)}
                                                                </div>
                                                            </div>

                                                            {isSelected && (
                                                                <div className="ui-checkout-45" >
                                                                    <FaCheck size={9} color="#fff" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Use a different / new address */}
                                                <div className="ui-checkout-46"
                                                    onClick={() => setSelectedAddrId('new')}
                                                    style={{ "--ui-checkout-46-border": cssValue(`2px dashed ${selectedAddrId === 'new' ? '#111' : '#ccc'}`, "border"), "--ui-checkout-46-background": cssValue(selectedAddrId === 'new' ? "var(--ui-color-31)" : "var(--ui-color-2)", "background") }}
                                                >
                                                    <FaPlus size={13} color={selectedAddrId === 'new' ? '#111' : '#aaa'} />
                                                    <span className="ui-checkout-47" style={{ "--ui-checkout-47-color": cssValue(selectedAddrId === 'new' ? "var(--ui-color-5)" : "var(--ui-color-6)", "color") }}>
                                                        Use a different address
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── New / manual address form ── */}
                                    {selectedAddrId === 'new' && (
                                        <div className="ui-checkout-48" >
                                            <div className="ui-checkout-49" >
                                                {savedAddresses.length === 0 ? 'Enter Delivery Address' : 'New Address'}
                                            </div>

                                            <div className="ui-checkout-50" >
                                                {/* Map-based location picker */}
                                                <div>
                                                    <div className="ui-checkout-51" >
                                                        <FaMapMarkerAlt size={12} /> Search on Map
                                                    </div>
                                                    <LocationPicker
                                                        value={locationValue}
                                                        onChange={handleLocationChange}
                                                        inputClassName="checkout-location-input-1"
                                                    />
                                                </div>

                                                {/* Address line */}
                                                <div>
                                                    <div className="ui-checkout-52" >Address Line <span className="ui-checkout-53" >*</span></div>
                                                    <input className="ui-checkout-54"
                                                        type="text"
                                                        required={selectedAddrId === 'new'}

                                                        placeholder="Flat / House No., Building, Street..."
                                                        value={manualAddr.addressLine}
                                                        onChange={patchManual('addressLine')}
                                                    />
                                                </div>

                                                <div className="ui-checkout-55" >
                                                    <div>
                                                        <div className="ui-checkout-56" >City</div>
                                                        <input className="ui-checkout-57" type="text"  placeholder="City" value={manualAddr.city} onChange={patchManual('city')} />
                                                    </div>
                                                    <div>
                                                        <div className="ui-checkout-58" >State</div>
                                                        <input className="ui-checkout-59" type="text"  placeholder="State" value={manualAddr.state} onChange={patchManual('state')} />
                                                    </div>
                                                </div>

                                                <div className="ui-checkout-60" >
                                                    <div className="ui-checkout-61" >ZIP / Postal Code</div>
                                                    <input className="ui-checkout-62" type="text"  placeholder="e.g. 10001" value={manualAddr.zipcode} onChange={patchManual('zipcode')} />
                                                </div>

                                                {/* ── Save as ── */}
                                                <div className="ui-checkout-63" >
                                                    <div className="ui-checkout-64" >Save as</div>
                                                    <div className="ui-checkout-65" >
                                                        {LABEL_OPTIONS.map(opt => (
                                                            <button className="ui-checkout-66"
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => setManualAddr(f => ({ ...f, label: opt }))}
                                                                style={{ "--ui-checkout-66-border-color": cssValue(manualAddr.label === opt ? '#2d6a4f' : '#dee2e6', "borderColor"), "--ui-checkout-66-background": cssValue(manualAddr.label === opt ? "var(--ui-color-49)" : "var(--ui-color-2)", "background"), "--ui-checkout-66-color": cssValue(manualAddr.label === opt ? "var(--ui-color-50)" : "var(--ui-color-84)", "color"), "--ui-checkout-66-font-weight": cssValue(manualAddr.label === opt ? 700 : 400, "fontWeight") }}
                                                            >
                                                                {labelIcon(opt)} {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input className="ui-checkout-67"
                                                        type="text"

                                                        placeholder={`e.g. My ${manualAddr.label}, Friend's ${manualAddr.label}…`}
                                                        value={manualAddr.name}
                                                        maxLength={40}
                                                        onChange={(e) => setManualAddr(f => ({ ...f, name: e.target.value }))}
                                                    />
                                                </div>

                                                {/* Save to profile toggle */}
                                                <label className="ui-checkout-68" >
                                                    <div className="ui-checkout-69"
                                                        onClick={() => setSaveNew(v => !v)}
                                                        style={{ "--ui-checkout-69-border": cssValue(`2px solid ${saveNew ? '#2d6a4f' : '#ccc'}`, "border"), "--ui-checkout-69-background": cssValue(saveNew ? "var(--ui-color-50)" : "var(--ui-color-2)", "background") }}
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
                                        <label className="ui-checkout-70" >
                                            <FaPhoneAlt color="#000" /> Contact Number
                                        </label>
                                        <input className="ui-checkout-71"
                                            type="tel"
                                            required

                                            placeholder="Enter contact number..."
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                    </div>

                                    {/* Special instructions */}
                                    <div>
                                        <label className="ui-checkout-72" >Special Instructions (Optional)</label>
                                        <textarea className="ui-checkout-73"
                                            rows="2"

                                            placeholder="Any notes for technicians..."
                                            value={instructions}
                                            onChange={(e) => setInstructions(e.target.value)}
                                        />
                                    </div>

                                    <div className="checkout-coupon">
                                        <label htmlFor="checkout-coupon-code">Have a coupon?</label>
                                        <div><input id="checkout-coupon-code" maxLength={30} placeholder="Enter coupon code" value={couponCode} onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCouponQuote(null); setCouponError(''); }} /><button type="button" disabled={couponBusy || !couponCode.trim()} onClick={applyCoupon}>{couponBusy ? 'Checking…' : 'Apply'}</button></div>
                                        {availableOffers.length > 0 && <details><summary>Available offers</summary>{availableOffers.map(offer => <button type="button" key={offer._id} onClick={() => { setCouponCode(offer.code); setCouponQuote(null); }}>{offer.code} — {offer.title}{offer.eligibility === 'new' ? ' (new customers)' : ''}</button>)}</details>}
                                        {couponError && <p role="alert">{couponError}</p>}
                                        {couponQuote && <p role="status">{couponQuote.code} applied · Discount: {couponQuote.discount.toFixed(2)} <button type="button" onClick={() => { setCouponQuote(null); setCouponCode(''); }}>Remove</button></p>}
                                    </div>

                                    <fieldset className="ui-checkout-74" >
                                        <legend className="ui-checkout-75" >Payment method</legend>
                                        <div className="ui-checkout-76" >
                                            {[['stripe', 'Credit / Debit Card (Stripe)'], ['paypal', 'PayPal']].map(([value, label]) => (
                                                <label className="ui-checkout-77" key={value} >
                                                    <input type="radio" name="paymentProvider" value={value} checked={paymentProvider === value} onChange={() => setPaymentProvider(value)} />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>

                                    <button className="ui-checkout-78"
                                        type="submit"

                                    >
                                        Proceed to Payment
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* ── Right column: summary ── */}
                        <div className="ui-checkout-79" >
                            {/* Selected address preview */}
                            {selectedAddrId !== 'new' && resolvedAddress?.addressLine && (
                                <div className="ui-checkout-80" >
                                    <div className="ui-checkout-81" >Address</div>
                                    <div className="ui-checkout-82" >
                                        <div className="ui-checkout-83" >
                                            {labelIcon(resolvedAddress.label)}
                                        </div>
                                        <div>
                                            {/* <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                                <span style={{ fontSize: 10, background: '#e9ecef', color: '#555', borderRadius: 20, padding: '2px 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {labelIcon(resolvedAddress.label)} {resolvedAddress.label || 'Home'}
                                                </span>
                                            </div> */}
                                            {resolvedAddress.name && (
                                                <div className="ui-checkout-84" >{resolvedAddress.name}</div>
                                            )}
                                            <div className="ui-checkout-85" >{fmtAddress(resolvedAddress)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Booking schedule */}
                            <div className="ui-checkout-86" >
                                <div className="ui-checkout-87" >Service Date</div>
                                <div className="ui-checkout-88" >
                                    <div className="ui-checkout-89" >
                                        <FaCalendarAlt color="#000" />
                                        <span>Date:</span>
                                        <strong className="ui-checkout-90" >{new Date(bookingDate).toLocaleDateString()}</strong>
                                    </div>

                                </div>
                            </div>

                            {/* Payment summary */}
                            <div className="ui-checkout-91" >
                                <div className="ui-checkout-92" >Payment Summary</div>
                                {cartItems.map(item => (
                                    <div className="ui-checkout-93" key={item.service._id} >
                                        <span className="ui-checkout-94" >{item.service.name}{item.selectedAddons?.length > 0 && <small className="ui-checkout-95" >Add-ons: {item.selectedAddons.map(addon => addon.name).join(', ')}</small>}</span>
                                        <div className="ui-checkout-96" >
                                            <button className="ui-checkout-97" type="button" aria-label={`Decrease ${item.service.name} quantity`} onClick={() => item.quantity <= 1 ? removeFromCart(item.service._id) : updateQuantity(item.service._id, item.quantity - 1)} >-</button>
                                            <span className="ui-checkout-98" >{item.quantity}</span>
                                            <button className="ui-checkout-99" type="button" aria-label={`Increase ${item.service.name} quantity`} onClick={() => updateQuantity(item.service._id, item.quantity + 1)} >+</button>
                                            <button className="ui-checkout-100" type="button" aria-label={`Remove ${item.service.name}`} onClick={() => removeFromCart(item.service._id)} ><FaTimes size={12} /></button>
                                            <strong className="ui-checkout-101" >${(item.service.price * item.quantity).toFixed(2)}</strong>
                                        </div>
                                    </div>
                                ))}
                                {couponQuote && <>
                                    <div className="ui-checkout-102">
                                        <span className="ui-checkout-103">Subtotal</span>
                                        <span className="ui-checkout-104">${couponQuote.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="ui-checkout-102">
                                        <span className="ui-checkout-103">Adjustments <small>(Coupon: {couponQuote.code})</small></span>
                                        <span className="ui-checkout-104">-${couponQuote.discount.toFixed(2)}</span>
                                    </div>
                                </>}
                                <hr className="ui-checkout-105"  />
                                <div className="ui-checkout-106" >
                                    <span className="ui-checkout-107" >Amount to pay</span>
                                    <span className="ui-checkout-108" >${(couponQuote?.total ?? total).toFixed(2)}</span>
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
