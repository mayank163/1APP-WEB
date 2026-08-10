import { useState, useRef, useEffect, useCallback } from 'react';
import { FaTag } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import serviceService from '../services/serviceService';

const ServiceSearchAutocomplete = ({ placeholder = "Search services...", wrapperStyle = {} }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    const fetchSuggestions = useCallback(async (value) => {
        if (!value.trim()) {
            setSuggestions([]);
            setOpen(false);
            return;
        }
        setLoading(true);
        try {
            const response = await serviceService.getAllServices({ search: value });
            const services = response.data?.services || response.data || [];
            setSuggestions(Array.isArray(services) ? services : []);
            setOpen(services.length > 0);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
    };

    // Navigate directly to the category/subcategory page for the selected service
    const handleSelect = (service) => {
        setQuery(service.name);
        setOpen(false);
        const categoryId = service.category?._id || service.category;
        const subcategoryId = service.subcategory?._id || service.subcategory;
        if (categoryId && subcategoryId) {
            navigate(`/services?category=${categoryId}&subcategory=${subcategoryId}`);
        } else if (categoryId) {
            navigate(`/services?category=${categoryId}`);
        } else {
            navigate(`/services?search=${encodeURIComponent(service.name)}`);
        }
    };

    // Free-text submit — pass search term; Services.jsx will handle it
    const handleSubmit = (e) => {
        e.preventDefault();
        setOpen(false);
        if (query.trim()) navigate(`/services?search=${encodeURIComponent(query)}`);
    };

    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', ...wrapperStyle }}>
            <form onSubmit={handleSubmit} className="d-flex align-items-center px-3 py-2 rounded-pill border" style={{ background: '#fff', fontSize: '13px', color: '#444', cursor: 'text', gap: 0 }}>
                <input
                    type="text"
                    className="border-0 bg-transparent"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    style={{ outline: 'none', fontSize: '13px', color: '#444', width: query ? `${Math.max(80, query.length * 8)}px` : '150px', minWidth: '80px', maxWidth: '160px', transition: 'width 0.2s', flex: 1 }}
                    autoComplete="off"
                />
                {/* Loader sits flush on the right inside the pill */}
                <span
                    className="flex-shrink-0 d-flex align-items-center"
                    style={{ width: 28, justifyContent: 'center' }}
                >
                    {loading ? (
                        <span
                            style={{
                                display: 'inline-block',
                                width: 14,
                                height: 14,
                                border: '2px solid #e0e0e0',
                                borderTop: '2px solid #888',
                                borderRadius: '50%',
                                animation: 'spin 0.7s linear infinite',
                            }}
                        />
                    ) : (
                        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                            <circle cx="8.5" cy="8.5" r="5.5" stroke="#444" strokeWidth="2" />
                            <path d="M13 13l4 4" stroke="#444" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    )}
                </span>
            </form>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {open && (
                <ul
                    className="list-unstyled mb-0 shadow-sm border rounded-3 bg-white"
                    style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 2000, overflow: 'hidden', maxHeight: '320px', overflowY: 'auto' }}
                >
                    {suggestions.map((service) => (
                        <li
                            key={service._id}
                            onMouseDown={() => handleSelect(service)}
                            className="d-flex align-items-center gap-2 px-3 py-2"
                            style={{ cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8f8f8'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" className="flex-shrink-0" style={{ opacity: 0.35 }}>
                                    <circle cx="8.5" cy="8.5" r="5.5" stroke="#444" strokeWidth="2" />
                                    <path d="M13 13l4 4" stroke="#444" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div className="text-truncate" style={{ fontWeight: 500 }}>{service.name}</div>
                                {(service.category?.name || service.subcategory?.name) && (
                                    <div className="d-flex align-items-center gap-1" style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                                        <FaTag size={9} />
                                        <span className="text-truncate">
                                            {[service.category?.name, service.subcategory?.name].filter(Boolean).join(' › ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ServiceSearchAutocomplete;
