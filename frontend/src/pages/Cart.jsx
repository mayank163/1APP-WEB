import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { FaShoppingCart, FaTag, FaCheckCircle, FaArrowLeft, FaPercent } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { resolveImageUrl } from '../services/api';
import SlotModal from '../components/SlotModal';

const getStoredBookingSelection = () => {
    if (typeof window === 'undefined') return null;
    const bookingDate = sessionStorage.getItem('1App_booking_date');
    const bookingSlot = sessionStorage.getItem('1App_booking_slot');
    if (!bookingDate || !bookingSlot) return null;

    if (bookingSlot.startsWith('Instant')) {
        return { type: 'instant', etaMinutes: 50, date: bookingDate, time: bookingSlot };
    }

    return { type: 'scheduled', date: bookingDate, time: bookingSlot };
};

const persistBookingSelection = (slot) => {
    if (typeof window === 'undefined') return;

    if (!slot) {
        sessionStorage.removeItem('1App_booking_date');
        sessionStorage.removeItem('1App_booking_slot');
        return;
    }

    if (slot.type === 'instant') {
        sessionStorage.setItem('1App_booking_date', new Date().toISOString());
        sessionStorage.setItem('1App_booking_slot', `Instant • In ${slot.etaMinutes || 50} mins`);
    } else if (slot.type === 'scheduled') {
        sessionStorage.setItem('1App_booking_date', slot.date);
        sessionStorage.setItem('1App_booking_slot', slot.time);
    }
};

const groupByCategory = (items) =>
    items.reduce((groups, item) => {
        const cat = item.service.category?.name || item.service.category || 'Services';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
        return groups;
    }, {});

const QtyControl = ({ quantity, onDec, onInc }) => (
    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
        <button onClick={onDec} style={{ border: 'none', background: 'none', width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{quantity}</span>
        <button onClick={onInc} style={{ border: 'none', background: 'none', width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#2e7d32', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
);

const Cart = () => {
    const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useContext(CartContext);
    const { user, isAuthenticated } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleCheckout = () => {
        if (!isAuthenticated) {
            toast.warn('Please login to proceed to checkout.');
            navigate('/login');
            return;
        }

        const storedSelection = getStoredBookingSelection();
        if (!selectedSlot && !storedSelection) {
            toast.warn('Please select a time slot before checkout.');
            return;
        }

        if (selectedSlot) {
            persistBookingSelection(selectedSlot);
        }

        navigate('/checkout');
    };

    const [slotModalOpen, setSlotModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(() => getStoredBookingSelection());

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);
        persistBookingSelection(slot);
        toast.success('Slot selected');
    };

    // ── Empty State ──
    if (cartItems.length === 0) {
        return (
            <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                <svg width="160" height="155" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 24 }}>
                    {/* Cart body */}
                    <rect x="52" y="82" width="96" height="66" rx="7" fill="#d4d4d4" />
                    <rect x="58" y="88" width="84" height="54" rx="5" fill="#e9e9e9" />
                    {/* Vertical stripes */}
                    {[0,1,2,3,4,5].map(i => <rect key={i} x={66 + i * 13} y="91" width="7" height="48" rx="2.5" fill="#c8c8c8" />)}
                    {/* Handle */}
                    <rect x="48" y="73" width="44" height="11" rx="5.5" fill="#8B5E3C" />
                    {/* Wheels */}
                    {[63, 90, 117, 144].map((cx, i) => <circle key={i} cx={cx} cy="160" r="10" fill="none" stroke="#b0b0b0" strokeWidth="4" />)}
                    {/* Bird body */}
                    <ellipse cx="140" cy="79" rx="17" ry="14" fill="#6c47ff" />
                    <circle cx="153" cy="68" r="11" fill="#6c47ff" />
                    <polygon points="164,68 173,65 164,73" fill="#f5a623" />
                    <circle cx="156" cy="66" r="2.5" fill="white" />
                    <circle cx="157" cy="66" r="1.2" fill="#222" />
                    <polygon points="123,84 107,76 123,92" fill="#5535cc" />
                    <line x1="140" y1="93" x2="140" y2="103" stroke="#f5a623" strokeWidth="2.5" />
                    <line x1="140" y1="103" x2="133" y2="109" stroke="#f5a623" strokeWidth="2.5" />
                    <line x1="140" y1="103" x2="147" y2="109" stroke="#f5a623" strokeWidth="2.5" />
                </svg>

                <h2 style={{ fontWeight: 800, fontSize: '2rem', color: '#111', marginBottom: 8 }}>Your Cart is Empty</h2>
                <p style={{ color: '#888', fontSize: '1.05rem', marginBottom: 28 }}>Lets add some services</p>
                <Link
                    to="/services"
                    style={{
                        background: '#a8d5a2',
                        color: '#2d7a27',
                        border: '2px solid #7bbf74',
                        borderRadius: 12,
                        padding: '10px 40px',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        textDecoration: 'none',
                        display: 'inline-block',
                    }}
                >
                    Explore Services
                </Link>
            </div>
        );
    }

    const grouped = groupByCategory(cartItems);
    const total = getCartTotal();

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>

                {/* Back + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <FaArrowLeft size={18} color="#111" />
                    </button>
                    <h2 style={{ fontWeight: 800, fontSize: '1.5rem', margin: 0, color: '#111' }}>Checkout</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

                    {/* ── LEFT ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Saving banner */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: '12px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FaTag size={13} color="#2e7d32" />
                            </div>
                            <span style={{ fontSize: 14, color: '#333' }}>
                                Saving <strong>₹0</strong> on this order
                            </span>
                        </div>

                        {/* Account card */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#111' }}>Account</div>
                            {isAuthenticated ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <FaCheckCircle color="#2e7d32" size={15} />
                                    <span style={{ fontSize: 14, color: '#555' }}>
                                        Logged in as <strong>{user?.name || user?.email}</strong>
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <p style={{ fontSize: 14, color: '#888', margin: '0 0 14px' }}>To book the service, please login or sign up</p>
                                    <button
                                        onClick={() => navigate('/login')}
                                        style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                                    >
                                        Login
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Slot card */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Slot</div>
                            {selectedSlot ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ color: '#333' }}>{selectedSlot.type === 'instant' ? `Instant • In ${selectedSlot.etaMinutes} mins` : `${new Date(selectedSlot.date).toLocaleDateString()} • ${selectedSlot.time}`}</div>
                                    <button onClick={() => setSlotModalOpen(true)} style={{ border: '1px solid #e6e6e6', background: '#fff', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>Edit</button>
                                </div>
                            ) : (
                                <button onClick={() => setSlotModalOpen(true)} style={{ width: '100%', background: '#6c47ff', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Select time & date</button>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Services grouped by category */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            {Object.entries(grouped).map(([category, items], catIdx, arr) => (
                                <div key={category}>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 14 }}>{category}</div>
                                    {items.map((item, idx) => (
                                        <div key={item.service._id}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                                    {item.service.imageUrl && (
                                                        <img
                                                            src={resolveImageUrl(item.service.imageUrl)}
                                                            alt={item.service.name}
                                                            style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                                                        />
                                                    )}
                                                    <span style={{ fontSize: 14, color: '#333', lineHeight: 1.4 }}>{item.service.name}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, marginLeft: 12 }}>
                                                    <QtyControl
                                                        quantity={item.quantity}
                                                        onDec={() => {
                                                            if (item.quantity === 1) { removeFromCart(item.service._id); toast.info(`${item.service.name} removed`); }
                                                            else updateQuantity(item.service._id, item.quantity - 1);
                                                        }}
                                                        onInc={() => updateQuantity(item.service._id, item.quantity + 1)}
                                                    />
                                                    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 64, textAlign: 'right', color: '#111' }}>
                                                        ₹{(item.service.price * item.quantity).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                            {idx < items.length - 1 && <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '0 0 14px' }} />}
                                        </div>
                                    ))}
                                    {catIdx < arr.length - 1 && <hr style={{ border: 'none', borderTop: '1px solid #ebebeb', margin: '6px 0 16px' }} />}
                                </div>
                            ))}

                            {/* Avoid calling checkbox */}
                            <hr style={{ border: 'none', borderTop: '1.5px dashed #e0e0e0', margin: '8px 0 14px' }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input type="checkbox" defaultChecked style={{ width: 17, height: 17, accentColor: '#2e7d32', cursor: 'pointer' }} />
                                <span style={{ fontSize: 13, color: '#666' }}>Avoid calling before reaching the location</span>
                            </label>
                        </div>

                        {/* Coupons */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FaPercent size={14} color="#2e7d32" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Coupons and offers</div>
                                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                                    {isAuthenticated ? 'No coupons available' : 'Login/Sign up to view offers'}
                                </div>
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 18 }}>Payment summary</div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#555' }}>
                                <span>Item total</span>
                                <span>₹{total.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                                <span style={{ color: '#2e7d32', fontWeight: 600 }}>Free service offer</span>
                                <span style={{ color: '#2e7d32', fontWeight: 600 }}>-₹0</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#555' }}>
                                <span>Total amount</span>
                                <span>₹{total.toLocaleString('en-IN')}</span>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '0 0 14px' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Amount to pay</span>
                                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#111' }}>₹{total.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ textAlign: 'right', marginBottom: 20 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', color: '#333' }}>View breakup</span>
                            </div>

                            <button
                                onClick={handleCheckout}
                                style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                            >
                                Proceed to Pay
                            </button>
                        </div>

                    </div>
                </div>
            </div>
            <SlotModal open={slotModalOpen} onClose={() => setSlotModalOpen(false)} onSelect={handleSlotSelect} initial={false} />
        </div>
    );
};

export default Cart;
