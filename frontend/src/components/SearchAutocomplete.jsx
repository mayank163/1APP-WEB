import { cssValue } from '../utils/cssValue';
import '../styles/SearchAutocomplete.css';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const SearchAutocomplete = ({ placeholder = "Search locations...", inputClassName = '', wrapperClassName = '' }) => {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    const fetchSuggestions = useCallback(async (value) => {
        if (!value.trim()) { setSuggestions([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            setSuggestions(data);
            setOpen(data.length > 0);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        setSelected(false);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
    };

    const handleSelect = (item) => {
        setQuery(item.display_name);
        setSelected(true);
        setOpen(false);
        navigate(`/services?search=${encodeURIComponent(item.display_name)}`);
    };

    const handleClear = () => {
        setQuery('');
        setSelected(false);
        setSuggestions([]);
        setOpen(false);
        inputRef.current?.focus();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setOpen(false);
        if (query.trim()) navigate(`/services?search=${encodeURIComponent(query)}`);
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className={`ui-searchautocomplete-1 ${wrapperClassName}`} ref={wrapperRef} >
            <form onSubmit={handleSubmit} className="d-flex align-items-center border rounded-pill px-3 py-2 ui-searchautocomplete-2" >
                <FaMapMarkerAlt size={13} className="flex-shrink-0 ui-searchautocomplete-3" style={{ "--ui-searchautocomplete-3-color": cssValue(selected ? "var(--ui-color-271)" : "var(--ui-color-19)", "color") }} />
                <input
                    ref={inputRef}
                    type="text"
                    className="border-0 bg-transparent ui-searchautocomplete-4"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    style={{ "--ui-searchautocomplete-4-width": cssValue(query ? `${Math.max(120, query.length * 7)}px` : '160px', "width") }}
                    autoComplete="off"
                />
                {/* Right slot: spinner → clear → empty */}
                <span className="flex-shrink-0 d-flex align-items-center ui-searchautocomplete-5" >
                    {loading ? (
                        <span className="ui-searchautocomplete-6"  />
                    ) : selected || query ? (
                        <button className="ui-searchautocomplete-7"
                            type="button"
                            onMouseDown={handleClear}

                            aria-label="Clear"
                        >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M1 1l8 8M9 1L1 9" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </button>
                    ) : null}
                </span>
            </form>


            {open && (
                <ul
                    className="list-unstyled mb-0 shadow-sm border rounded-3 bg-white ui-searchautocomplete-8"

                >
                    {suggestions.map((item) => (
                        <li
                            key={item.place_id}
                            onMouseDown={() => handleSelect(item)}
                            className="d-flex align-items-start gap-2 px-3 py-2 ui-searchautocomplete-9"



                        >
                            <FaMapMarkerAlt size={13} className="text-muted flex-shrink-0 mt-1" />
                            <span className="text-truncate ui-searchautocomplete-10" >{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SearchAutocomplete;
