import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FaStar, FaTag, FaShoppingCart, FaCheckCircle, FaShieldAlt, FaCalendarAlt, FaMedal } from 'react-icons/fa';
import serviceService from '../services/serviceService';
import { resolveImageUrl } from '../services/api';
import { CartContext } from '../context/CartContext';

const UPLOAD_IMAGE_URL = process.env.REACT_APP_IMAGE_URL || '';

const resolveSubImg = (image) => {
    if (!image) return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    const filename = image.replace(/^\/uploads\//, '').replace(/^\//, '');
    return `${UPLOAD_IMAGE_URL}${filename}`;
};

const SLIDES = [
    {
        tag: 'PROFESSIONAL HOME SERVICES',
        title: 'Everything your home needs, all in one place.',
        desc: 'Trusted professionals for cleaning, repairs, maintenance and home improvement.',
        bg: 'linear-gradient(135deg, #2d4a3e 0%, #1a3a2a 100%)',
    },
    {
        tag: 'VERIFIED EXPERTS',
        title: 'Quality service at your doorstep.',
        desc: 'Book trusted professionals for all your home needs with just a few taps.',
        bg: 'linear-gradient(135deg, #1a2a4a 0%, #0d1a2e 100%)',
    },
];

export default function Services() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { cartItems, addToCart, updateQuantity } = useContext(CartContext);

    const categoryId = searchParams.get('category');
    const subcategoryId = searchParams.get('subcategory');

    const [subcategories, setSubcategories] = useState([]);
    const [services, setServices] = useState([]);
    const [activeSubId, setActiveSubId] = useState(subcategoryId || null);
    const [categoryName, setCategoryName] = useState('Home Services');
    const [slide, setSlide] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch subcategories for the left sidebar
    useEffect(() => {
        if (!categoryId) return;
        serviceService.getSubcategoriesByCategoryId(categoryId).then(res => {
            if (res.success) {
                setSubcategories(res.data.subcategories);
                if (res.data.subcategories[0]?.category?.name) {
                    setCategoryName(res.data.subcategories[0].category.name);
                }
            }
        }).catch(() => {});
    }, [categoryId]);

    // Fetch services by subcategory
    const fetchServices = useCallback(async (subId) => {
        setLoading(true);
        try {
            const res = await serviceService.getServicesBySubcategoryId(subId);
            if (res.success) setServices(res.data.services);
        } catch { setServices([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (activeSubId) {
            fetchServices(activeSubId);
        } else if (subcategoryId) {
            setActiveSubId(subcategoryId);
        } else {
            setLoading(false);
        }
    }, [activeSubId, subcategoryId, fetchServices]);

    // Auto-select first subcategory if none selected
    useEffect(() => {
        if (!activeSubId && subcategories.length > 0) {
            setActiveSubId(subcategories[0]._id);
        }
    }, [subcategories, activeSubId]);

    // Slide auto-advance
    useEffect(() => {
        const t = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4000);
        return () => clearInterval(t);
    }, []);

    const handleSubClick = (sub) => {
        setActiveSubId(sub._id);
        navigate(`/services?category=${categoryId}&subcategory=${sub._id}`, { replace: true });
    };

    const getQty = (serviceId) => {
        const item = cartItems.find(i => i.service._id === serviceId);
        return item ? item.quantity : 0;
    };

    const cartTotal = cartItems.reduce((t, i) => t + i.service.price * i.quantity, 0);
    const activeSubName = subcategories.find(s => s._id === activeSubId)?.name || '';

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '300px 1fr 280px', gap: 20, alignItems: 'start' }}>

                {/* ── LEFT: Category + Subcategories ── */}
                <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>{categoryName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <FaStar style={{ color: '#f5a623' }} />
                        <span style={{ fontWeight: 700 }}>4.8</span>
                        <span style={{ color: '#888', fontSize: 13 }}>(12M+ bookings)</span>
                    </div>

                    {/* One-App Cover */}
                    <div style={{ background: '#f0faf4', border: '1px solid #c8e6c9', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FaShieldAlt style={{ color: '#2e7d32', fontSize: 18 }} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>One-App Cover</div>
                                <div style={{ fontSize: 12, color: '#555' }}>Up to 30 days warranty</div>
                            </div>
                        </div>
                        <span style={{ color: '#888', fontSize: 18 }}>›</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#333' }}>Select a service</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {subcategories.map((sub) => (
                            <div
                                key={sub._id}
                                onClick={() => handleSubClick(sub)}
                                style={{
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    padding: '10px 4px',
                                    borderRadius: 10,
                                    background: activeSubId === sub._id ? '#e8f5e9' : '#fafafa',
                                    border: activeSubId === sub._id ? '1.5px solid #4caf50' : '1.5px solid transparent',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f0f0f0', margin: '0 auto 6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {sub.icon
                                        ? <img src={resolveSubImg(sub.icon)} alt={sub.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <FaTag size={18} color="#aaa" />}
                                </div>
                                <div style={{ fontSize: 11, color: '#333', fontWeight: 500, lineHeight: 1.3, wordBreak: 'break-word' }}>{sub.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CENTER: Banner + Services ── */}
                <div>
                    {/* Hero Slider */}
                    <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 24, position: 'relative', height: 220, background: SLIDES[slide].bg, display: 'flex', alignItems: 'center', padding: '0 36px' }}>
                        <div style={{ color: '#fff', maxWidth: 420 }}>
                            <div style={{ background: 'rgba(255,255,255,0.2)', display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
                                {SLIDES[slide].tag}
                            </div>
                            <h2 style={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.3, marginBottom: 8 }}>{SLIDES[slide].title}</h2>
                            <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, margin: 0 }}>{SLIDES[slide].desc}</p>
                        </div>
                        {/* Dots */}
                        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                            {SLIDES.map((_, i) => (
                                <div key={i} onClick={() => setSlide(i)} style={{ width: i === slide ? 24 : 8, height: 8, borderRadius: 4, background: i === slide ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.3s' }} />
                            ))}
                        </div>
                    </div>

                    {/* Services List */}
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>
                        {activeSubName ? `Popular ${activeSubName} Services` : 'Popular Home Services'}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading services...</div>
                    ) : services.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No services found.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            
                            {services.map(svc => {
                                const qty = getQty(svc._id);
                                return (
                                    <div key={svc._id} style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                        {/* Image */}
                                        <div style={{ width: 110, height: 110, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#f0f0f0' }}>
                                            {svc.featuredImage
                                                ? <img src={resolveImageUrl(svc.featuredImage)} alt={svc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTag size={28} color="#ccc" /></div>}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{svc.name}</div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Starts at ₹{svc.price}</div>
                                                    {svc.duration && <div style={{ fontSize: 12, color: '#888' }}>• {svc.duration}</div>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                <FaStar style={{ color: '#f5a623', fontSize: 12 }} />
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{svc.ratingsAverage || 4.8}</span>
                                                {svc.ratingsCount && <span style={{ color: '#888', fontSize: 12 }}>({(svc.ratingsCount / 1000000).toFixed(1)}M reviews)</span>}
                                            </div>
                                            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 12px' }}>
                                                {svc.shortDescription ? svc.shortDescription.slice(0, 100) + (svc.description.length > 100 ? '...' : '') : ''}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span
                                                    onClick={() => navigate(`/service/${svc._id}`)}
                                                    style={{ color: '#2e7d32', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                                                >
                                                    View details
                                                </span>
                                                {qty === 0 ? (
                                                    <button
                                                        onClick={() => addToCart(svc, 1)}
                                                        style={{ border: '1.5px solid #2e7d32', background: '#fff', color: '#2e7d32', fontWeight: 700, borderRadius: 20, padding: '6px 24px', cursor: 'pointer', fontSize: 14 }}
                                                    >
                                                        Add
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid #2e7d32', borderRadius: 20, padding: '4px 12px' }}>
                                                        <button onClick={() => updateQuantity(svc._id, qty - 1)} style={{ border: 'none', background: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', color: '#2e7d32', lineHeight: 1 }}>−</button>
                                                        <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                                                        <button onClick={() => updateQuantity(svc._id, qty + 1)} style={{ border: 'none', background: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', color: '#2e7d32', lineHeight: 1 }}>+</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Promise + Cart ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* One-App Promise */}
                    <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <FaMedal style={{ color: '#2e7d32', fontSize: 22 }} />
                            <span style={{ fontWeight: 700, fontSize: 15 }}>One-App Promise</span>
                        </div>
                        {[
                            'Verified Professionals',
                            'Transparent Pricing',
                            'Easy Booking & Rescheduling',
                            'Quality Guaranteed',
                        ].map((item) => (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <FaCheckCircle style={{ color: '#2e7d32', fontSize: 15, flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: '#333' }}>{item}</span>
                            </div>
                        ))}
                    </div>

                    {/* Cart */}
                    <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 16 }}>Cart</div>

                        {cartItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                    <FaShoppingCart size={28} color="#aaa" />
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>No items in your cart</div>
                                <div style={{ fontSize: 13, color: '#888' }}>Add services to see them here.</div>
                            </div>
                        ) : (
                            <>
                                {cartItems.map(({ service: svc, quantity }) => (
                                    <div key={svc._id} style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: 14, fontWeight: 500 }}>{svc.subcategory?.name || svc.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: '2px 8px' }}>
                                                <button onClick={() => updateQuantity(svc._id, quantity - 1)} style={{ border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>−</button>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{quantity}</span>
                                                <button onClick={() => updateQuantity(svc._id, quantity + 1)} style={{ border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>+</button>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>₹{svc.price * quantity}</div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => navigate('/cart')}
                                    style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20, marginTop: 8 }}
                                >
                                    <span>₹{cartTotal.toLocaleString()}</span>
                                    <span>View Cart</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
