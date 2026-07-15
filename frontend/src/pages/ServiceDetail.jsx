import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import serviceService from '../services/serviceService';
import LoadingSpinner from '../components/LoadingSpinner';
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
        addToCart(cartService, 1);
        selectedAddons.forEach(addon => addToCart({ ...addon, _id: addon._id, price: addon.price }, 1));
        toast.success(`${service.subcategory?.name || service.name} added to cart!`);
    };

    if (loading) return <LoadingSpinner message="Fetching service details..." />;

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
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px 80px' }}>

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
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>${Math.round(service.offerPrice || service.price).toLocaleString('en-US')}</span>
                    {discountPct > 0 && (
                        <span style={{ fontSize: '14px', color: '#999', textDecoration: 'line-through' }}>${Math.round(service.actualPrice).toLocaleString('en-US')}</span>
                    )}
                    <span style={{ color: '#555', fontSize: '14px' }}>• {service.duration} hrs</span>
                </div>
                {service.hasVariants && service.variants?.length > 0 && (() => {
                    const cheapest = service.variants.reduce((min, v) => (v.offerPrice || v.price) < (min.offerPrice || min.price) ? v : min, service.variants[0]);
                    const perUnit = cheapest.quantity > 1 ? Math.round((cheapest.offerPrice || cheapest.price) / cheapest.quantity) : null;
                    return perUnit ? (
                        <div style={{ color: '#2e7d32', fontSize: '14px', fontWeight: '600' }}>♦ ${perUnit} per bathroom</div>
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
                            const perUnit = v.quantity > 1 ? Math.round(vOffer / v.quantity) : null;
                            return (
                                <div key={v._id} onClick={() => setSelectedVariant(v)}
                                    style={{ ...variantCard, border: isSelected ? '2px solid #2e7d32' : '1.5px solid #ddd', position: 'relative', overflow: 'hidden' }}>
                                    {vDiscount > 0 && (
                                        <div style={{ position: 'absolute', top: 0, right: 0, background: '#e8f5e9', color: '#2e7d32', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderBottomLeftRadius: '8px' }}>
                                            {vDiscount}% OFF
                                        </div>
                                    )}
                                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px', paddingRight: vDiscount > 0 ? '40px' : 0 }}>{v.name}</div>
                                    <div style={{ fontWeight: '800', fontSize: '18px', color: '#1a1a2e' }}>${Math.round(vOffer).toLocaleString('en-US')}</div>
                                    {vDiscount > 0 && (
                                        <div style={{ color: '#999', fontSize: '12px', textDecoration: 'line-through', marginTop: '2px' }}>${Math.round(vActual).toLocaleString('en-US')}</div>
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
                                        <div style={{ color: '#2e7d32', fontWeight: '600', fontSize: '14px', marginBottom: '12px' }}>+ ${addon.price}</div>
                                        <button onClick={() => toggleAddon(addon)}
                                            style={{ width: '100%', padding: '8px', border: '1.5px solid #ddd', borderRadius: '8px', background: '#fff', color: added ? '#2e7d32' : '#2e7d32', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                                            {added ? 'Added ✓' : 'Add'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Section>
            )}

            {/* Our Process - gallery images as process cards */}
            {galleryImages.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>Our process</h2>
                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {galleryImages.map((img, i) => (
                            <div key={i} style={{ minWidth: '220px', height: '200px', borderRadius: '12px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: '18px', marginLeft: '3px' }}>▶</span>
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: '12px', left: '12px', color: '#fff', fontWeight: '700', fontSize: '14px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                                    {service.shortDescription?.[i] ? service.shortDescription[i].split(':')[0] : `Step ${i + 1}`}
                                </div>
                            </div>
                        ))}
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

            {/* Top Cleaners */}
            <Section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ ...sectionTitle, fontSize: '26px' }}>Top cleaners</h2>
                    {[
                        {
                            text: 'Trained for 100+ hours',
                            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8 14l-4 7h16l-4-7"/></svg>
                        },
                        {
                            text: 'Average 4.8+ ratings',
                            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        },
                        {
                            text: 'Served 100K+ homes',
                            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
                        },
                        {
                            text: 'Verified by 1APP',
                            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        },
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', fontSize: '15px', color: '#444' }}>
                            {item.icon}
                            <span>{item.text}</span>
                        </div>
                    ))}
                </div>
                <img
                    src={technicianImage}
                    alt="Top cleaners"
                    style={{width: '200px', height: '100%', objectFit: 'contain', objectPosition: 'center', borderRadius: '0', flexShrink: 0 }}
                />
            </Section>

            {/* Our Cleaning Equipments */}
            {service.tools?.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>Our cleaning equipments</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 12px' }}>
                        {service.tools.map(tool => (
                            <div key={tool._id} style={{ textAlign: 'center' }}>
                                <img src={resolveImageUrl(tool.image)} alt={tool.name}
                                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px', marginBottom: '8px' }} />
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
                            <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '16px' }}>✓</span>
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
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: '22px' }}>✓</span>
                </div>
            </Section>

            {/* FAQs */}
            {service.faqs?.length > 0 && (
                <Section>
                    <h2 style={sectionTitle}>Frequently asked questions</h2>
                    {service.faqs.map((faq, i) => (
                        <div key={faq._id} style={{ borderBottom: '1px solid #eee' }}>
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '16px 0', fontSize: '15px', color: '#222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{faq.question}</span>
                                <span style={{ fontSize: '18px', color: '#888' }}>{openFaq === i ? '∧' : '∨'}</span>
                            </button>
                            {openFaq === i && (
                                <p style={{ color: '#666', fontSize: '14px', paddingBottom: '14px', margin: 0, lineHeight: '1.6' }}>{faq.answer}</p>
                            )}
                        </div>
                    ))}
                </Section>
            )}

            {/* Ratings */}
            <Section>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '32px', fontWeight: '700' }}>★ {service.ratingsAverage?.toFixed(2) || '4.50'}</span>
                </div>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>{service.ratingsQuantity || '7.2M'} reviews</p>
                {[
                    { star: 5, pct: 91 }, { star: 4, pct: 12 }, { star: 3, pct: 6 }, { star: 2, pct: 3 }, { star: 1, pct: 5 }
                ].map(r => (
                    <div key={r.star} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', width: '24px' }}>★{r.star}</span>
                        <div style={{ flex: 1, height: '4px', background: '#e0e0e0', borderRadius: '2px' }}>
                            <div style={{ width: `${r.pct}%`, height: '100%', background: '#1a1a2e', borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '13px', color: '#888', width: '40px', textAlign: 'right' }}>{r.star === 5 ? '6.6 M' : r.star === 4 ? '251 K' : r.star === 3 ? '114 K' : r.star === 2 ? '61 K' : '122 K'}</span>
                    </div>
                ))}

                <div style={{ borderTop: '1px solid #eee', marginTop: '20px', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>All reviews</h3>
                        <button style={{ background: 'none', border: 'none', color: '#2e7d32', fontWeight: '700', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.5px' }}>FILTER</button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        {['Most detailed', 'In my area', 'Frequent users'].map(f => (
                            <button key={f} style={{ padding: '8px 16px', border: '1.5px solid #ddd', borderRadius: '20px', background: '#fff', fontSize: '14px', cursor: 'pointer' }}>{f}</button>
                        ))}
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '15px' }}>M P Nair</div>
                                <div style={{ color: '#888', fontSize: '13px' }}>Jun 28, 2026 • For intense bathroom cleaning, ceiling fan new</div>
                            </div>
                            <div style={{ background: '#2e7d32', color: '#fff', borderRadius: '6px', padding: '4px 10px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ★ 5
                            </div>
                        </div>
                        <p style={{ color: '#333', fontSize: '14px', lineHeight: '1.6', marginTop: '10px' }}>
                            Vacant Kumar is a soft spoken sincere professional. He has thorough professional knowledge in cleaning assignments. Reported before appointed time and finished job in given time.
                        </p>
                    </div>
                </div>
            </Section>

            {/* Sticky Add to Cart */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a2e' }}>${Math.round(getTotalPrice()).toLocaleString('en-US')}</span>
                        {discountPct > 0 && !selectedVariant && (
                            <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>{discountPct}% OFF</span>
                        )}
                    </div>
                    {discountPct > 0 && !selectedVariant && (
                        <div style={{ fontSize: '12px', color: '#999', textDecoration: 'line-through' }}>${Math.round(service.actualPrice || service.price).toLocaleString('en-US')}</div>
                    )}
                </div>
                <button onClick={handleAddToCart}
                    style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 32px', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>
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
