import { cssValue } from '../utils/cssValue';
import '../styles/Services.css';
import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FaStar, FaTag, FaShoppingCart, FaCheckCircle, FaShieldAlt, FaCalendarAlt, FaMedal, FaArrowRight, FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import serviceService from '../services/serviceService';
import { resolveImageUrl } from '../services/api';
import { CartContext } from '../context/CartContext';
import { useSocket } from '../context/SocketContext';
import { ServicesShimmer } from '../components/Shimmer';
import { getStartingPrice } from '../utils/servicePrice';
import { toast } from 'react-toastify';

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

const SERVICES_PER_PAGE = 5;

function ServicePagination({ total, page, onPageChange }) {
    const totalPages = Math.ceil(total / SERVICES_PER_PAGE);
    if (totalPages <= 1) return null;

    const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1)
        .filter(number => number === 1 || number === totalPages || Math.abs(number - page) <= 1);

    return (
        <nav className="ui-services-1" aria-label="Service pages" >
            <small className="ui-services-2" >Showing {(page - 1) * SERVICES_PER_PAGE + 1} to {Math.min(page * SERVICES_PER_PAGE, total)} of {total} services</small>
            <div className="ui-services-3" >
                <button className="ui-services-4" type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPageChange(page - 1)} style={{ "--ui-services-4-cursor": cssValue(page === 1 ? 'default' : 'pointer', "cursor") }}><FaChevronLeft size={11} /></button>
                {visiblePages.map((number, index) => (
                    <React.Fragment key={number}>
                        {index > 0 && number - visiblePages[index - 1] > 1 && <span className="ui-services-5" >…</span>}
                        <button className="ui-services-6" type="button" aria-current={page === number ? 'page' : undefined} onClick={() => onPageChange(number)} style={{ "--ui-services-6-background": cssValue(page === number ? "var(--ui-color-275)" : "var(--ui-color-2)", "background"), "--ui-services-6-color": cssValue(page === number ? "var(--ui-color-2)" : "var(--ui-color-56)", "color") }}>{number}</button>
                    </React.Fragment>
                ))}
                <button className="ui-services-7" type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} style={{ "--ui-services-7-cursor": cssValue(page === totalPages ? 'default' : 'pointer', "cursor") }}><FaChevronRight size={11} /></button>
            </div>
        </nav>
    );
}

function VariantPickerModal({ service, selectedVariantId, onSelect, onClose, onAdd, saving }) {
    if (!service) return null;
    const variants = (service.variants || []).filter(variant => variant.isActive !== false);

    return (
        <div className="ui-services-8" role="presentation" onClick={onClose} >
            <section className="ui-services-9" role="dialog" aria-modal="true" aria-labelledby="variant-picker-title" onClick={event => event.stopPropagation()} >
                <header className="ui-services-10" >
                    <div>
                        <h2 className="ui-services-11" id="variant-picker-title" >Choose an option</h2>
                        <p className="ui-services-12" >{service.name}</p>
                    </div>
                    <button className="ui-services-13" type="button" aria-label="Close variant selection" onClick={onClose} ><FaTimes /></button>
                </header>
                <div className="ui-services-14" >
                    {variants.map(variant => {
                        const selected = String(selectedVariantId) === String(variant._id);
                        const price = getStartingPrice(variant.offerPrice || variant.actualPrice || variant.price);
                        return (
                            <button className="ui-services-15" key={variant._id} type="button" aria-pressed={selected} onClick={() => onSelect(String(variant._id))} style={{ "--ui-services-15-background": cssValue(selected ? "var(--ui-color-276)" : "var(--ui-color-2)", "background"), "--ui-services-15-border": cssValue(`1.5px solid ${selected ? '#315b43' : '#dededb'}`, "border") }}>
                                <span>
                                    <strong className="ui-services-16" >{variant.name}</strong>
                                    {(variant.sizeCapacity || variant.unit) && <small className="ui-services-17" >{[variant.sizeCapacity, variant.unit].filter(Boolean).join(' ')}</small>}
                                </span>
                                <strong className="ui-services-18" >${Number(price).toFixed(2)}</strong>
                            </button>
                        );
                    })}
                    {!variants.length && <p className="ui-services-19" >No active options are available for this service.</p>}
                </div>
                <footer className="ui-services-20" >
                    <button className="ui-services-21" type="button" onClick={onClose} disabled={saving} >Cancel</button>
                    <button className="ui-services-22" type="button" onClick={onAdd} disabled={saving || !selectedVariantId} style={{ "--ui-services-22-cursor": cssValue(saving || !selectedVariantId ? 'not-allowed' : 'pointer', "cursor"), "--ui-services-22-opacity": cssValue(saving || !selectedVariantId ? 0.55 : 1, "opacity") }}>{saving ? 'Adding…' : 'Add to cart'}</button>
                </footer>
            </section>
        </div>
    );
}

export default function Services() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { cartItems, addToCart, updateQuantity } = useContext(CartContext);
    const { socket } = useSocket();

    const categoryId = searchParams.get('category');
    const subcategoryId = searchParams.get('subcategory');
    const searchQuery = searchParams.get('search');

    const [subcategories, setSubcategories] = useState([]);
    const [services, setServices] = useState([]);
    const [variantService, setVariantService] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [addingVariant, setAddingVariant] = useState(false);
    const [servicePage, setServicePage] = useState(1);
    const [categoryPages, setCategoryPages] = useState({});
    const [activeSubId, setActiveSubId] = useState(subcategoryId || null);
    const [categoryName, setCategoryName] = useState('Home Services');
    const [slide, setSlide] = useState(0);
    const [loading, setLoading] = useState(true);

    // All-categories browse mode (no params)
    const [allCategories, setAllCategories] = useState([]);
    const isBrowseAll = !categoryId && !subcategoryId && !searchQuery;

    // Keep activeSubId in sync when URL subcategory param changes (e.g. from search navigation)
    useEffect(() => {
        if (subcategoryId) setActiveSubId(subcategoryId);
    }, [subcategoryId]);

    useEffect(() => { setServicePage(1); }, [categoryId, subcategoryId, searchQuery, activeSubId]);

    // ── Browse-all mode: load categories + all services ──────────────────────
    useEffect(() => {
        if (!isBrowseAll) return;
        setLoading(true);
        Promise.all([
            serviceService.getCategoriesWithSubcategories(),
            serviceService.getAllServices(),
        ]).then(([catRes, svcRes]) => {
            if (catRes.success) setAllCategories(catRes.data.categories || []);
            if (svcRes.success) {
                const svcs = svcRes.data?.services || svcRes.data || [];
                setServices(Array.isArray(svcs) ? svcs : []);
            }
        }).catch(() => {}).finally(() => setLoading(false));
    }, [isBrowseAll]);

    // Handle free-text search: fetch matching services directly
    useEffect(() => {
        if (!searchQuery) return;
        setLoading(true);
        setSubcategories([]);
        setCategoryName(`Results for "${searchQuery}"`);
        serviceService.getAllServices({ search: searchQuery })
            .then(res => {
                const svcs = res.data?.services || res.data || [];
                setServices(Array.isArray(svcs) ? svcs : []);
            })
            .catch(() => setServices([]))
            .finally(() => setLoading(false));
    }, [searchQuery]);

    // Fetch subcategories for the left sidebar
    useEffect(() => {
        if (!categoryId) return;
        setSubcategories([]); // clear stale subcategories while loading
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
        if (searchQuery) return; // handled above
        if (activeSubId) {
            fetchServices(activeSubId);
        } else if (subcategoryId) {
            setActiveSubId(subcategoryId);
        } else if (!isBrowseAll) {
            setLoading(false);
        }
    }, [activeSubId, subcategoryId, searchQuery, fetchServices, isBrowseAll]);

    // Auto-select first subcategory if none selected
    useEffect(() => {
        if (!activeSubId && subcategories.length > 0) {
            setActiveSubId(subcategories[0]._id);
        }
    }, [subcategories, activeSubId]);

    // ── Real-time subcategory updates via Socket.IO ────────────────────────────
    useEffect(() => {
        if (!socket || !categoryId) return;

        const handleSubCreated = ({ subcategory }) => {
            // Only add if it belongs to the currently viewed category
            if (subcategory?.category?._id !== categoryId && subcategory?.category !== categoryId) return;
            setSubcategories(prev => {
                if (prev.some(s => s._id === subcategory._id)) return prev;
                return [...prev, subcategory].sort((a, b) => a.name.localeCompare(b.name));
            });
        };

        const handleSubUpdated = ({ subcategory }) => {
            setSubcategories(prev =>
                prev.map(s => s._id === subcategory._id ? subcategory : s)
                    .filter(s => s.isActive !== false)
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        };

        const handleSubDeleted = ({ subcategoryId }) => {
            setSubcategories(prev => prev.filter(s => s._id !== subcategoryId));
            // If the deleted sub was active, reset to first available
            setActiveSubId(prev => (prev === subcategoryId ? null : prev));
        };

        socket.on('subcategory:created', handleSubCreated);
        socket.on('subcategory:updated', handleSubUpdated);
        socket.on('subcategory:deleted', handleSubDeleted);

        return () => {
            socket.off('subcategory:created', handleSubCreated);
            socket.off('subcategory:updated', handleSubUpdated);
            socket.off('subcategory:deleted', handleSubDeleted);
        };
    }, [socket, categoryId]);

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

    const hasActiveVariants = service => service.hasVariants && service.variants?.some(variant => variant.isActive !== false);
    const handleAddService = async service => {
        if (hasActiveVariants(service)) {
            setVariantService(service);
            setSelectedVariantId('');
            return;
        }
        const added = await addToCart(service, 1);
        if (added) toast.success(`${service.name} added to cart.`);
        else toast.info(`${service.name} is already in your cart.`);
    };
    const handleAddSelectedVariant = async () => {
        const variant = variantService?.variants?.find(item => String(item._id) === String(selectedVariantId) && item.isActive !== false);
        if (!variant) return;
        setAddingVariant(true);
        try {
            const added = await addToCart(variantService, 1, variant);
            if (added) {
                toast.success(`${variantService.name} - ${variant.name} added to cart.`);
                setVariantService(null);
            } else {
                toast.info(`${variantService.name} is already in your cart.`);
            }
        } finally {
            setAddingVariant(false);
        }
    };

    const cartTotal = cartItems.reduce((t, i) => t + i.service.price * i.quantity, 0);
    const activeSubName = subcategories.find(s => s._id === activeSubId)?.name || '';
    const totalServicePages = Math.max(1, Math.ceil(services.length / SERVICES_PER_PAGE));
    const currentServicePage = Math.min(servicePage, totalServicePages);
    const paginatedServices = services.slice((currentServicePage - 1) * SERVICES_PER_PAGE, currentServicePage * SERVICES_PER_PAGE);

    // ── Browse-all mode render ─────────────────────────────────────────────────
    if (isBrowseAll) {
        return (
            <div className="ui-services-23" >
                <VariantPickerModal service={variantService} selectedVariantId={selectedVariantId} onSelect={setSelectedVariantId} onClose={() => setVariantService(null)} onAdd={handleAddSelectedVariant} saving={addingVariant} />
                <div className="ui-services-24" >

                    {/* Hero banner */}
                    <div className="ui-services-25" style={{ "--ui-services-25-background": cssValue(SLIDES[slide].bg, "background") }}>
                        <div className="ui-services-26" >
                            <div className="ui-services-27" >
                                ALL SERVICES
                            </div>
                            <h2 className="ui-services-28" >
                                Everything you need, all in one place.
                            </h2>
                            <p className="ui-services-29" >
                                Trusted professionals across every service category.
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="ui-services-30" >
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i}  className="shimmer ui-services-31" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Categories with their services */}
                            {allCategories.map((cat) => {
                                const catServices = services.filter(s =>
                                    (s.category?._id || s.category?.id || s.category) === (cat._id || cat.id)
                                );
                                if (catServices.length === 0) return null;
                                const categoryKey = String(cat.id || cat._id);
                                const categoryTotalPages = Math.ceil(catServices.length / SERVICES_PER_PAGE);
                                const categoryPage = Math.min(categoryPages[categoryKey] || 1, categoryTotalPages);
                                const pageServices = catServices.slice((categoryPage - 1) * SERVICES_PER_PAGE, categoryPage * SERVICES_PER_PAGE);
                                return (
                                    <div className="ui-services-32" key={cat.id || cat._id} >
                                        {/* Category header */}
                                        <div className="ui-services-33" >
                                            <div className="ui-services-34" >
                                                {cat.image && (
                                                    <img className="ui-services-35"
                                                        src={(() => {
                                                            const img = cat.image;
                                                            if (!img) return null;
                                                            if (img.startsWith('http')) return img;
                                                            return `${UPLOAD_IMAGE_URL}${img.replace(/^\/uploads\//, '').replace(/^\//, '')}`;
                                                        })()}
                                                        alt={cat.name}

                                                        onError={(e) => { e.target.classList.add('ui-image-hidden'); }}
                                                    />
                                                )}
                                                <h3 className="ui-services-36" >{cat.name}</h3>
                                            </div>
                                            <button className="ui-services-37"
                                                onClick={() => navigate(`/services?category=${cat.id || cat._id}`)}

                                            >
                                                See all <FaArrowRight size={11} />
                                            </button>
                                        </div>

                                        {/* Services grid */}
                                        <div className="ui-services-38" >
                                            {pageServices.map(svc => {
                                                const qty = getQty(svc._id);
                                                return (
                                                    <div className="ui-services-39" key={svc._id} >
                                                        <div className="ui-services-40" >
                                                            {svc.featuredImage
                                                                ? <img className="ui-services-41" src={resolveImageUrl(svc.featuredImage)} alt={svc.name}  />
                                                                : <div className="ui-services-42" ><FaTag size={24} color="#ccc" /></div>
                                                            }
                                                        </div>
                                                        <div className="ui-services-43" >
                                                            <div className="ui-services-44" >{svc.name}</div>
                                                            <div className="ui-services-45" >
                                                                <FaStar className="ui-services-46"  />
                                                                <span className="ui-services-47" >{svc.ratingsAverage || 4.8}</span>
                                                            </div>
                                                            <div className="ui-services-48" >
                                                                Starts at ${getStartingPrice(svc.price)}
                                                            </div>
                                                            <div className="ui-services-49" >
                                                                <span className="ui-services-50"
                                                                    onClick={() => navigate(`/service/${svc._id}`)}

                                                                >
                                                                    View details
                                                                </span>
                                                                {qty === 0 || hasActiveVariants(svc) ? (
                                                                    <button className="ui-services-51"
                                                                        onClick={() => handleAddService(svc)}

                                                                    >
                                                                        {hasActiveVariants(svc) ? 'Choose option' : 'Add'}
                                                                    </button>
                                                                ) : (
                                                                    <div className="ui-services-52" >
                                                                        <button className="ui-services-53" onClick={() => updateQuantity(svc._id, qty - 1)} >−</button>
                                                                        <span className="ui-services-54" >{qty}</span>
                                                                        <button className="ui-services-55" onClick={() => updateQuantity(svc._id, qty + 1)} >+</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <ServicePagination total={catServices.length} page={categoryPage} onPageChange={page => setCategoryPages(previous => ({ ...previous, [categoryKey]: page }))} />
                                    </div>
                                );
                            })}

                            {/* Fallback: if categories didn't match, show flat list */}
                            {allCategories.length === 0 && services.length > 0 && (
                                <div>
                                    <h3 className="ui-services-56" >All Services</h3>
                                    <div className="ui-services-57" >
                                        {paginatedServices.map(svc => {
                                            const qty = getQty(svc._id);
                                            return (
                                                <div className="ui-services-58" key={svc._id} >
                                                    <div className="ui-services-59" >
                                                        {svc.featuredImage
                                                            ? <img className="ui-services-60" src={resolveImageUrl(svc.featuredImage)} alt={svc.name}  />
                                                            : <div className="ui-services-61" ><FaTag size={24} color="#ccc" /></div>
                                                        }
                                                    </div>
                                                    <div className="ui-services-62" >
                                                        <div className="ui-services-63" >{svc.name}</div>
                                                        <div className="ui-services-64" >Starts at ${getStartingPrice(svc.price)}</div>
                                                        <div className="ui-services-65" >
                                                            <span className="ui-services-66" onClick={() => navigate(`/service/${svc._id}`)} >View details</span>
                                                            {qty === 0 || hasActiveVariants(svc) ? (
                                                                <button className="ui-services-67" onClick={() => handleAddService(svc)} >{hasActiveVariants(svc) ? 'Choose option' : 'Add'}</button>
                                                            ) : (
                                                                <div className="ui-services-68" >
                                                                    <button className="ui-services-69" onClick={() => updateQuantity(svc._id, qty - 1)} >−</button>
                                                                    <span className="ui-services-70" >{qty}</span>
                                                                    <button className="ui-services-71" onClick={() => updateQuantity(svc._id, qty + 1)} >+</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <ServicePagination total={services.length} page={currentServicePage} onPageChange={setServicePage} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Normal mode (category / subcategory / search) ──────────────────────────
    return (
        <div className="ui-services-72" >
            <VariantPickerModal service={variantService} selectedVariantId={selectedVariantId} onSelect={setSelectedVariantId} onClose={() => setVariantService(null)} onAdd={handleAddSelectedVariant} saving={addingVariant} />
            <div className="ui-services-73" >

                {/* ── LEFT: Category + Subcategories ── */}
                <div className="ui-services-74" >
                    <h2 className="ui-services-75" >{categoryName}</h2>
                    <div className="ui-services-76" >
                        <FaStar className="ui-services-77"  />
                        <span className="ui-services-78" >4.8</span>
                        <span className="ui-services-79" >(12M+ bookings)</span>
                    </div>

                    {/* One-App Cover */}
                    <div className="ui-services-80" >
                        <div className="ui-services-81" >
                            <FaShieldAlt className="ui-services-82"  />
                            <div>
                                <div className="ui-services-83" >One-App Cover</div>
                                <div className="ui-services-84" >Up to 30 days warranty</div>
                            </div>
                        </div>

                    </div>

                    {searchQuery ? (
                        <div className="ui-services-85" >
                            Showing results for<br />
                            <strong className="ui-services-86" >"{searchQuery}"</strong>
                        </div>
                    ) : (
                        <>
                            <div className="ui-services-87" >Select a service</div>
                            <div className="ui-services-88" >
                                {subcategories.map((sub) => {
                                    const isActive = activeSubId === sub._id;
                                    return (
                                        <div className="ui-services-89"
                                            key={sub._id}
                                            onClick={() => handleSubClick(sub)}
                                            style={{ "--ui-services-89-background": cssValue(isActive ? "var(--ui-color-3)" : "var(--ui-color-2)", "background"), "--ui-services-89-border": cssValue(isActive ? '1.5px solid #000' : '1.5px solid #ddd', "border"), "--ui-services-89-box-shadow": cssValue(isActive ? '0 0 0 2px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.12)' : '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)', "boxShadow") }}
                                        >
                                            {/* Icon area */}
                                            <div className="ui-services-90" >
                                                {sub.icon
                                                    ? <img className="ui-services-91"
                                                        src={resolveSubImg(sub.icon)}
                                                        alt={sub.name}

                                                    />
                                                    : <FaTag size={22} color="#222" />
                                                }
                                            </div>
                                            {/* Label — max 2 lines, no mid-word break */}
                                            <div className="ui-services-92" >
                                                {sub.name}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* ── CENTER: Banner + Services ── */}
                <div>
                    {/* Hero Slider */}
                    <div className="ui-services-93" style={{ "--ui-services-93-background": cssValue(SLIDES[slide].bg, "background") }}>
                        <div className="ui-services-94" >
                            <div className="ui-services-95" >
                                {SLIDES[slide].tag}
                            </div>
                            <h2 className="ui-services-96" >{SLIDES[slide].title}</h2>
                            <p className="ui-services-97" >{SLIDES[slide].desc}</p>
                        </div>
                        {/* Dots */}
                        <div className="ui-services-98" >
                            {SLIDES.map((_, i) => (
                                <div className="ui-services-99" key={i} onClick={() => setSlide(i)} style={{ "--ui-services-99-width": cssValue(i === slide ? 24 : 8, "width"), "--ui-services-99-background": cssValue(i === slide ? "var(--ui-color-2)" : "var(--ui-color-277)", "background") }} />
                            ))}
                        </div>
                    </div>

                    {/* Services List */}
                    <div className="ui-services-100" >
                        {searchQuery
                            ? `Search results for "${searchQuery}" (${services.length} found)`
                            : activeSubName ? `Popular ${activeSubName} Services` : 'Popular Home Services'
                        }
                    </div>

                    {loading ? (
                        <div className="ui-services-101" >
                            {Array(3).fill(0).map((_, i) => (
                                <div className="ui-services-102" key={i} >
                                    <div className="shimmer ui-services-103"  />
                                    <div className="ui-services-104" >
                                        <div className="shimmer ui-services-105"  />
                                        <div className="shimmer ui-services-106"  />
                                        <div className="shimmer ui-services-107"  />
                                        <div className="shimmer ui-services-108"  />
                                        <div className="ui-services-109" >
                                            <div className="shimmer ui-services-110"  />
                                            <div className="shimmer ui-services-111"  />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : services.length === 0 ? (
                        <div className="ui-services-112" >No services found.</div>
                    ) : (
                        <div className="ui-services-113" >

                            {paginatedServices.map(svc => {
                                const qty = getQty(svc._id);
                                return (
                                    <div className="ui-services-114" key={svc._id} >
                                        {/* Image */}
                                        <div className="ui-services-115" >
                                            {svc.featuredImage
                                                ? <img className="ui-services-116" src={resolveImageUrl(svc.featuredImage)} alt={svc.name}  />
                                                : <div className="ui-services-117" ><FaTag size={28} color="#ccc" /></div>}
                                        </div>

                                        {/* Info */}
                                        <div className="ui-services-118" >
                                            <div className="ui-services-119" >
                                                <div className="ui-services-120" >{svc.name}</div>
                                                <div className="ui-services-121" >
                                                    <div className="ui-services-122" >Starts at ${getStartingPrice(svc.price)}</div>
                                                    {/* {svc.duration && <div style={{ fontSize: 12, color: '#888' }}>• {svc.duration}</div>} */}
                                                </div>
                                            </div>
                                            <div className="ui-services-123" >
                                                <FaStar className="ui-services-124"  />
                                                <span className="ui-services-125" >{svc.ratingsAverage || 4.8}</span>
                                                {svc.ratingsCount && <span className="ui-services-126" >({(svc.ratingsCount / 1000000).toFixed(1)}M reviews)</span>}
                                            </div>
                                            <p className="ui-services-127" >
                                                {svc.shortDescription ? svc.shortDescription.slice(0, 100) + (svc.description.length > 100 ? '...' : '') : ''}
                                            </p>
                                            <div className="ui-services-128" >
                                                <span className="ui-services-129"
                                                    onClick={() => navigate(`/service/${svc._id}`)}

                                                >
                                                    View details
                                                </span>
                                                {qty === 0 || hasActiveVariants(svc) ? (
                                                    <button className="ui-services-130"
                                                        onClick={() => handleAddService(svc)}

                                                    >
                                                        {hasActiveVariants(svc) ? 'Choose option' : 'Add'}
                                                    </button>
                                                ) : (
                                                    <div className="ui-services-131" >
                                                        <button className="ui-services-132" onClick={() => updateQuantity(svc._id, qty - 1)} >−</button>
                                                        <span className="ui-services-133" >{qty}</span>
                                                        <button className="ui-services-134" onClick={() => updateQuantity(svc._id, qty + 1)} >+</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {!loading && services.length > 0 && <ServicePagination total={services.length} page={currentServicePage} onPageChange={setServicePage} />}
                </div>

                {/* ── RIGHT: Promise + Cart ── */}
                <div className="ui-services-135" >
                    {/* One-App Promise */}
                    <div className="ui-services-136" >
                        <div className="ui-services-137" >
                            <FaMedal className="ui-services-138"  />
                            <span className="ui-services-139" >One-App Promise</span>
                        </div>
                        {[
                            'Verified Professionals',
                            'Transparent Pricing',
                            'Easy Booking & Rescheduling',
                            'Quality Guaranteed',
                        ].map((item) => (
                            <div className="ui-services-140" key={item} >
                                <FaCheckCircle className="ui-services-141"  />
                                <span className="ui-services-142" >{item}</span>
                            </div>
                        ))}
                    </div>

                    {/* Cart */}
                    <div className="ui-services-143" >
                        <div className="ui-services-144" >Cart</div>

                        {cartItems.length === 0 ? (
                            <div className="ui-services-145" >
                                <div className="ui-services-146" >
                                    <FaShoppingCart size={28} color="#aaa" />
                                </div>
                                <div className="ui-services-147" >No items in your cart</div>
                                <div className="ui-services-148" >Add services to see them here.</div>
                            </div>
                        ) : (
                            <>
                                {cartItems.map(({ service: svc, quantity, selectedAddons }) => (
                                    <div className="ui-services-149" key={svc._id} >
                                        <div className="ui-services-150" >
                                            <span className="ui-services-151" >{svc.subcategory?.name || svc.name}{selectedAddons?.length > 0 && <small className="ui-services-152" >Add-ons: {selectedAddons.map(addon => addon.name).join(', ')}</small>}</span>
                                            <div className="ui-services-153" >
                                                <button className="ui-services-154" onClick={() => updateQuantity(svc._id, quantity - 1)} >−</button>
                                                <span className="ui-services-155" >{quantity}</span>
                                                <button className="ui-services-156" onClick={() => updateQuantity(svc._id, quantity + 1)} >+</button>
                                            </div>
                                        </div>
                                        {/* <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>${svc.price * quantity}</div> */}
                                    </div>
                                ))}
                                <button className="ui-services-157"
                                    onClick={() => navigate('/cart')}

                                >
                                    <span>${cartTotal.toLocaleString()}</span>
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
