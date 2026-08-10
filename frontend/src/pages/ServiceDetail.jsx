import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import serviceService from '../services/serviceService';
import LoadingSpinner from '../components/LoadingSpinner';
import { ServiceDetailShimmer } from '../components/Shimmer';
import { CartContext } from '../context/CartContext';
import { toast } from 'react-toastify';
import { resolveImageUrl } from '../services/api';
import technicianImage from '../assets/hero/technician_image.png';

const ServiceDetail = () => {
    const { id } = useParams();
    const [service, setService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedAddons, setSelectedAddons] = useState([]);
    const [openFaq, setOpenFaq] = useState(null);
    const [requirementsOpen, setRequirementsOpen] = useState(true);
    const [addonsOpen, setAddonsOpen] = useState(true);

    // Reviews state
    const [reviewData, setReviewData] = useState(null);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsPage, setReviewsPage] = useState(1);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [selectedStar, setSelectedStar] = useState(0);
    const [hoverStar, setHoverStar] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [existingReview, setExistingReview] = useState(null);
    const [canReview, setCanReview] = useState(false);

    const { addToCart } = useContext(CartContext);

    useEffect(() => {
        const fetchService = async () => {
            try {
                const res = await serviceService.getServiceById(id);
                if (res.success) {
                    const s = res.data.service;
                    setService(s);
                    if (s.hasVariants && s.variants?.length > 0) {
                        setSelectedVariant(s.variants[0]);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchService();
    }, [id]);

    // Fetch reviews whenever service or page changes
    useEffect(() => {
        if (!service) return;
        const fetchReviews = async () => {
            setReviewsLoading(true);
            try {
                const res = await serviceService.getServiceReviews(service._id || id, reviewsPage, 5);
                if (res.success) {
                    setReviewData(res.data);
                    // Check if the logged-in user already reviewed
                    const userId = JSON.parse(localStorage.getItem('1App_user') || '{}')._id;
                    if (userId) {
                        const mine = res.data.reviews.find(r => r.user?._id === userId);
                        setExistingReview(mine || null);
                        if (mine) {
                            setSelectedStar(mine.rating);
                            setReviewText(mine.review || '');
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load reviews', err);
            } finally {
                setReviewsLoading(false);
            }
        };
        fetchReviews();
    }, [service, reviewsPage]);

    // Determine if current user can write a review (must be logged in)
    useEffect(() => {
        const token = localStorage.getItem('1App_token');
        setCanReview(!!token);
    }, []);

    const handleSubmitReview = async () => {
        if (!selectedStar) return;
        setSubmittingReview(true);
        try {
            const payload = { rating: selectedStar, review: reviewText.trim() };
            let res;
            if (existingReview) {
                res = await serviceService.updateReview(service._id || id, existingReview._id, payload);
            } else {
                res = await serviceService.submitReview(service._id || id, payload);
            }
            if (res.success) {
                toast.success(existingReview ? 'Review updated!' : 'Review submitted!');
                setShowReviewForm(false);
                setReviewsPage(1);
                // Re-fetch reviews
                const fresh = await serviceService.getServiceReviews(service._id || id, 1, 5);
                if (fresh.success) setReviewData(fresh.data);
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const galleryImages = service?.gallery?.length > 0
        ? service.gallery.map(g => resolveImageUrl(g.url))
        : [resolveImageUrl(service?.featuredImage)].filter(Boolean);

    const totalSlides = Math.ceil(galleryImages.length / 2);

    const handlePrev = () => setGalleryIndex(i => Math.max(0, i - 1));
    const handleNext = () => setGalleryIndex(i => Math.min(totalSlides - 1, i + 1));

    const toggleAddon = (addon) => {
        setSelectedAddons(prev =>
            prev.find(a => a._id === addon._id)
                ? prev.filter(a => a._id !== addon._id)
                : [...prev, addon]
        );
    };

    const getPrice = () => {
        if (selectedVariant) return selectedVariant.offerPrice || selectedVariant.price;
        return service?.offerPrice || service?.price || 0;
    };

    const getTotalPrice = () => {
        const addonTotal = selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
        return getPrice() + addonTotal;
    };

    const handleAddToCart = () => {
        const cartService = selectedVariant
            ? { ...service, price: selectedVariant.offerPrice || selectedVariant.price, name: `${service.name} - ${selectedVariant.name}` }
            : service;

        const added = addToCart(cartService, 1);
        if (!added) {
            toast.info(`${service.subcategory?.name || service.name} is already in your cart!`);
            return;
        }

        // Only add addons if the service was freshly added; skip duplicates silently
        const newAddons = [];
        const skippedAddons = [];
        selectedAddons.forEach(addon => {
            const addonAdded = addToCart({ ...addon, _id: addon._id, price: addon.price }, 1);
            if (addonAdded) newAddons.push(addon.name);
            else skippedAddons.push(addon.name);
        });

        if (skippedAddons.length > 0) {
            toast.success(`Service added. ${skippedAddons.length} add-on(s) already in cart were skipped.`);
        } else {
            toast.success(`${service.subcategory?.name || service.name} added to cart!`);
        }
    };

    if (loading) return <ServiceDetailShimmer />;

    if (!service) {
        return (
            <div className="container py-5 text-center">
                <h3>Service not found</h3>
                <Link to="/services" className="btn btn-warning mt-3">Back to Services</Link>
            </div>
        );
    }

    const visibleImages = galleryImages.slice(galleryIndex * 2, galleryIndex * 2 + 2);
    const basePrice = service.offerPrice || service.price;
    const discountPct = service.discountPercentage || 0;

    return (
        <div style={{ maxWidth: '900px', margin: '20px auto', padding: '0 16px 80px' }}>

            {/* Gallery Carousel */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', borderRadius: '16px', overflow: 'hidden', height: '260px' }}>
                    {visibleImages.map((img, i) => (
                        <div key={i} style={{ flex: 1, overflow: 'hidden', borderRadius: '12px' }}>
                            <img src={img || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600'} alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    ))}
                </div>
                {galleryIndex > 0 && (
                    <button onClick={handlePrev} style={navBtnStyle('left')}>‹</button>
                )}
                {galleryIndex < totalSlides - 1 && (
                    <button onClick={handleNext} style={navBtnStyle('right')}>›</button>
                )}
                {/* Dot indicators */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    {Array.from({ length: totalSlides }).map((_, i) => (
                        <div key={i} onClick={() => setGalleryIndex(i)} style={{
                            flex: i === galleryIndex ? 2 : 1,
                            height: '4px',
                            borderRadius: '2px',
                            background: i === galleryIndex ? '#1a1a2e' : '#d0d0d0',
                            cursor: 'pointer',
                            transition: 'flex 0.3s'
                        }} />
                    ))}
                </div>
            </div>

            {/* Title */}
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '16px', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px' }}>
                    {service.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ color: '#1a1a2e', fontWeight: '600', fontSize: '14px' }}>★ {service.ratingsAverage?.toFixed(2) || '4.50'}</span>
                    <a href="#reviews" style={{ color: '#888', fontSize: '13px', textDecoration: 'underline' }}>({service.ratingsQuantity > 0 ? `${service.ratingsQuantity}` : '6.1M'} reviews)</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: discountPct > 0 ? '4px' : 0 }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>${(service.offerPrice || service.price || 0).toFixed(2)}</span>
                    {discountPct > 0 && (
                        <span style={{ fontSize: '14px', color: '#999', textDecoration: 'line-through' }}>${(service.actualPrice || 0).toFixed(2)}</span>
                    )}
                    <span style={{ color: '#555', fontSize: '14px', display:'none'}}>• {service.duration} hrs</span>
                </div>
                {service.hasVariants && service.variants?.length > 0 && (() => {
                    const cheapest = service.variants.reduce((min, v) => (v.offerPrice || v.price) < (min.offerPrice || min.price) ? v : min, service.variants[0]);
                    const perUnit = cheapest.quantity > 1 ? ((cheapest.offerPrice || cheapest.price) / cheapest.quantity).toFixed(2) : null;
                    return perUnit ? (
                        <div style={{ color: '#000000', fontSize: '14px', fontWeight: '600' }}>♦ ${perUnit} per bathroom</div>
                    ) : null;
                })()}
            </div>

            {/* Select Requirements / Variants — only show if hasVariants true with variants */}
            {service.hasVariants && service.variants?.length > 0 && <Section>
                <h2 style={sectionTitle}>Select requirements</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', color: '#333' }}>Select no. of bathrooms</span>
                    <button onClick={() => setRequirementsOpen(o => !o)} style={plainBtn}>
                        {requirementsOpen ? '∧' : '∨'}
                    </button>
                </div>
                {requirementsOpen && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {service.variants.map(v => {
                            const isSelected = selectedVariant?._id === v._id;
                            const vDiscount = v.discountPercentage || 0;
                            const vOffer = v.offerPrice || v.price;
                            const vActual = v.actualPrice || v.price;
                            const perUnit = v.quantity > 1 ? (vOffer / v.quantity).toFixed(2) : null;
                            return (
                                <div key={v._id} onClick={() => setSelectedVariant(v)}
                                    style={{ ...variantCard, border: isSelected ? '2px solid #000000' : '1.5px solid #ddd', position: 'relative', overflow: 'hidden' }}>
                                    {vDiscount > 0 && (
                                        <div style={{ position: 'absolute', top: 0, right: 0, background: '#fdf5ea', color: '#000000', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderBottomLeftRadius: '8px' }}>
                                            {vDiscount}% OFF
                                        </div>
                                    )}
                                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px', paddingRight: vDiscount > 0 ? '40px' : 0 }}>{v.name}</div>
                                    <div style={{ fontWeight: '800', fontSize: '18px', color: '#1a1a2e' }}>${vOffer.toFixed(2)}</div>
                                    {vDiscount > 0 && (
                                        <div style={{ color: '#999', fontSize: '12px', textDecoration: 'line-through', marginTop: '2px' }}>${vActual.toFixed(2)}</div>
                                    )}
                                    {perUnit && <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>(${perUnit}/bathroom)</div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>}

            {/* Select Add-ons */}
            {service.addons?.length > 0 && (
                <Section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '17px', fontWeight: '600' }}>Select add-ons</span>
                        <button onClick={() => setAddonsOpen(o => !o)} style={plainBtn}>{addonsOpen ? '∨' : '∧'}</button>
                    </div>
                    {addonsOpen && (
                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                            {service.addons.map(addon => {
                                const added = selectedAddons.find(a => a._id === addon._id);
                                return (
                                    <div key={addon._id} style={{ minWidth: '180px', border: '1.5px solid #ddd', borderRadius: '12px', padding: '14px', flexShrink: 0 }}>
                                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '6px' }}>{addon.name} (additional)</div>
                                        <div style={{ color: '#000000', fontWeight: '600', fontSize: '14px', marginBottom: '12px' }}>+ ${(addon.price || 0).toFixed(2)}</div>
                                        <button onClick={() => toggleAddon(addon)}
                                            style={{ width: '100%', padding: '8px', border: '1.5px solid #000000', borderRadius: '8px', background: '#fff', color: '#000000', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                                            {added ? 'Added ✓' : 'Add'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Section>
            )}

            {/* Our Process - exact 1App Company style */}
            {service.processSteps?.length > 0 && (
                <Section>
                    <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '24px', marginTop: 0, color: '#111' }}>Our process</h2>
                    <div style={{ position: 'relative' }}>
                        {/* Vertical connector line running through number circles */}
                        <div style={{
                            position: 'absolute',
                            left: '15px',
                            top: '28px',
                            bottom: '28px',
                            width: '1px',
                            background: '#e0e0e0',
                            zIndex: 0,
                        }} />
                        {service.processSteps.map((step, i) => {
                            const hasImage = step.image && step.image.trim() !== '';
                            return (
                                <div key={step._id} style={{
                                    display: 'flex',
                                    gap: '20px',
                                    marginBottom: i < service.processSteps.length - 1 ? '32px' : '0',
                                    position: 'relative',
                                    zIndex: 1,
                                }}>
                                    {/* Step number circle */}
                                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                                        <div style={{
                                            width: '30px',
                                            height: '30px',
                                            borderRadius: '50%',
                                            background: '#f0f0f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            color: '#333',
                                            zIndex: 1,
                                            position: 'relative',
                                        }}>
                                            {step.stepNumber}
                                        </div>
                                    </div>
                                    {/* Content */}
                                    <div style={{ flex: 1, paddingTop: '4px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '16px', color: '#111', marginBottom: step.description ? '6px' : (hasImage ? '12px' : '0') }}>
                                            {step.title}
                                        </div>
                                        {step.description && (
                                            <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.6', marginBottom: hasImage ? '14px' : '0' }}>
                                                {step.description}
                                            </div>
                                        )}
                                        {hasImage && (
                                            <img
                                                src={resolveImageUrl(step.image)}
                                                alt={step.title}
                                                style={{
                                                    width: '100%',
                                                    height: '220px',
                                                    objectFit: 'cover',
                                                    borderRadius: '14px',
                                                    display: 'block',
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {/* See the difference yourself */}
            {galleryImages.length >= 2 && (
                <Section>
                    <h2 style={sectionTitle}>See the difference yourself</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {galleryImages.map((img, i) => (
                            <div key={i} style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative', height: '160px' }}>
                                <div style={{ display: 'flex', height: '100%' }}>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <img src={img} alt="before" style={{ width: '200%', height: '100%', objectFit: 'cover', filter: 'grayscale(60%) brightness(0.8)' }} />
                                    </div>
                                    <div style={{ width: '1px', background: '#fff', zIndex: 1 }} />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <img src={img} alt="after" style={{ width: '200%', height: '100%', objectFit: 'cover', marginLeft: '-100%' }} />
                                    </div>
                                </div>
                                <span style={beforeAfterBadge('left')}>Before</span>
                                <span style={beforeAfterBadge('right')}>After</span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* Top Professionals */}
            <Section>
                <h2 style={sectionTitle}>Top Professionals</h2>
                <div style={{
                    background: '#fff',
                    border: '1px solid #ebebeb',
                    borderRadius: '16px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'stretch',
                    minHeight: '220px',
                }}>
                    {/* Left: bullet points */}
                    <div style={{ flex: 1, padding: '22px 20px 22px 22px' }}>
                        {[
                            {
                                text: 'Background verified',
                                sub: 'Identity & police check completed',
                                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                            },
                            {
                                text: 'Average 4.8+ ratings',
                                sub: 'Consistently rated by customers',
                                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            },
                            {
                                text: '300+ hours of training',
                                sub: 'Skilled & certified professionals',
                                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                            },
                            {
                                text: 'Verified by 1APP',
                                sub: 'Trusted and quality assured',
                                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                            },
                        ].map((item, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                marginBottom: i < 3 ? '14px' : '0',
                            }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '9px',
                                    background: '#fdf5ea',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {item.icon}
                                </div>
                                <div style={{ paddingTop: '2px' }}>
                                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#1a1a2e' }}>{item.text}</div>
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>{item.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Right: image fills completely, no background color showing */}
                    <div style={{
                        width: '400px',
                        // height:'00px',
                        flexShrink: 0,
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <img
                            src={technicianImage}
                            alt="Top professionals"
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                height: '100%',
                                width: '100%',
                                objectFit: 'cover',
                                objectPosition: 'top center',
                            }}
                        />
                    </div>
                </div>
            </Section>

            {/* Our Cleaning Equipments */}
            {service.tools?.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>Our cleaning equipments</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 12px',background: '#fff',
                    border: '1px solid #ebebeb',
                    borderRadius: '16px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',}}>
                        {service.tools.map(tool => (
                            <div key={tool._id} style={{ textAlign: 'center' }}>
                                <img src={resolveImageUrl(tool.image)} alt={tool.name}
                                    style={{ height: '80px', objectFit: 'contain', borderRadius: '10px', marginBottom: '8px' }} />
                                <div style={{ fontSize: '13px', color: '#555' }}>{tool.name}</div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* What is covered */}
            {service.includedItems?.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>What is covered</h2>
                    {service.includedItems.map(item => (
                        <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ color: '#000000', fontWeight: '700', fontSize: '16px' }}>✓</span>
                            <span style={{ fontSize: '15px', color: '#444' }}>{item.title}</span>
                        </div>
                    ))}
                </Section>
            )}

            {/* What we will need from you */}
            {service.requirements?.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>What we will need from you</h2>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {service.requirements.map(req => (
                            <div key={req._id} style={{ flex: '1 1 120px', background: '#f7f8fa', borderRadius: '10px', padding: '16px 12px', textAlign: 'center', minWidth: '100px' }}>
                                <img src={resolveImageUrl(req.image)} alt={req.title}
                                    style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '8px' }} />
                                <div style={{ fontSize: '13px', color: '#444' }}>{req.title}</div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* What is not covered */}
            {service.excludedItems?.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>What is not covered</h2>
                    {service.excludedItems.map(item => (
                        <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ color: '#e53935', fontWeight: '700', fontSize: '16px' }}>✕</span>
                            <span style={{ fontSize: '15px', color: '#888' }}>{item.title}</span>
                        </div>
                    ))}
                </Section>
            )}

            {/* Damage Protection */}
            <Section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ ...sectionTitle, marginBottom: '4px' }}>Damage protection</h2>
                    <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Up to $5,000 cover if any damage happens<br />during the job</p>
                </div>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: '22px' }}>✓</span>
                </div>
            </Section>

            {/* FAQs */}
            {service.faqs?.length > 0 && (
                <div>
                    <h2 style={sectionTitle}>Frequently asked questions</h2>
                    {service.faqs.map((faq, i) => (
                        <div key={faq._id} style={{ borderBottom: '1px solid #eee'}}>
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '16px 0', fontSize: '15px', color: '#222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: openFaq === i ? '#fdf5ea' : '#f7f8fa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'background 0.2s',
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={openFaq === i ? '#000000' : '#888'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                                        </svg>
                                    </div>
                                    <span style={{ fontWeight: openFaq === i ? '600' : '400', color: openFaq === i ? '#1a1a2e' : '#333', lineHeight: '1.4' }}>{faq.question}</span>
                                </div>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: openFaq === i ? '#000000' : '#f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all 0.2s',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={openFaq === i ? '#fff' : '#888'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </button>
                            {openFaq === i && (
                                <div style={{ display: 'flex', gap: '12px', paddingBottom: '16px', paddingLeft: '44px' }}>
                                    <p style={{ color: '#666', fontSize: '14px', margin: 0, lineHeight: '1.65' }}>{faq.answer}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    <br></br>
                </div>
            )}

            {/* Ratings & Reviews */}
            <Section id="reviews">
                {/* Summary */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '32px', fontWeight: '700' }}>
                        ★ {reviewData?.totalReviews > 0
                            ? (Object.entries(reviewData.starCounts).reduce((sum, [star, cnt]) => sum + Number(star) * cnt, 0) / reviewData.totalReviews).toFixed(2)
                            : service.ratingsAverage?.toFixed(2) || '0.00'}
                    </span>
                </div>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
                    {reviewData?.totalReviews ?? service.ratingsQuantity ?? 0} reviews
                </p>

                {/* Star breakdown bars */}
                {[5, 4, 3, 2, 1].map(star => {
                    const cnt   = reviewData?.starCounts?.[star] ?? 0;
                    const total = reviewData?.totalReviews ?? 0;
                    const pct   = total > 0 ? Math.round((cnt / total) * 100) : 0;
                    return (
                        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', width: '24px' }}>★{star}</span>
                            <div style={{ flex: 1, height: '4px', background: '#e0e0e0', borderRadius: '2px' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: '#1a1a2e', borderRadius: '2px', transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: '13px', color: '#888', width: '30px', textAlign: 'right' }}>{cnt}</span>
                        </div>
                    );
                })}

        

                {/* All Reviews list */}
                <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '16px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700' }}>All reviews</h3>

                    {reviewsLoading && (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading reviews…</div>
                    )}

                    {!reviewsLoading && reviewData?.reviews?.length === 0 && (
                        <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                            No reviews yet. Be the first to share your experience!
                        </p>
                    )}

                    {!reviewsLoading && reviewData?.reviews?.map((r, i) => (
                        <div key={r._id} style={{ paddingBottom: '20px', marginBottom: '20px', borderBottom: i < reviewData.reviews.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: '#1a1a2e', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <span style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>
                                            {(r.user?.name || 'U')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '15px' }}>{r.user?.name || 'User'}</div>
                                        <div style={{ color: '#888', fontSize: '12px', marginTop: '1px' }}>
                                            {new Date(r.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ background: '#1a1a2e', color: '#fff', borderRadius: '6px', padding: '4px 10px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                    ★ {r.rating}
                                </div>
                            </div>
                            {r.review && (
                                <p style={{ color: '#333', fontSize: '14px', lineHeight: '1.65', marginTop: '12px', marginBottom: 0 }}>
                                    {r.review}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Pagination */}
                    {reviewData?.totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                            <button
                                onClick={() => setReviewsPage(p => Math.max(1, p - 1))}
                                disabled={reviewsPage === 1}
                                style={{ padding: '7px 16px', border: '1.5px solid #ddd', borderRadius: '8px', background: '#fff', cursor: reviewsPage === 1 ? 'not-allowed' : 'pointer', color: reviewsPage === 1 ? '#ccc' : '#333', fontWeight: '600' }}
                            >← Prev</button>
                            <span style={{ padding: '7px 12px', fontSize: '14px', color: '#555' }}>{reviewsPage} / {reviewData.totalPages}</span>
                            <button
                                onClick={() => setReviewsPage(p => Math.min(reviewData.totalPages, p + 1))}
                                disabled={reviewsPage === reviewData?.totalPages}
                                style={{ padding: '7px 16px', border: '1.5px solid #ddd', borderRadius: '8px', background: '#fff', cursor: reviewsPage === reviewData?.totalPages ? 'not-allowed' : 'pointer', color: reviewsPage === reviewData?.totalPages ? '#ccc' : '#333', fontWeight: '600' }}
                            >Next →</button>
                        </div>
                    )}
                </div>
            </Section>

            {/* Sticky Add to Cart */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a2e' }}>${getTotalPrice().toFixed(2)}</span>
                        {discountPct > 0 && !selectedVariant && (
                            <span style={{ background: '#fdf5ea', color: '#000000', fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>{discountPct}% OFF</span>
                        )}
                    </div>
                    {discountPct > 0 && !selectedVariant && (
                        <div style={{ fontSize: '12px', color: '#999', textDecoration: 'line-through' }}>${(service.actualPrice || service.price || 0).toFixed(2)}</div>
                    )}
                </div>
                <button onClick={handleAddToCart}
                    style={{ background: '#000000', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 32px', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>
                    Add to cart
                </button>
            </div>
        </div>
    );
};

const Section = ({ children, style = {} }) => (
    <div style={{ borderBottom: '1px solid #eee', paddingBottom: '24px', marginBottom: '24px', ...style }}>
        {children}
    </div>
);

const sectionTitle = { fontSize: '20px', fontWeight: '700', marginBottom: '16px', marginTop: 0 };
const plainBtn = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#555' };
const variantCard = { flex: '1 1 140px', minWidth: '130px', maxWidth: '200px', borderRadius: '12px', padding: '14px', cursor: 'pointer' };

const navBtnStyle = (side) => ({
    position: 'absolute',
    top: '50%',
    [side]: '10px',
    transform: 'translateY(-50%)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.9)',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 2,
});

const beforeAfterBadge = (side) => ({
    position: 'absolute',
    top: '10px',
    [side]: '10px',
    background: 'rgba(50,50,50,0.75)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    padding: '3px 10px',
    borderRadius: '6px',
});

export default ServiceDetail;
