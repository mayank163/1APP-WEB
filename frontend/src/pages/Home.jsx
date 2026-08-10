import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import serviceService from '../services/serviceService';
import { resolveImageUrl } from '../services/api';
import CategoryPopup from '../components/CategoryPopup';
import AllCategoriesPopup from '../components/AllCategoriesPopup';
import {
    FaSearch, FaStar, FaUsers, FaTag, FaHome, FaBriefcase,
    FaLaptop, FaBullhorn, FaChartLine, FaUserMd, FaHeartbeat,
    FaGraduationCap, FaCalendarAlt, FaPalette, FaCar, FaShieldAlt,
    FaTools, FaWrench, FaPaintRoller, FaBolt, FaSnowflake,
    FaTint, FaUser, FaClock, FaArrowRight, FaPhone, FaPhoneAlt, FaMapMarkerAlt,
    FaEnvelope, FaFacebook, FaTwitter, FaInstagram, FaYoutube,
    FaWhatsapp, FaAppStore, FaGooglePlay, FaCamera, FaShoppingBag,
    FaUserCircle, FaChartBar, FaBus
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import { HomeShimmer } from '../components/Shimmer';
import HeroBookingBar from '../components/HeroBookingBar';

const Home = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [categoriesWithSubs, setCategoriesWithSubs] = useState([]);
    const [featuredServices, setFeaturedServices] = useState([]);
    const [mostBooked, setMostBooked] = useState([]);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [popupCategory, setPopupCategory] = useState(null);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [hierarchy, setHierarchy] = useState({});

    const UPLOAD_IMAGE_URL = `${process.env.REACT_APP_IMAGE_URL}`;

    const resolveCategoryImage = (imageUrl) => {
        if (!imageUrl) return null;
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
        const filename = imageUrl.replace(/^\/uploads\//, '').replace(/^\//, '');
        return `${UPLOAD_IMAGE_URL}${filename}`;
    };


    useEffect(() => {
        // Check authentication
        const token = localStorage.getItem('1App_token');
        setIsAuthenticated(!!token);
        fetchHomeData();
    }, []);

    const fetchHomeData = async () => {
        setLoading(true);
        try {
            let allServices = [];

            // Fetch all services
            const servicesRes = await serviceService.getAllServices();
            if (servicesRes.success) {
                allServices = servicesRes.data.services;
                setServices(allServices);
                setFeaturedServices(allServices.slice(0, 5));
            }

            // Fetch featured services from endpoint for Most Booked Services section
            const featuredRes = await serviceService.getFeaturedServices();
            if (featuredRes.success) {
                setMostBooked(featuredRes.data.services || []);
            } else if (allServices.length > 0) {
                const sortedFallback = [...allServices].sort((a, b) =>
                    (b.ratingsAverage || 0) - (a.ratingsAverage || 0)
                );
                setMostBooked(sortedFallback.slice(0, 4));
            }

            // Fetch categories with subcategories
            const catRes = await serviceService.getCategoriesWithSubcategories();
            if (catRes.success) {
                setCategoriesWithSubs(catRes.data.categories);
                setCategories(catRes.data.categories);
            }
        } catch (err) {
            toast.error('Failed to load homepage data');
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryClick = async (category) => {
        const cat = categoriesWithSubs.find(c => c.name === category);
        if (!cat) {
            navigate(`/services?search=${encodeURIComponent(category)}`);
            return;
        }
        if (cat.subcategories && cat.subcategories.length > 0) {
            setPopupCategory({ label: category, categoryId: cat.id, subcategories: cat.subcategories });
        } else {
            navigate(`/services?category=${cat.id}`);
        }
    };

    const handleClosePopup = useCallback(() => setPopupCategory(null), []);

    // Navigate to service detail page
    const handleServiceClick = (serviceId) => {
        navigate(`/service/${serviceId}`);
    };

    // Handle book now - check auth then navigate to service detail
    const handleBookNow = (serviceId, e) => {
        e.stopPropagation(); // Prevent triggering the parent card click
        const token = localStorage.getItem('1App_token');
        if (!token) {
            toast.warning('Please login to book services');
            navigate('/login');
            return;
        }
        navigate(`/service/${serviceId}`);
    };

    const handleViewAllServices = (categoryName) => {
        const cat = categoriesWithSubs.find(c => c.name === categoryName);
        if (cat) navigate(`/services?category=${cat.id}`);
        else navigate(`/services`);
    };

    const getCategoryServices = (categoryName) => {
        return services.filter(s => s.category?.name === categoryName).slice(0, 4);
    };

    const getCategoryByName = (name) => {
        return categoriesWithSubs.find(c =>
            c.name.toLowerCase().replace(/\s+/g, '').includes(name.toLowerCase().replace(/\s+/g, '')) ||
            name.toLowerCase().replace(/\s+/g, '').includes(c.name.toLowerCase().replace(/\s+/g, ''))
        );
    };


    const renderStars = (rating) => {
        const stars = [];
        const fullStars = Math.floor(rating || 0);
        const hasHalfStar = (rating || 0) % 1 >= 0.5;

        for (let i = 0; i < fullStars; i++) {
            stars.push(<FaStar key={i} className="text-warning" style={{ fontSize: '12px' }} />);
        }
        if (hasHalfStar) {
            stars.push(<FaStar key="half" className="text-warning" style={{ fontSize: '12px', opacity: 0.5 }} />);
        }
        return stars;
    };

    // Helper to resolve hero image path (falls back gracefully)
    const tryHeroImg = (filename) => {
        try { return require(`../assets/hero/${filename}`); }
        catch { return ''; }
    };

    if (loading) {
        return <HomeShimmer />;
    }



    return (
        <div className="home-page">
            <style>{`
                .hero-three-col {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 40px;
                    height: 100%;
                    gap: 24px;
                    flex-wrap: wrap;
                    overflow: hidden;
                }

                .hero-side-card {
                    background: rgba(255,255,255,1);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    border-radius: 28px;
                    padding: 28px 24px 24px;
                    width: 290px;
                    max-width: 100%;
                    flex: 0 0 290px;
                    min-width: 0;
                    overflow: hidden;
                    box-shadow: 0 8px 40px rgba(0,0,0,0.16);
                    align-self: center;
                }

                .hero-center-panel {
                    flex: 1 1 320px;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 0 16px;
                }

                @media (max-width: 1150px) {
                    .hero-three-col {
                        justify-content: center;
                        padding: 0 20px;
                    }

                    .hero-side-card {
                        flex-basis: min(290px, 100%);
                        width: min(290px, 100%);
                    }

                    .hero-center-panel {
                        order: -1;
                        width: 100%;
                        flex-basis: 100%;
                    }
                }

                @media (max-width: 768px) {
                    .hero-three-col {
                        height: auto;
                        min-height: 100%;
                        padding: 24px 16px 120px;
                    }

                    .hero-side-card {
                        width: 100%;
                        flex-basis: 100%;
                    }

                    .hero-center-panel {
                        padding: 0;
                    }
                }
            `}</style>

            {/* Category Popup */}
            {popupCategory && (
                <CategoryPopup
                    category={popupCategory.label}
                    categoryId={popupCategory.categoryId}
                    subcategories={popupCategory.subcategories}
                    onClose={handleClosePopup}
                />
            )}

            {/* All Categories Popup */}
            {showAllCategories && (
                <AllCategoriesPopup
                    categories={categoriesWithSubs}
                    onClose={() => setShowAllCategories(false)}
                    onCategorySelect={(cat) => {
                        setPopupCategory({
                            label: cat.name,
                            categoryId: cat.id || cat._id,
                            subcategories: cat.subcategories,
                        });
                    }}
                />
            )}


            {/* ── Hero Section ── */}
            <div style={{ padding: 0, background: '#fff' }}>
                <div style={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '580px',
                    height: '680px',
                }}>
                    {/* Background photo */}
                    <img
                        src={tryHeroImg('BG.png')}
                        alt="Hero"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {/* Subtle overlay */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)', zIndex: 1 }} />

                    {/* ── Three-column layout: LEFT CARD | CENTRE | RIGHT CARD ── */}
                    <div className="hero-three-col">

                        {/* ── LEFT CARD — Home Services subcategories ── */}
                        {(() => {
                            const homeCat = getCategoryByName('Home');
                            const desiredSubNames = ['Cleaning', 'Diagnosis', 'Home Theater', 'Smart Home', 'TV Mounting'];
                            const homeSubcategories = desiredSubNames.map(name =>
                                homeCat?.subcategories?.find(s => s.name?.toLowerCase() === name.toLowerCase()) || { name }
                            );
                            const subIcons = [
                                <FaSnowflake size={15} />,
                                <FaWrench size={15} />,
                                <FaTools size={15} />,
                                <FaHome size={15} />,
                                <FaBolt size={15} />,
                            ];
                            return (
                                <div className="hero-side-card">
                                    {/* Card header */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                                        <div style={{
                                            width: '58px', height: '58px', borderRadius: '50%',
                                            background: '#1a1a1a',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: '12px',
                                        }}>
                                            <FaHome size={24} style={{ color: '#fff' }} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '17px', color: '#1a1a1a' }}>Home Services</span>
                                    </div>

                                    {/* Subcategory list */}
                                    <div style={{ marginBottom: '20px' }}>
                                        {homeSubcategories.map((sub, i) => (
                                            <div
                                                key={i}
                                                onClick={() => sub._id
                                                    ? navigate(`/services?category=${sub.category?._id || sub.category || homeCat?.id}&subcategory=${sub._id}`)
                                                    : (homeCat ? navigate(`/services?category=${homeCat.id}`) : handleCategoryClick('Home Services'))
                                                }
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '11px 0',
                                                    borderBottom: i < homeSubcategories.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ color: '#555', flexShrink: 0 }}>{subIcons[i] || <FaTools size={15} />}</span>
                                                    <span style={{ fontSize: '14px', color: '#2a2a2a', fontWeight: 600 }}>{sub.name}</span>
                                                </div>
                                                <FaArrowRight size={11} style={{ color: '#bbb', flexShrink: 0 }} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Explore All Home Services button */}
                                    <button
                                        onClick={() => homeCat ? navigate(`/services?category=${homeCat.id}`) : handleCategoryClick('Home Services')}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            width: '100%',
                                            background: '#1a1a1a',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '999px',
                                            padding: '11px 16px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>Explore All Services</span>
                                        <span style={{
                                            background: '#fff',
                                            color: '#1a1a1a',
                                            borderRadius: '50%',
                                            width: '26px', height: '26px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <FaArrowRight size={11} />
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}

                        {/* ── CENTRE — Trust badge, headline, CTA ── */}
                        <div className="hero-center-panel">
                            {/* Trust badge */}
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '7px',
                                background: 'rgba(255,255,255,0.20)',
                                borderRadius: '999px',
                                padding: '6px 18px',
                                fontSize: '12px', fontWeight: 600, color: '#1a1a1a',
                                letterSpacing: '0.5px',
                                marginBottom: '22px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
                            }}>
                                <FaStar size={11} style={{ color: '#1a1a1a' }} />
                                TRUSTED BY 10,000+ CUSTOMERS
                            </div>

                            {/* Headline */}
                            <h1 style={{
                                fontSize: 'clamp(32px, 4vw, 54px)',
                                fontWeight: 800,
                                color: '#1a1a1a',
                                textAlign: 'center',
                                lineHeight: 1.12,
                                marginBottom: '14px',
                                textShadow: '0 1px 8px rgba(255,255,255,0.6)',
                            }}>
                                At your ease,<br />
                                at your <em style={{ fontStyle: 'italic', fontWeight: 900, fontFamily: 'playfair display' }}>Doorsteps!</em>
                            </h1>

                            {/* ── Booking Bar ── */}
                            <HeroBookingBar />
                            {/* Subtitle */}
                            <p style={{
                                fontSize: '20px', color: '#000000ff', fontWeight: 'bold',
                                textAlign: 'center', marginBottom: '28px', lineHeight: 1.5,
                                textShadow: '0 1px 6px rgba(241, 241, 241, 0.5)',
                                padding: '12px ',
                            }}>
                            </p>


                        </div>

                        {/* ── RIGHT CARD — All other categories (no subcategories shown) ── */}
                        {(() => {
                            const homeCat = getCategoryByName('Home');
                            const otherCats = categoriesWithSubs
                                .filter(c => {
                                    if (!homeCat) return true;
                                    return (c.id || c._id) !== (homeCat.id || homeCat._id);
                                })
                                .slice(0, 5);

                            const catIcons = [
                                <FaBriefcase size={15} />,
                                <FaLaptop size={15} />,
                                <FaBullhorn size={15} />,
                                <FaUserMd size={15} />,
                                <FaGraduationCap size={15} />,
                            ];

                            return (
                                <div className="hero-side-card">
                                    {/* Card header */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                                        <div style={{
                                            width: '58px', height: '58px', borderRadius: '50%',
                                            background: '#1a1a1a',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: '12px',
                                        }}>
                                            <FaBriefcase size={24} style={{ color: '#fff' }} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '17px', color: '#1a1a1a' }}>All Services</span>
                                    </div>

                                    {/* Category list (top-level, no subcategories) */}
                                    <div style={{ marginBottom: '20px' }}>
                                        {otherCats.map((cat, i) => (
                                            <div
                                                key={cat.id || cat._id || i}
                                                onClick={() => cat.subcategories && cat.subcategories.length > 0
                                                    ? setPopupCategory({ label: cat.name, categoryId: cat.id || cat._id, subcategories: cat.subcategories })
                                                    : navigate(`/services?category=${cat.id || cat._id}`)
                                                }
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '11px 0',
                                                    borderBottom: i < otherCats.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ color: '#555', flexShrink: 0 }}>{catIcons[i] || <FaTools size={15} />}</span>
                                                    <span style={{ fontSize: '14px', color: '#2a2a2a', fontWeight: 600 }}>{cat.name}</span>
                                                </div>
                                                <FaArrowRight size={11} style={{ color: '#bbb', flexShrink: 0 }} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Explore All Services button */}
                                    <button
                                        onClick={() => setShowAllCategories(true)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            width: '100%',
                                            background: '#1a1a1a',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '999px',
                                            padding: '11px 16px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>Explore All Services</span>
                                        <span style={{
                                            background: '#fff',
                                            color: '#1a1a1a',
                                            borderRadius: '50%',
                                            width: '26px', height: '26px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <FaArrowRight size={11} />
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}

                    </div>

                    {/* ── Stats bar fixed at the bottom of the hero card ── */}
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '28px',
                        right: '28px',
                        zIndex: 3,
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        borderRadius: '999px',
                        padding: '14px 28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-around',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                    }}>
                        {[
                            { icon: <FaTag size={18} />, value: '50+', label: 'SERVICE CATEGORIES' },
                            { icon: <FaUsers size={18} />, value: '500+', label: 'EXPERT PROFESSIONALS' },
                            { icon: <FaUserCircle size={18} />, value: '10K+', label: 'HAPPY CUSTOMERS' },
                            { icon: <FaStar size={18} />, value: '4.8/5', label: 'AVERAGE RATING' },
                        ].map((stat, i, arr) => (
                            <React.Fragment key={i}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '42px', height: '42px', borderRadius: '50%',
                                        background: '#1a1a1a',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', flexShrink: 0,
                                    }}>
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '18px', color: '#1a1a1a', lineHeight: 1.1 }}>{stat.value}</div>
                                        <div style={{ fontSize: '10px', color: '#888', fontWeight: 600, letterSpacing: '0.5px' }}>{stat.label}</div>
                                    </div>
                                </div>
                                {i < arr.length - 1 && (
                                    <div style={{ width: '1px', height: '36px', background: 'rgba(0,0,0,0.10)' }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Exclusive Home Services Offers */}
            <section className="py-5 bg-white">
                <div className="container">
                    <h2 className="fw-bold mb-1">Exclusive Home Services Offers</h2>
                    <p className="text-muted mb-4">Book Cleaner, Plumber, Handyman, Gardner or any one for your home help.</p>
                    <div className="position-relative">
                        <div
                            id="offersScrollRow"
                            className="d-flex gap-4 pb-2"
                            style={{ overflowX: 'auto', scrollbarWidth: 'none', scrollBehavior: 'smooth' }}
                        >
                            {[
                                { badge: 'UP TO $500 OFF', title: 'Home Cleaning', desc: 'Deep Cleaning. Sofa Cleaning. Spotless Spaces.', img: 'cleaning_image.png', categoryName: 'Cleaning', subcategoryName: 'Home Cleaning' },
                                { badge: 'SAME DAY SERVICE', title: 'Plumbing', desc: 'Leak Repairs. Pipe Installation. Water Solutions.', img: 'plumbing_image.png', categoryName: 'Plumbing', subcategoryName: null },
                                { badge: 'CERTIFIED EXPERTS', title: 'Electrical', desc: 'Switches. Wiring. Safe Installations.', img: 'electrician.png', categoryName: 'Electrical', subcategoryName: null },
                                { badge: 'UP TO $300 OFF', title: 'Handyman', desc: 'Repairs. Installations. Fix Anything.', img: 'handy_man.png', categoryName: 'Handyman', subcategoryName: null },
                                { badge: 'SAME DAY SERVICE', title: 'AC & Appliance', desc: 'AC Service. Appliance Repair. Quick Fix.', img: 'ac_repair.png', categoryName: 'AC', subcategoryName: null },
                            ].map((item, idx) => {
                                const offerCat = getCategoryByName(item.categoryName);
                                const offerSub = offerCat && item.subcategoryName
                                    ? offerCat.subcategories?.find(s =>
                                        s.name?.toLowerCase().includes(item.subcategoryName.toLowerCase()) ||
                                        item.subcategoryName.toLowerCase().includes(s.name?.toLowerCase())
                                    )
                                    : null;
                                const handleOfferClick = () => {
                                    if (offerCat && offerSub) {
                                        navigate(`/services?category=${offerCat.id}&subcategory=${offerSub._id}`);
                                    } else if (offerCat) {
                                        navigate(`/services?category=${offerCat.id}`);
                                    } else {
                                        navigate(`/services?search=${encodeURIComponent(item.categoryName)}`);
                                    }
                                };
                                return (
                                <div
                                    key={idx}
                                    className="rounded-4 overflow-hidden position-relative flex-shrink-0"
                                    style={{ width: 'calc(33.33% - 12px)', minWidth: '260px', minHeight: '260px', background: '#222', cursor: 'pointer' }}
                                    onClick={handleOfferClick}
                                >
                                    <img
                                        src={tryHeroImg(item.img)}
                                        alt={item.title}
                                        className="position-absolute w-100 h-100"
                                        style={{ objectFit: 'cover', top: 0, left: 0, opacity: 0.55 }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <div className="position-relative p-4 d-flex flex-column justify-content-between" style={{ minHeight: '260px' }}>
                                        <div>
                                            <span className="fw-bold text-white px-2 py-1 rounded-2 mb-2 d-inline-block" style={{ background: '#000000', fontSize: '10px', letterSpacing: '0.5px' }}>{item.badge}</span>
                                            <p className="text-white mb-1" style={{ fontSize: '11px', opacity: 0.7, letterSpacing: '1px' }}>ONE-APP</p>
                                            <h4 className="fw-bold text-white mb-2">{item.title}</h4>
                                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: 1.6 }}>{item.desc}</p>
                                        </div>
                                        <button
                                            className="btn fw-semibold rounded-3 px-4 py-2"
                                            style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }}
                                            onClick={(e) => { e.stopPropagation(); handleOfferClick(); }}
                                        >
                                            Book Now
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                        {/* Left Arrow */}
                        <button
                            className="position-absolute d-flex align-items-center justify-content-center border-0 bg-white rounded-circle shadow"
                            style={{ top: '50%', left: '-18px', transform: 'translateY(-50%)', width: '36px', height: '36px', zIndex: 2, cursor: 'pointer' }}
                            onClick={() => { const el = document.getElementById('offersScrollRow'); el.scrollBy({ left: -300, behavior: 'smooth' }); }}
                        >
                            <FaArrowRight style={{ transform: 'rotate(180deg)', fontSize: '14px' }} />
                        </button>
                        {/* Right Arrow */}
                        <button
                            className="position-absolute d-flex align-items-center justify-content-center border-0 bg-white rounded-circle shadow"
                            style={{ top: '50%', right: '-18px', transform: 'translateY(-50%)', width: '36px', height: '36px', zIndex: 2, cursor: 'pointer' }}
                            onClick={() => { const el = document.getElementById('offersScrollRow'); el.scrollBy({ left: 300, behavior: 'smooth' }); }}
                        >
                            <FaArrowRight style={{ fontSize: '14px' }} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Home Painting Banner */}
            <section className="py-5 bg-white">
                <div className="container">
                    <div className="rounded-4 overflow-hidden d-flex" style={{ background: '#fdfdf0', minHeight: '200px' }}>
                        <div className="p-5 d-flex flex-column justify-content-center" style={{ flex: '0 0 45%' }}>
                            <h2 className="fw-bold mb-2" style={{ color: '#1a1a1a', fontSize: '1.6rem', lineHeight: 1.3 }}>Give your space the glow-up it deserves</h2>
                            <p className="text-muted mb-5" style={{ fontSize: '16px', lineHeight: 1.8 }}>
                                We believe deeply in driving social and economic progress across the region. We use our app to connect customers to the communities that need the most support.
                            </p>
                            <button className="btn rounded-3 px-4 py-2" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }}>Read More</button>
                        </div>
                        <div style={{ flex: '0 0 55%', overflow: 'hidden' }}>
                            <img
                                src={tryHeroImg('Home Painting.png')}
                                alt="Home Painting"
                                className="w-100 h-100"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                            <div className="w-100 h-100 align-items-center justify-content-center bg-light" style={{ display: 'none', minHeight: '200px' }}>
                                <FaPaintRoller size={60} className="text-muted" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Business Services */}
            {/*
            {(() => {
                const cat = getCategoryByName('BusinessServices'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Expert repair for all home appliances</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See all</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} style={{ cursor: 'pointer', minWidth: 0 }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaTools size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-semibold text-dark mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="fw-bold">${sub.startingFromPrice}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}
            */}

            {/* Home Repair & Installation */}
            {(() => {
                const cat = getCategoryByName('Handyman'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Trusted handyman services at your door</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See all</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} style={{ cursor: 'pointer', minWidth: 0 }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaWrench size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-semibold text-dark mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="fw-bold">${sub.startingFromPrice}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* Beauty & Personal Care */}
            {/*
            {(() => {
                const cat = getCategoryByName('Beauty'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Professional beauty services at home</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See all</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} style={{ cursor: 'pointer', minWidth: 0 }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaPalette size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-semibold text-dark mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="fw-bold">${sub.startingFromPrice}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}
            */}

            {/* RO Water Purifier Banner */}
            {/* <section className="py-5 bg-white">
                <div className="container">
                    <div className="rounded-4 overflow-hidden d-flex" style={{ background: '#d6d9e0', minHeight: '220px' }}>
                        <div className="p-5 d-flex flex-column justify-content-center" style={{ flex: '0 0 45%' }}>
                            <span className="fw-semibold text-white px-3 py-1 rounded-2 mb-3" style={{ background: '#000000', fontSize: '11px', width: 'fit-content' }}>UP TO $3,100 OFF</span>
                            <p className="mb-1" style={{ fontSize: '12px', color: '#444', letterSpacing: '0.5px' }}>ONE-APP</p>
                            <h2 className="fw-bold mb-2" style={{ color: '#1a1a1a', fontSize: '2rem', lineHeight: 1.2 }}>RO water purifier</h2>
                            <p className="text-muted mb-4">Needs no service for 2 years</p>
                            <button className="btn rounded-3 px-4 py-2 fw-semibold" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }}>Buy now</button>
                        </div>
                        <div style={{ flex: '0 0 55%', overflow: 'hidden' }}>
                            <img
                                src={tryHeroImg('water-purifier.png')}
                                alt="RO Water Purifier"
                                className="w-100 h-100"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                            <div className="w-100 h-100 align-items-center justify-content-center" style={{ display: 'none', minHeight: '220px', background: '#c8cdd6' }}>
                                <FaTint size={60} className="text-muted" />
                            </div>
                        </div>
                    </div>
                </div>
            </section> */}

            {/* Personal Care for Men */}
            {(() => {
                const cat = getCategoryByName('Grooming'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Grooming essentials delivered at home</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See all</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} style={{ cursor: 'pointer', minWidth: 0 }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaUser size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-semibold text-dark mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="fw-bold">${sub.startingFromPrice}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* Transportation Services */}
            {/*
            {(() => {
                const cat = getCategoryByName('Transportation'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Safe and reliable ride services</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See all</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} style={{ cursor: 'pointer', minWidth: 0 }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaCar size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-semibold text-dark mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="fw-bold">${sub.startingFromPrice}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}
            */}



            {/* All Home Services Banner */}
            {/* 

            <section className="py-5 bg-white">
                <div className="container">
                    <div className="rounded-4 overflow-hidden position-relative" style={{ background: '#111', minHeight: '380px' }}>
                        <img
                            src={tryHeroImg('all-services.png')}
                            alt="All Home Services"
                            className="position-absolute h-100"
                            style={{ objectFit: 'cover', top: 0, right: 0, width: '55%', opacity: 0.9 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />

                        <div className="position-absolute h-100" style={{ top: 0, left: 0, width: '60%', background: 'linear-gradient(to right, #111 60%, transparent 100%)' }} />
                        <div className="position-relative p-5 d-flex flex-column justify-content-center" style={{ minHeight: '380px', maxWidth: '520px' }}>
                            <span className="fw-bold text-white px-3 py-1 rounded-2 mb-3" style={{ background: '#000000', fontSize: '11px', width: 'fit-content', letterSpacing: '0.5px' }}>ONE APP. ALL SERVICES.</span>
                            <p className="text-white mb-1" style={{ fontSize: '12px', opacity: 0.7, letterSpacing: '1px' }}>ONE-APP</p>
                            <h2 className="fw-bold text-white mb-2" style={{ fontSize: '2.4rem', lineHeight: 1.2 }}>All Home Services<br />in One App</h2>
                            <p className="mb-4" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1.6 }}>Everything your home needs,<br />delivered by trusted experts.</p>

                            <div className="d-flex flex-wrap gap-0 mb-4" style={{ maxWidth: '420px' }}>
                                {[
                                    { icon: <FaTools />, label: 'Cleaning' },
                                    { icon: <FaTint />, label: 'Plumbing' },
                                    { icon: <FaBolt />, label: 'Electrical' },
                                    { icon: <FaPaintRoller />, label: 'Painting' },
                                    { icon: <FaWrench />, label: 'Carpentry' },
                                    { icon: <FaWrench />, label: 'Handyman' },
                                    { icon: <FaSnowflake />, label: 'AC & Appliance\nRepair' },
                                    { icon: <FaShieldAlt />, label: 'Pest Control' },
                                    { icon: <FaHome />, label: 'Gardening &\nLandscaping' },
                                ].map((item, idx) => (
                                    <div key={idx} className="d-flex flex-column align-items-center text-center py-2" style={{ width: '20%', borderRight: '1px solid rgba(255,255,255,0.15)', borderBottom: idx < 5 ? '1px solid rgba(255,255,255,0.15)' : 'none', padding: '8px 4px' }}>
                                        <span className="text-white mb-1" style={{ fontSize: '18px', opacity: 0.85 }}>{item.icon}</span>
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
                                            {item.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 && item.label.includes('\n') && <br />}</span>)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="d-flex align-items-center gap-4 flex-wrap">
                                <button className="btn fw-semibold rounded-3 px-4 py-2" style={{ background: '#000000', color: '#fff', border: 'none' }} onClick={() => navigate('/services')}>Book Now</button>
                                <div className="d-flex align-items-center gap-2" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                                    <FaShieldAlt style={{ color: '#000000' }} />
                                    <span>Verified Professionals</span>
                                    <span>·</span>
                                    <span>On-time Service</span>
                                    <span>·</span>
                                    <span>Upfront Pricing</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section> 


            */}





            {/* IT & Technology Section */}
            <section className="py-5 bg-white">
                <div className="container">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="fw-bold mb-0">Information Technology</h2>
                        <button onClick={() => handleViewAllServices('IT & Technology')} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See All</button>
                    </div>
                    <div className="row g-3 mb-3">
                        <div className="col-lg-7">
                            <div className="rounded-4 overflow-hidden position-relative" style={{ minHeight: '385px', background: '#1a1a2e', cursor: 'pointer' }} onClick={() => handleCategoryClick('IT & Technology')}>
                                <img src={tryHeroImg('it-featured.png')} alt="Software Development" className="position-absolute w-100 h-100" style={{ objectFit: 'cover', top: 0, left: 0, opacity: 0.6 }} onError={(e) => { e.target.style.display = 'none'; }} />
                                <div className="position-relative p-4 d-flex flex-column justify-content-end" style={{ minHeight: '300px' }}>
                                    <span className="fw-bold text-white px-2 py-1 rounded-2 mb-3 d-inline-block" style={{ background: '#7c3aed', fontSize: '10px', width: 'fit-content' }}>Top Rated</span>
                                    <h4 className="fw-bold text-white mb-2">Custom Software &amp; App Development</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px' }}>Build your dream product with our expert development teams.</p>
                                    <button className="btn fw-semibold rounded-3 px-4 py-2 mt-2" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }} onClick={(e) => { e.stopPropagation(); handleCategoryClick('IT & Technology'); }}>Get a Quote</button>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-5 d-flex flex-column gap-3">
                            {[{ icon: <FaLaptop size={20} />, title: 'Web Design', desc: 'Stunning UI/UX for your brand.' }, { icon: <FaUserMd size={20} />, title: 'Technical Assistance.', desc: '24/7' }].map((item, idx) => (
                                <div key={idx} className="rounded-4 border p-4 d-flex flex-column justify-content-between flex-grow-1" style={{ cursor: 'pointer' }} >
                                    <div className="mb-3"><div className="mb-3 text-dark">{item.icon}</div><div className="fw-bold mb-1" style={{ fontSize: '15px' }}>{item.title}</div><div className="text-muted small">{item.desc}</div></div>
                                    <button className="btn btn-sm rounded-3 px-3" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }} onClick={(e) => { navigate('/contact'); }}>Contact now</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-4 overflow-hidden d-flex" style={{ background: '#faf7f2' }}>
                        <div className="p-5 d-flex flex-column justify-content-between" style={{ flex: '0 0 55%' }}>
                            <div>
                                <h2 className="fw-bold mb-2" style={{ fontSize: '2.2rem', lineHeight: 1.2 }}>IT &amp; Marketing</h2>
                                <p className="text-muted mb-4">Digital solutions to grow your business</p>
                                <div className="row g-2">
                                    <div className="col-6">
                                        <div className="fw-semibold small mb-2">Technology</div>
                                        {['Web Design', 'Website Development', 'App Development', 'Software Development'].map((s, i) => {
                                            const itCat = getCategoryByName('IT');
                                            const sub = itCat?.subcategories?.find(sc => sc.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(sc.name.toLowerCase()));
                                            return (
                                                <div key={i} className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: '13px', color: '#444', cursor: 'pointer' }}
                                                    onClick={() => sub ? navigate(`/services?subcategory=${sub._id}`) : (itCat ? navigate(`/services?category=${itCat.id}`) : handleCategoryClick('IT & Technology'))}>
                                                    <FaLaptop size={10} className="text-muted" />{s}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="col-6">
                                        <div className="fw-semibold small mb-2">Marketing</div>
                                        {['Digital Marketing', 'Social Media Marketing', 'SEO', 'Content Marketing', 'Branding'].map((s, i) => {
                                            const mktCat = getCategoryByName('Marketing');
                                            const sub = mktCat?.subcategories?.find(sc => sc.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(sc.name.toLowerCase()));
                                            return (
                                                <div key={i} className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: '13px', color: '#444', cursor: 'pointer' }}
                                                    onClick={() => sub ? navigate(`/services?subcategory=${sub._id}`) : (mktCat ? navigate(`/services?category=${mktCat.id}`) : handleCategoryClick('Marketing & Branding'))}>
                                                    <FaBullhorn size={10} className="text-muted" />{s}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <button className="btn rounded-3 px-4 py-2 mt-4" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }} onClick={() => {
                                const cat = getCategoryByName('IT');
                                if (cat) navigate(`/services?category=${cat.id}`);
                                else handleCategoryClick('IT & Technology');
                            }}>Know more</button>
                        </div>
                        <div style={{ flex: '0 0 45%', position: 'relative', minHeight: '320px' }}>
                            <img src={tryHeroImg('it-marketing.png')} alt="IT & Marketing" className="position-absolute w-100 h-100" style={{ objectFit: 'cover', top: 0, left: 0 }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            <div className="position-absolute w-100 h-100 align-items-center justify-content-center bg-light" style={{ display: 'none', top: 0, left: 0 }}><FaLaptop size={60} className="text-muted" /></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Marketing & Business Services - Dynamic from API */}
            {[
                { key: 'Marketing', subtitle: 'Digital marketing solutions for your brand' },
                { key: 'Consulting', subtitle: 'Expert consulting for your business' },
                { key: 'Professional', subtitle: 'Specialized professional services' },
            ].map(({ key, subtitle }) => {
                const cat = getCategoryByName(key);
                if (!cat) return null;
                return (
                    <section key={key} className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h2 className="fw-bold mb-0">{cat.name}</h2>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See All</button>
                            </div>
                            <div className="row g-3">
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} className="col-lg-3 col-md-6">
                                        <div
                                            className="border rounded-3 p-3 h-100 d-flex flex-column justify-content-between"
                                            style={{ cursor: 'pointer', background: '#fff' }}
                                            onClick={() => navigate(`/services?subcategory=${sub._id}`)}
                                        >
                                            <div>
                                                <div className="fw-semibold mb-1" style={{ fontSize: '14px', lineHeight: 1.4 }}>{sub.name}</div>
                                                <div className="text-muted" style={{ fontSize: '12px', lineHeight: 1.5 }}>{subtitle}</div>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
                                                <div>
                                                    <div className="text-muted" style={{ fontSize: '11px' }}>Standard Package</div>
                                                    <div style={{ fontSize: '13px' }}>Starts From <span className="fw-bold">${sub.startingFromPrice}</span></div>
                                                </div>
                                                <button className="btn p-2 rounded-2" style={{ background: '#f5f5f5', border: 'none', height: '30px' }}>
                                                    <FaPhoneAlt
                                                        size={14}
                                                        className="text-dark"
                                                        style={{ display: 'flex' }}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })}



            {/* Elevate Lifestyle Section */}
            {/* <section className="py-5 bg-white">
                <div className="container">
                    <div className="row g-3">

                        <div className="col-lg-4">
                            <div className="rounded-4 p-4 h-100 d-flex flex-column justify-content-between" style={{ background: '#1a1a1a', minHeight: '220px' }}>
                                <div>
                                    <h2 className="fw-bold text-white mb-3" style={{ fontSize: '1.8rem', lineHeight: 1.2 }}>Elevate your lifestyle.</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6 }}>Certified professionals at your doorstep. We prioritize quality, safety, and your peace of mind.</p>
                                </div>
                                <button className="btn rounded-pill px-4 py-2 fw-semibold" style={{ width: 'fit-content', fontSize: '13px', background: '#000000', color: '#fff', border: 'none' }}>Join Plus Membership</button>
                            </div>
                        </div>

                        <div className="col-lg-8">
                            <div className="row g-3 h-100">
                                {[
                                    { icon: <FaShieldAlt size={24} />, label: 'Vetted Experts' },
                                    { icon: <FaClock size={24} />, label: '24/7 Support' },
                                    { icon: <FaTools size={24} />, label: 'Service Warranty' },
                                    { icon: <FaTag size={24} />, label: 'Fair Pricing' },
                                ].map((item, idx) => (
                                    <div key={idx} className="col-6">
                                        <div className="rounded-4 p-4 h-100 d-flex flex-column align-items-start justify-content-center" style={{ background: '#f5f5f5', minHeight: '100px' }}>
                                            <span style={{ color: '#000000', marginBottom: '10px' }}>{item.icon}</span>
                                            <span className="fw-semibold" style={{ fontSize: '14px' }}>{item.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section> */}

            {/* Health & Wellness */}
            {/*
            {(() => {
                const cat = getCategoryByName('Health'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Holistic care for your body and mind</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-success fw-semibold text-decoration-none p-0" style={{ fontSize: '13px' }}>See all &rsaquo;</button>
                            </div>
                            <div className="row g-4">
                                {cat.subcategories.slice(0, 3).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} className="col-lg-4 col-md-6" style={{ cursor: 'pointer' }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaHeartbeat size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-bold mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="text-muted small">Starts at ${sub.startingFromPrice}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}
            */}

            {/* Accounting & Finance Banner */}

            {/* <section className="py-5 bg-white">
                <div className="container">
                    <div className="rounded-4 overflow-hidden position-relative" style={{ minHeight: '300px', background: '#1a1a1a' }}>
                        <img
                            src={tryHeroImg('accounting.png')}
                            alt="Accounting & Finance"
                            className="position-absolute w-100 h-100"
                            style={{ objectFit: 'cover', top: 0, left: 0, opacity: 0.55 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="position-absolute w-100 h-100" style={{ top: 0, left: 0, background: 'linear-gradient(to right, rgba(15,15,15,0.95) 40%, transparent 100%)' }} />
                        <div className="position-relative p-5 d-flex flex-column justify-content-center" style={{ minHeight: '300px', maxWidth: '420px' }}>
                            <span className="fw-bold text-white px-2 py-1 rounded-2 mb-3 d-inline-block" style={{ background: '#000000', fontSize: '10px', width: 'fit-content', letterSpacing: '0.5px' }}>UP TO $1,700 OFF</span>
                            <p className="text-white mb-1" style={{ fontSize: '11px', opacity: 0.7, letterSpacing: '1.5px' }}>ONE-APP</p>
                            <h2 className="fw-bold text-white mb-3" style={{ fontSize: '2.2rem', lineHeight: 1.2 }}>Accounting<br />&amp; Finance</h2>
                            <p className="text-white mb-4" style={{ opacity: 0.8, lineHeight: 2, fontSize: '14px' }}>
                                Accounting.<br />Bookkeeping.<br />Tax Services.<br />Financial Consulting.
                            </p>
                            <button className="btn fw-semibold rounded-3 px-4 py-2" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }} onClick={() => handleCategoryClick('Accounting & Finance')}>Buy now</button>
                        </div>
                    </div>
                </div>
            </section> */}

            {/* Accounting and Finance Services */}
            {/* {(() => {
                const cat = getCategoryByName('Accounting'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">{cat.name}</h2>
                                    <p className="text-muted small mb-0">Manage your business finances with confidence.</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-success fw-semibold text-decoration-none p-0" style={{ fontSize: '13px' }}>See all &rsaquo;</button>
                            </div>
                            <div className="row g-3">
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} className="col-lg-3 col-md-6" style={{ cursor: 'pointer' }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaChartBar size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-bold mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="text-muted small">Starts at ${sub.startingFromPrice}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()} */}


            {/* Education Section */}
            {/* <section className="py-5 bg-white">
                <div className="container">
                    <div className="rounded-4 overflow-hidden position-relative" style={{ background: 'linear-gradient(135deg, #fdf6e3 0%, #fce8d5 50%, #e8f4f8 100%)', minHeight: '510px' }}>
                        <img
                            src={tryHeroImg('image 3.png')}
                            alt="Education"
                            className="position-absolute h-100"
                            style={{ objectFit: 'cover', top: 0, right: 0, width: '100%', borderRadius: '0 16px 16px 0' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />

                    </div>
                </div>
            </section> */}

            {/* Education Services Section */}
            {/* <section className="py-5 bg-white">
                <div className="container">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="fw-bold mb-0">Education Services</h2>
                            <p className="text-muted small mb-0">Expert guidance for your learning journey.</p>
                        </div>
                        <button onClick={() => handleViewAllServices('Education')} className="btn btn-link text-dark fw-semibold text-decoration-none p-0">See All &rarr;</button>
                    </div>

                    <div className="row g-3 mb-3">
                        {[
                            { badge: 'UP TO $400 OFF', badgeBg: '#000000', title: 'Tutoring', desc: 'Academic Excellence.\nExpert.\nYour Sound.', img: 'tutoring.png' },
                            { badge: 'FREE DEMO', badgeBg: '#000000', title: 'Language Training', desc: 'Master New Languages.\nFluency Guaranteed.', img: 'language.png' },
                            { badge: 'EXPERT COACHES', badgeBg: '#7c3aed', title: 'Music Lessons', desc: 'Learn Instruments.\nDiscover.\nYour Sound.', img: 'music.png' },
                            { badge: 'BEST SELLER', badgeBg: '#000000', title: 'Skill Development', desc: 'Master New Crafts.\nCareer Ready.', img: 'skill.png' },
                        ].map((item, idx) => (
                            <div key={idx} className="col-6">
                                <div className="rounded-4 overflow-hidden position-relative" style={{ minHeight: '215px', background: '#222', cursor: 'pointer' }} onClick={() => handleCategoryClick('Education')}>
                                    <img src={tryHeroImg(item.img)} alt={item.title} className="position-absolute w-100 h-100" style={{ objectFit: 'cover', top: 0, left: 0, opacity: 0.55 }} onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div className="position-relative p-3 d-flex flex-column justify-content-between" style={{ minHeight: '200px' }}>
                                        <div>
                                            <span className="fw-bold text-white px-2 py-1 rounded-2 mb-2 d-inline-block" style={{ background: item.badgeBg, fontSize: '9px', letterSpacing: '0.5px' }}>{item.badge}</span>
                                            <p className="text-white mb-1" style={{ fontSize: '10px', opacity: 0.7, letterSpacing: '1px' }}>ONE-APP</p>
                                            <h5 className="fw-bold text-white mb-1">{item.title}</h5>
                                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', lineHeight: 1.6 }}>
                                                {item.desc.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
                                            </p>
                                        </div>
                                        <button className="btn btn-sm fw-semibold rounded-3 px-3" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }} onClick={(e) => { e.stopPropagation(); handleCategoryClick('Education'); }}>Book Now</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="row g-3 mb-3">
                        <div className="col-lg-8">
                            <div className="rounded-4 border p-4" style={{ background: '#fff' }}>
                                <h6 className="fw-bold mb-2">Certified Professionals only.</h6>
                                <p className="text-muted small mb-5">Every educator on Oneapp Services or Partner Platform undergoes a rigorous 5-step background verification and skill assessment process before joining our elite network.</p>
                                <div className="d-flex gap-3">
                                    <span className="d-flex align-items-center gap-1" style={{ fontSize: '12px', color: '#000000' }}><FaShieldAlt size={12} /> Identity Verified</span>
                                    <span className="d-flex align-items-center gap-1" style={{ fontSize: '12px', color: '#000000' }}><FaGraduationCap size={12} /> Degree Verified</span>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="rounded-4 p-4 h-100 d-flex flex-column justify-content-between" style={{ background: '#1a1a1a' }}>
                                <div>
                                    <p className="text-white mb-1" style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '1px' }}>ONE-APP</p>
                                    <h6 className="fw-bold text-white mb-2">Learning Lab</h6>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Access our premium library of digital resources for all active students.</p>
                                </div>
                                <button className="btn btn-link text-white text-decoration-none p-0" style={{ fontSize: '13px', width: 'fit-content' }} onClick={() => handleCategoryClick('Education')}>Open Library &rarr;</button>
                            </div>
                        </div>
                    </div>


                    <div className="rounded-4 overflow-hidden position-relative" style={{ minHeight: '280px', background: '#111' }}>
                        <img src={tryHeroImg('events.png')} alt="Events & Media" className="position-absolute w-100 h-100" style={{ objectFit: 'cover', top: 0, left: 0, opacity: 0.55 }} onError={(e) => { e.target.style.display = 'none'; }} />
                        <div className="position-absolute w-100 h-100" style={{ top: 0, left: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.85) 45%, transparent 100%)' }} />
                        <div className="position-relative p-5 d-flex flex-column justify-content-center" style={{ minHeight: '280px', maxWidth: '420px' }}>
                            <span className="fw-bold text-white px-2 py-1 rounded-2 mb-3 d-inline-block" style={{ background: '#7c3aed', fontSize: '10px', width: 'fit-content' }}>UP TO $3,100 OFF</span>
                            <p className="text-white mb-1" style={{ fontSize: '10px', opacity: 0.7, letterSpacing: '1px' }}>ONE-APP</p>
                            <h3 className="fw-bold text-white mb-2">Events &amp; Media</h3>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: 1.7 }}>Professional solutions for every occasion. From intimate gatherings to grand celebrations, we bring your vision to life.</p>
                            <div className="d-flex flex-wrap gap-2 mb-4">
                                {['DJ Services', 'Photography', 'Catering', 'Videography', 'Event Planning'].map((tag, i) => (
                                    <span key={i} className="px-3 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '11px' }}>{tag}</span>
                                ))}
                            </div>
                            <button className="btn fw-semibold rounded-3 px-4 py-2" style={{ width: 'fit-content', background: '#000000', color: '#fff', border: 'none' }} onClick={() => handleCategoryClick('Events & Media')}>Book Now &rarr;</button>
                        </div>
                        <div className="position-absolute" style={{ bottom: '20px', right: '30px' }}>
                            <span className="fw-bold text-white" style={{ fontSize: '11px', opacity: 0.4, letterSpacing: '3px' }}>EVENTS &amp; MEDIA SERVICES</span>
                        </div>
                    </div>
                </div>
            </section> */}

            {/* Our Expertise Services */}
            {/*
            {(() => {
                const cat = getCategoryByName('Event'); if (!cat) return null; return (
                    <section className="py-5 bg-white">
                        <div className="container">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 className="fw-bold mb-1">Our Expertise</h2>
                                    <p className="text-muted small mb-0">Select a specialized service for your next event.</p>
                                </div>
                                <button onClick={() => navigate(`/services?category=${cat.id}`)} className="btn btn-link text-success fw-semibold text-decoration-none p-0" style={{ fontSize: '13px' }}>See all &rsaquo;</button>
                            </div>
                            <div className="row g-3">
                                {cat.subcategories.slice(0, 4).map((sub, idx) => (
                                    <div key={idx} onClick={() => navigate(`/services?subcategory=${sub._id}`)} className="col-lg-3 col-md-6" style={{ cursor: 'pointer' }}>
                                        <div className="rounded-4 overflow-hidden mb-3" style={{ height: '220px', background: '#f0f0f0' }}>
                                            {sub.image ? (
                                                <img src={resolveCategoryImage(sub.image)} alt={sub.name} className="w-100 h-100" style={{ objectFit: 'COVER' }} />
                                            ) : (
                                                <div className="w-100 h-100 d-flex align-items-center justify-content-center"><FaCamera size={40} className="text-muted" /></div>
                                            )}
                                        </div>
                                        <div className="fw-bold mb-1" style={{ fontSize: '15px' }}>{sub.name}</div>
                                        <div className="text-muted small">Starts at ${sub.startingFromPrice}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}
            */}



            {/* Social Impact Section */}
            <section className="py-5 bg-white">
                <div className="container">
                    <div className="row align-items-center g-0 border rounded-4 overflow-hidden">
                        <div className="col-lg-5">
                            <img
                                src={tryHeroImg('social-impact.png')}
                                alt="Our Social Impact"
                                className="w-100"
                                style={{ objectFit: 'cover', height: '380px', padding: '10px', borderRadius: '30px' }}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />

                        </div>
                        <div className="col-lg-7 p-5">
                            <h2 className="fw-bold mb-4" style={{ fontSize: '2.2rem' }}>Our social impact</h2>
                            <p className="text-muted mb-5" style={{ fontSize: '16px', lineHeight: 1.8 }}>
                                We believe deeply in driving social and economic progress across the region. We use our app to connect customers to the communities that need the most support.
                            </p>
                            <button className="btn fw-bold px-4 py-2 rounded-3 on" style={{ background: '#000000', color: '#fff', fontSize: '15px', border: 'none' }} onClick={() => navigate("/blogs")}>
                                Read more
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stay Tuned / ONE APP Section */}
            <section
                className="py-5"
                style={{
                    background: "#fff",
                    overflow: "hidden",
                }}
            >
                <div className="container">
                    <div
                        className="position-relative d-flex justify-content-center align-items-start"
                        style={{
                            minHeight: "500px",
                        }}
                    >
                        {/* Background ONE APP */}
                        <div
                            className="position-absolute w-100 text-center"
                            style={{
                                top: "120px",
                                left: 0,
                                zIndex: 1,
                                userSelect: "none",
                                lineHeight: 0.82,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "clamp(120px,22vw,260px)",
                                    fontWeight: 900,
                                    letterSpacing: "-8px",
                                    background:
                                        "linear-gradient(to bottom,#e6e6e6,#9c9c9c)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                ONE
                            </div>

                            <div
                                style={{
                                    fontSize: "clamp(120px,22vw,260px)",
                                    fontWeight: 900,
                                    letterSpacing: "-8px",
                                    background:
                                        "linear-gradient(to bottom,#e6e6e6,#9c9c9c)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                APP
                            </div>
                        </div>

                        {/* Card Wrapper */}
                        <div
                            className="position-relative"
                            style={{
                                width: "100%",
                                maxWidth: "1500px",
                                zIndex: 2,
                            }}
                        >
                            {/* White Blur / Glow */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    bottom: "-55px",
                                    transform: "translateX(-50%)",
                                    width: "88%",
                                    height: "120px",
                                    background: "rgba(255,255,255,0.95)",
                                    filter: "blur(55px)",
                                    borderRadius: "100px",
                                    zIndex: -1,
                                }}
                            />

                            {/* Black Card */}
                            <div
                                className="text-center rounded-4"
                                style={{
                                    background: "#0d0d0d",
                                    padding: "30px 20px",
                                    borderRadius: "24px",
                                    boxShadow: "0px 0px 20px 20px rgba(0, 0, 0, .28)",
                                }}
                            >
                                <div
                                    style={{
                                        color: "#fff",
                                        fontSize: "28px",
                                        opacity: 0.9,
                                        lineHeight: 1,
                                    }}
                                >
                                    ❝
                                </div>

                                <h2
                                    className="mb-4"
                                    style={{
                                        color: "#fff",
                                        fontFamily: "Georgia, serif",
                                        fontStyle: "italic",
                                        fontWeight: 400,
                                        fontSize: "clamp(30px,3vw,52px)",
                                    }}
                                >
                                    "Stay Tuned For More"
                                </h2>

                                <p
                                    className="mb-1"
                                    style={{
                                        color: "#d8d8d8",
                                        fontSize: "16px",
                                    }}
                                >
                                    We're continuously expanding our service networking to deliver
                                </p>

                                <p
                                    style={{
                                        color: "#67d36b",
                                        fontStyle: "italic",
                                        fontWeight: 600,
                                        fontSize: "16px",
                                        margin: 0,
                                    }}
                                >
                                    more value, more expertise and more possibilities.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>




        </div>
    );
};

export default Home;