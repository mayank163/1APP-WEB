import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const SearchAutocomplete = ({ placeholder = "Search locations...", inputStyle = {}, wrapperStyle = {} }) => {
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
        <div ref={wrapperRef} style={{ position: 'relative', ...wrapperStyle }}>
            <form onSubmit={handleSubmit} className="d-flex align-items-center border rounded-pill px-3 py-2" style={{ background: '#fff', gap: 6 }}>
                <FaMapMarkerAlt size={13} className="flex-shrink-0" style={{ color: selected ? '#f97316' : '#aaa' }} />
                <input
                    ref={inputRef}
                    type="text"
                    className="border-0 bg-transparent"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    style={{
                        outline: 'none',
                        fontSize: '13px',
                        color: '#444',
                        flex: 1,
                        minWidth: '120px',
                        maxWidth: '220px',
                        width: query ? `${Math.max(120, query.length * 7)}px` : '160px',
                        transition: 'width 0.2s',
                        ...inputStyle
                    }}
                    autoComplete="off"
                />
                {/* Right slot: spinner → clear → empty */}
                <span className="flex-shrink-0 d-flex align-items-center" style={{ width: 18, justifyContent: 'center' }}>
                    {loading ? (
                        <span style={{
                            display: 'inline-block', width: 13, height: 13,
                            border: '2px solid #e0e0e0', borderTop: '2px solid #888',
                            borderRadius: '50%', animation: 'loc-spin 0.7s linear infinite'
                        }} />
                    ) : selected || query ? (
                        <button
                            type="button"
                            onMouseDown={handleClear}
                            style={{
                                background: '#e0e0e0', border: 'none', borderRadius: '50%',
                                width: 16, height: 16, padding: 0, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                lineHeight: 1, flexShrink: 0
                            }}
                            aria-label="Clear"
                        >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M1 1l8 8M9 1L1 9" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </button>
                    ) : null}
                </span>
            </form>
            <style>{`@keyframes loc-spin { to { transform: rotate(360deg); } }`}</style>

            {open && (
                <ul
                    className="list-unstyled mb-0 shadow-sm border rounded-3 bg-white"
                    style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 2000, overflow: 'hidden' }}
                >
                    {suggestions.map((item) => (
                        <li
                            key={item.place_id}
                            onMouseDown={() => handleSelect(item)}
                            className="d-flex align-items-start gap-2 px-3 py-2"
                            style={{ cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8f8f8'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            <FaMapMarkerAlt size={13} className="text-muted flex-shrink-0 mt-1" />
                            <span className="text-truncate" style={{ maxWidth: '100%' }}>{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SearchAutocomplete;
