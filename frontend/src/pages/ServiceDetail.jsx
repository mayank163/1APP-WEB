import { cssValue } from '../utils/cssValue';
import '../styles/ServiceDetail.css';
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import serviceService from '../services/serviceService';
import LoadingSpinner from '../components/LoadingSpinner';
import { ServiceDetailShimmer } from '../components/Shimmer';
import { CartContext } from '../context/CartContext';
import { toast } from 'react-toastify';
import { resolveImageUrl } from '../services/api';
import { formatServicePrice, getStartingPrice } from '../utils/servicePrice';
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
        if (selectedVariant) return getStartingPrice(selectedVariant.offerPrice || selectedVariant.actualPrice || selectedVariant.price);
        return getStartingPrice(service?.price ?? (service?.offerPrice || service?.actualPrice));
    };

    const getTotalPrice = () => {
        const addonTotal = selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
        return getPrice() + addonTotal;
    };

    const handleAddToCart = async () => {
        const added = await addToCart(service, 1, selectedVariant, selectedAddons);
        if (!added) {
            toast.info(`${service.subcategory?.name || service.name} is already in your cart!`);
            return;
        }
        toast.success(`${service.subcategory?.name || service.name} added to cart!`);
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
    const discountPct = service.discountPercentage || 0;

    return (
        <div className="ui-servicedetail-1" >

            {/* Gallery Carousel */}
            <div className="ui-servicedetail-2" >
                <div className="ui-servicedetail-3" >
                    {visibleImages.map((img, i) => (
                        <div className="ui-servicedetail-4" key={i} >
                            <img className="ui-servicedetail-5" src={img || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600'} alt=""
                                 />
                        </div>
                    ))}
                </div>
                {galleryIndex > 0 && (
                    <button className="ui-servicedetail-6" onClick={handlePrev} >‹</button>
                )}
                {galleryIndex < totalSlides - 1 && (
                    <button className="ui-servicedetail-7" onClick={handleNext} >›</button>
                )}
                {/* Dot indicators */}
                <div className="ui-servicedetail-8" >
                    {Array.from({ length: totalSlides }).map((_, i) => (
                        <div className="ui-servicedetail-9" key={i} onClick={() => setGalleryIndex(i)} style={{ "--ui-servicedetail-9-flex": cssValue(i === galleryIndex ? 2 : 1, "flex"), "--ui-servicedetail-9-background": cssValue(i === galleryIndex ? "var(--ui-color-59)" : "var(--ui-color-274)", "background") }} />
                    ))}
                </div>
            </div>

            {/* Title */}
            <div className="ui-servicedetail-10" >
                <h1 className="ui-servicedetail-11" >
                    {service.name}
                </h1>
                <div className="ui-servicedetail-12" >
                    <span className="ui-servicedetail-13" >★ {service.ratingsAverage?.toFixed(2) || '4.50'}</span>
                    <a className="ui-servicedetail-14" href="#reviews" >({service.ratingsQuantity > 0 ? `${service.ratingsQuantity}` : '6.1M'} reviews)</a>
                </div>
                <div className="ui-servicedetail-15" style={{ "--ui-servicedetail-15-margin-bottom": cssValue(discountPct > 0 ? "var(--ui-space-14)" : 0, "marginBottom") }}>
                    <span className="ui-servicedetail-16" >${formatServicePrice(service.price ?? (service.offerPrice || service.actualPrice), 2)}</span>
                    {discountPct > 0 && (
                        <span className="ui-servicedetail-17" >${(service.actualPrice || 0).toFixed(2)}</span>
                    )}
                    <span className="ui-servicedetail-18" >• {service.duration} hrs</span>
                </div>
                {service.hasVariants && service.variants?.length > 0 && (() => {
                    const cheapest = service.variants.reduce((min, v) => (v.offerPrice || v.actualPrice || v.price || 0) < (min.offerPrice || min.actualPrice || min.price || 0) ? v : min, service.variants[0]);
                    const perUnit = cheapest.quantity > 1 ? ((cheapest.offerPrice || cheapest.actualPrice || cheapest.price || 0) / cheapest.quantity).toFixed(2) : null;
                    return perUnit ? (
                        <div className="ui-servicedetail-19" >♦ ${perUnit} per bathroom</div>
                    ) : null;
                })()}
            </div>

            {/* Select Requirements / Variants — only show if hasVariants true with variants */}
            {service.hasVariants && service.variants?.length > 0 && <Section>
                <h2 className="ui-servicedetail-20" >Select requirements</h2>
                <div className="ui-servicedetail-21" >
                    <span className="ui-servicedetail-22" >Select no. of bathrooms</span>
                    {/* <button onClick={() => setRequirementsOpen(o => !o)} style={plainBtn}>
                        {requirementsOpen ? '∧' : '∨'}
                    </button> */}
                </div>
                {requirementsOpen && (
                    <div className="ui-servicedetail-23" >
                        {service.variants.map(v => {
                            const isSelected = selectedVariant?._id === v._id;
                            const vDiscount = v.discountPercentage || 0;
                            const vOffer = getStartingPrice(v.offerPrice || v.actualPrice || v.price);
                            const vActual = getStartingPrice(v.actualPrice || v.price);
                            const perUnit = v.quantity > 1 ? (vOffer / v.quantity).toFixed(2) : null;
                            return (
                                <div className="ui-servicedetail-24" key={v._id} onClick={() => setSelectedVariant(v)}
                                    style={{ "--ui-servicedetail-24-border": cssValue(isSelected ? '2px solid #000000' : '1.5px solid #ddd', "border") }}>
                                    {vDiscount > 0 && (
                                        <div className="ui-servicedetail-25" >
                                            {vDiscount}% OFF
                                        </div>
                                    )}
                                    <div className="ui-servicedetail-26" style={{ "--ui-servicedetail-26-padding-right": cssValue(vDiscount > 0 ? "var(--ui-space-79)" : 0, "paddingRight") }}>{v.name}</div>
                                    <div className="ui-servicedetail-27" >${vOffer.toFixed(2)}</div>
                                    {vDiscount > 0 && (
                                        <div className="ui-servicedetail-28" >${vActual.toFixed(2)}</div>
                                    )}
                                    {perUnit && <div className="ui-servicedetail-29" >(${perUnit}/bathroom)</div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>}

            {/* Select Add-ons */}
            {service.addons?.length > 0 && (
                <Section>
                    <div className="ui-servicedetail-30" >
                        <span className="ui-servicedetail-31" >Select add-ons</span>
                        {/* <button onClick={() => setAddonsOpen(o => !o)} style={plainBtn}>{addonsOpen ? '∨' : '∧'}</button> */}
                    </div>
                    {addonsOpen && (
                        <div className="ui-servicedetail-32" >
                            {service.addons.map(addon => {
                                const added = selectedAddons.find(a => a._id === addon._id);
                                return (
                                    <div className="ui-servicedetail-33" key={addon._id} >
                                        <div className="ui-servicedetail-34" >{addon.name} (additional)</div>
                                        <div className="ui-servicedetail-35" >+ ${(addon.price || 0).toFixed(2)}</div>
                                        <button className="ui-servicedetail-36" onClick={() => toggleAddon(addon)}
                                            >
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
                    <h2 className="ui-servicedetail-37" >Our process</h2>
                    <div className="ui-servicedetail-38" >
                        {/* Vertical connector line running through number circles */}
                        <div className="ui-servicedetail-39"  />
                        {service.processSteps.map((step, i) => {
                            const hasImage = step.image && step.image.trim() !== '';
                            return (
                                <div className="ui-servicedetail-40" key={step._id} style={{ "--ui-servicedetail-40-margin-bottom": cssValue(i < service.processSteps.length - 1 ? "var(--ui-space-46)" : "var(--ui-space-16)", "marginBottom") }}>
                                    {/* Step number circle */}
                                    <div className="ui-servicedetail-41" >
                                        <div className="ui-servicedetail-42" >
                                            {step.stepNumber}
                                        </div>
                                    </div>
                                    {/* Content */}
                                    <div className="ui-servicedetail-43" >
                                        <div className="ui-servicedetail-44" style={{ "--ui-servicedetail-44-margin-bottom": cssValue(step.description ? "var(--ui-space-3)" : hasImage ? "var(--ui-space-11)" : "var(--ui-space-16)", "marginBottom") }}>
                                            {step.title}
                                        </div>
                                        {step.description && (
                                            <div className="ui-servicedetail-45" style={{ "--ui-servicedetail-45-margin-bottom": cssValue(hasImage ? "var(--ui-space-13)" : "var(--ui-space-16)", "marginBottom") }}>
                                                {step.description}
                                            </div>
                                        )}
                                        {hasImage && (
                                            <img className="ui-servicedetail-46"
                                                src={resolveImageUrl(step.image)}
                                                alt={step.title}

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
            {/* {galleryImages.length >= 2 && (
                <Section>
                    <h2 className="ui-servicedetail-47" >See the difference yourself</h2>
                    <div className="ui-servicedetail-48" >
                        {galleryImages.map((img, i) => (
                            <div className="ui-servicedetail-49" key={i} >
                                <div className="ui-servicedetail-50" >
                                    <div className="ui-servicedetail-51" >
                                        <img className="ui-servicedetail-52" src={img} alt="before"  />
                                    </div>
                                    <div className="ui-servicedetail-53"  />
                                    <div className="ui-servicedetail-54" >
                                        <img className="ui-servicedetail-55" src={img} alt="after"  />
                                    </div>
                                </div>
                                <span className="ui-servicedetail-56" >Before</span>
                                <span className="ui-servicedetail-57" >After</span>
                            </div>
                        ))}
                    </div>
                </Section>
            )} */}

            {/* Top Professionals */}
            <Section>
                <h2 className="ui-servicedetail-58" >Top Professionals</h2>
                <div className="ui-servicedetail-59" >
                    {/* Left: bullet points */}
                    <div className="ui-servicedetail-60" >
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
                            <div className="ui-servicedetail-61" key={i} style={{ "--ui-servicedetail-61-margin-bottom": cssValue(i < 3 ? "var(--ui-space-13)" : "var(--ui-space-16)", "marginBottom") }}>
                                <div className="ui-servicedetail-62" >
                                    {item.icon}
                                </div>
                                <div className="ui-servicedetail-63" >
                                    <div className="ui-servicedetail-64" >{item.text}</div>
                                    <div className="ui-servicedetail-65" >{item.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Right: image fills completely, no background color showing */}
                    <div className="ui-servicedetail-66" >
                        <img className="ui-servicedetail-67"
                            src={technicianImage}
                            alt="Top professionals"

                        />
                    </div>
                </div>
            </Section>

            {/* Our Cleaning Equipments */}
            {/* {service.tools?.length > 0 && (
                <Section>
                    <h2 className="ui-servicedetail-68" >Our Equipments</h2>
                    <div className="ui-servicedetail-69" >
                        {service.tools.map(tool => (
                            <div className="ui-servicedetail-70" key={tool._id} >
                                <img className="ui-servicedetail-71" src={resolveImageUrl(tool.image)} alt={tool.name}
                                     />
                                <div className="ui-servicedetail-72" >{tool.name}</div>
                            </div>
                        ))}
                    </div>
                </Section>
            )} */}

            {/* What is covered */}
            {service.includedItems?.length > 0 && (
                <Section>
                    <h2 className="ui-servicedetail-73" >What is covered</h2>
                    {service.includedItems.map(item => (
                        <div className="ui-servicedetail-74" key={item._id} >
                            <span className="ui-servicedetail-75" >✓</span>
                            <span className="ui-servicedetail-76" >{item.title}</span>
                        </div>
                    ))}
                </Section>
            )}

            {/* What we will need from you */}
            {service.requirements?.length > 0 && (
                <Section>
                    <h2 className="ui-servicedetail-77" >What we will need from you</h2>
                    <div className="ui-servicedetail-78" >
                        {service.requirements.map(req => (
                            <div className="ui-servicedetail-79" key={req._id} >
                                {/* <img className="ui-servicedetail-80" src={resolveImageUrl(req.image)} alt={req.title}
                                     /> */}
                                <div className="ui-servicedetail-81" >{req.title}</div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* What is not covered */}
            {service.excludedItems?.length > 0 && (
                <Section>
                    <h2 className="ui-servicedetail-82" >What is not covered</h2>
                    {service.excludedItems.map(item => (
                        <div className="ui-servicedetail-83" key={item._id} >
                            <span className="ui-servicedetail-84" >✕</span>
                            <span className="ui-servicedetail-85" >{item.title}</span>
                        </div>
                    ))}
                </Section>
            )}

            {/* Damage Protection */}
            <Section className="ui-servicedetail-86" >
                <div>
                    <h2 className="ui-servicedetail-87" >Damage protection</h2>
                    <p className="ui-servicedetail-88" >Up to $5,000 cover if any damage happens<br />during the job</p>
                </div>
                <div className="ui-servicedetail-89" >
                    <span className="ui-servicedetail-90" >✓</span>
                </div>
            </Section>

            {/* FAQs */}
            {service.faqs?.length > 0 && (
                <div>
                    <h2 className="ui-servicedetail-91" >Frequently asked questions</h2>
                    {service.faqs.map((faq, i) => (
                        <div className="ui-servicedetail-92" key={faq._id} >
                            <button className="ui-servicedetail-93" onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                >
                                <div className="ui-servicedetail-94" >
                                    <div className="ui-servicedetail-95" style={{ "--ui-servicedetail-95-background": cssValue(openFaq === i ? "var(--ui-color-67)" : "var(--ui-color-75)", "background") }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={openFaq === i ? '#000000' : '#888'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                                        </svg>
                                    </div>
                                    <span className="ui-servicedetail-96" style={{ "--ui-servicedetail-96-font-weight": cssValue(openFaq === i ? '600' : '400', "fontWeight"), "--ui-servicedetail-96-color": cssValue(openFaq === i ? "var(--ui-color-59)" : "var(--ui-color-4)", "color") }}>{faq.question}</span>
                                </div>
                                <div className="ui-servicedetail-97" style={{ "--ui-servicedetail-97-background": cssValue(openFaq === i ? "var(--ui-color-27)" : "var(--ui-color-3)", "background") }}>
                                    <svg className="ui-servicedetail-98" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={openFaq === i ? '#fff' : '#888'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ "--ui-servicedetail-98-transform": cssValue(openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', "transform") }}>
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </button>
                            {openFaq === i && (
                                <div className="ui-servicedetail-99" >
                                    <p className="ui-servicedetail-100" >{faq.answer}</p>
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
                <div className="ui-servicedetail-101" >
                    <span className="ui-servicedetail-102" >
                        ★ {reviewData?.totalReviews > 0
                            ? (Object.entries(reviewData.starCounts).reduce((sum, [star, cnt]) => sum + Number(star) * cnt, 0) / reviewData.totalReviews).toFixed(2)
                            : service.ratingsAverage?.toFixed(2) || '0.00'}
                    </span>
                </div>
                <p className="ui-servicedetail-103" >
                    {reviewData?.totalReviews ?? service.ratingsQuantity ?? 0} reviews
                </p>

                {/* Star breakdown bars */}
                {[5, 4, 3, 2, 1].map(star => {
                    const cnt   = reviewData?.starCounts?.[star] ?? 0;
                    const total = reviewData?.totalReviews ?? 0;
                    const pct   = total > 0 ? Math.round((cnt / total) * 100) : 0;
                    return (
                        <div className="ui-servicedetail-104" key={star} >
                            <span className="ui-servicedetail-105" >★{star}</span>
                            <div className="ui-servicedetail-106" >
                                <div className="ui-servicedetail-107" style={{ "--ui-servicedetail-107-width": cssValue(`${pct}%`, "width") }} />
                            </div>
                            <span className="ui-servicedetail-108" >{cnt}</span>
                        </div>
                    );
                })}



                {/* All Reviews list */}
                <div className="ui-servicedetail-109" >
                    <h3 className="ui-servicedetail-110" >All reviews</h3>

                    {reviewsLoading && (
                        <div className="ui-servicedetail-111" >Loading reviews…</div>
                    )}

                    {!reviewsLoading && reviewData?.reviews?.length === 0 && (
                        <p className="ui-servicedetail-112" >
                            No reviews yet. Be the first to share your experience!
                        </p>
                    )}

                    {!reviewsLoading && reviewData?.reviews?.map((r, i) => (
                        <div className="ui-servicedetail-113" key={r._id} style={{ "--ui-servicedetail-113-border-bottom": cssValue(i < reviewData.reviews.length - 1 ? '1px solid #f0f0f0' : 'none', "borderBottom") }}>
                            <div className="ui-servicedetail-114" >
                                <div className="ui-servicedetail-115" >
                                    {/* Avatar */}
                                    <div className="ui-servicedetail-116" >
                                        <span className="ui-servicedetail-117" >
                                            {(r.user?.name || 'U')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="ui-servicedetail-118" >{r.user?.name || 'User'}</div>
                                        <div className="ui-servicedetail-119" >
                                            {new Date(r.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                </div>
                                <div className="ui-servicedetail-120" >
                                    ★ {r.rating}
                                </div>
                            </div>
                            {r.review && (
                                <p className="ui-servicedetail-121" >
                                    {r.review}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Pagination */}
                    {reviewData?.totalPages > 1 && (
                        <div className="ui-servicedetail-122" >
                            <button className="ui-servicedetail-123"
                                onClick={() => setReviewsPage(p => Math.max(1, p - 1))}
                                disabled={reviewsPage === 1}
                                style={{ "--ui-servicedetail-123-cursor": cssValue(reviewsPage === 1 ? 'not-allowed' : 'pointer', "cursor"), "--ui-servicedetail-123-color": cssValue(reviewsPage === 1 ? "var(--ui-color-29)" : "var(--ui-color-4)", "color") }}
                            >← Prev</button>
                            <span className="ui-servicedetail-124" >{reviewsPage} / {reviewData.totalPages}</span>
                            <button className="ui-servicedetail-125"
                                onClick={() => setReviewsPage(p => Math.min(reviewData.totalPages, p + 1))}
                                disabled={reviewsPage === reviewData?.totalPages}
                                style={{ "--ui-servicedetail-125-cursor": cssValue(reviewsPage === reviewData?.totalPages ? 'not-allowed' : 'pointer', "cursor"), "--ui-servicedetail-125-color": cssValue(reviewsPage === reviewData?.totalPages ? "var(--ui-color-29)" : "var(--ui-color-4)", "color") }}
                            >Next →</button>
                        </div>
                    )}
                </div>
            </Section>

            {/* Sticky Add to Cart */}
            <div className="ui-servicedetail-126" >
                <div>
                    <div className="ui-servicedetail-127" >
                        <span className="ui-servicedetail-128" >${getTotalPrice().toFixed(2)}</span>
                        {discountPct > 0 && !selectedVariant && (
                            <span className="ui-servicedetail-129" >{discountPct}% OFF</span>
                        )}
                    </div>
                    {discountPct > 0 && !selectedVariant && (
                        <div className="ui-servicedetail-130" >${getStartingPrice(service.actualPrice || service.price).toFixed(2)}</div>
                    )}
                </div>
                <button className="ui-servicedetail-131" onClick={handleAddToCart}
                    >
                    Add to cart
                </button>
            </div>
        </div>
    );
};

const Section = ({ children, style = {}, className = '' }) => (
    <div className={`ui-servicedetail-132 ${className}`} style={{ ...style }}>
        {children}
    </div>
);









export default ServiceDetail;
