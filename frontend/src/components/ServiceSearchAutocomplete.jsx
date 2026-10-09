import { cssValue } from '../utils/cssValue';
import '../styles/ServiceSearchAutocomplete.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FaTag } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import serviceService from '../services/serviceService';

const ServiceSearchAutocomplete = ({ placeholder = "Search services...", wrapperClassName = '' }) => {
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
        <div className={`ui-servicesearchautocomplete-1 ${wrapperClassName}`} ref={wrapperRef} >
            <form onSubmit={handleSubmit} className="d-flex align-items-center px-3 py-2 rounded-pill border ui-servicesearchautocomplete-2" >
                <input
                    type="text"
                    className="border-0 bg-transparent ui-servicesearchautocomplete-3"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    style={{ "--ui-servicesearchautocomplete-3-width": cssValue(query ? `${Math.max(80, query.length * 8)}px` : '150px', "width") }}
                    autoComplete="off"
                />
                {/* Loader sits flush on the right inside the pill */}
                <span
                    className="flex-shrink-0 d-flex align-items-center ui-servicesearchautocomplete-4"

                >
                    {loading ? (
                        <span className="ui-servicesearchautocomplete-5"

                        />
                    ) : (
                        <svg className="ui-servicesearchautocomplete-6" width="13" height="13" viewBox="0 0 20 20" fill="none" >
                            <circle cx="8.5" cy="8.5" r="5.5" stroke="#444" strokeWidth="2" />
                            <path d="M13 13l4 4" stroke="#444" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    )}
                </span>
            </form>


            {open && (
                <ul
                    className="list-unstyled mb-0 shadow-sm border rounded-3 bg-white ui-servicesearchautocomplete-7"

                >
                    {suggestions.map((service) => (
                        <li
                            key={service._id}
                            onMouseDown={() => handleSelect(service)}
                            className="d-flex align-items-center gap-2 px-3 py-2 ui-servicesearchautocomplete-8"



                        >
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 ui-servicesearchautocomplete-9" >
                                    <circle cx="8.5" cy="8.5" r="5.5" stroke="#444" strokeWidth="2" />
                                    <path d="M13 13l4 4" stroke="#444" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            <div className="ui-servicesearchautocomplete-10" >
                                <div className="text-truncate ui-servicesearchautocomplete-11" >{service.name}</div>
                                {(service.category?.name || service.subcategory?.name) && (
                                    <div className="d-flex align-items-center gap-1 ui-servicesearchautocomplete-12" >
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
