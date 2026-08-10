import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaTag, FaCalendarAlt, FaChevronDown } from 'react-icons/fa';
import serviceService from '../services/serviceService';
import { CartContext } from '../context/CartContext';
import { toast } from 'react-toastify';

/* ─────────────────────────────────────────────
   Available time slots
───────────────────────────────────────────── */
const TIME_SLOTS = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
];

/* ─────────────────────────────────────────────
   Portal dropdown — renders at document.body
   so it is never clipped by any ancestor overflow.

   FIX (scroll shimmer / detached dropdown):
   The old version called setState on every single
   scroll event. With two dropdowns mounted at once
   (service search + slot select), that meant two
   independent listeners each forcing a layout read
   (getBoundingClientRect) + a React re-render per
   scroll tick — layout thrashing + out-of-sync
   renders, which is what produced the floating /
   detached dropdown and the "shimmer" while
   scrolling.

   Now:
   - Position updates are throttled to once per
     animation frame via requestAnimationFrame,
     no matter how many scroll events fire.
   - The position is written directly to the DOM
     node's style through a ref, bypassing React
     state/re-render entirely for the hot path.
   - `transform: translate3d` is used instead of
     `top`, so the browser can composite the move on
     the GPU instead of repainting on every frame.
───────────────────────────────────────────── */
const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_GAP = 6;

const PortalDropdown = ({
    anchorRef,
    open,
    children,
    minWidth
}) => {

    const nodeRef = useRef(null);
    const rafRef = useRef(null);

    const applyPosition = useCallback(() => {

        const node = nodeRef.current;
        const anchor = anchorRef.current;
        if (!node || !anchor) return;

        const rect = anchor.getBoundingClientRect();

        // account for any sticky/fixed header covering the anchor
        const stickyHeader = document.querySelector('.sticky-top');
        const headerBottom = stickyHeader
            ? stickyHeader.getBoundingClientRect().bottom
            : 0;

        // hide if the anchor is off-screen OR obscured by the sticky navbar
        const shouldHide =
            rect.bottom <= 0 ||
            rect.top >= window.innerHeight ||
            rect.top < headerBottom;

        if (shouldHide) {
            node.style.display = 'none';
            return;
        }

        const availableHeight =
            window.innerHeight - rect.bottom - DROPDOWN_GAP - 10;

        const width = minWidth || rect.width;
        const maxHeight = Math.max(120, Math.min(DROPDOWN_MAX_HEIGHT, availableHeight));

        node.style.display = 'block';
        node.style.position = 'fixed';
        node.style.top = '0px';
        node.style.left = `${rect.left}px`;
        node.style.width = `${width}px`;
        node.style.maxHeight = `${maxHeight}px`;
        node.style.overflowY = 'auto';
        node.style.zIndex = 9999;
        // GPU-composited move instead of a layout-affecting `top` change
        node.style.transform = `translate3d(0, ${rect.bottom + DROPDOWN_GAP}px, 0)`;
        node.style.willChange = 'transform';

    }, [anchorRef, minWidth]);

    const scheduleUpdate = useCallback(() => {
        if (rafRef.current) return; // an update is already queued for this frame
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            applyPosition();
        });
    }, [applyPosition]);

    useEffect(() => {

        if (!open) return;

        // apply once synchronously so it doesn't flash at (0,0) before first paint
        applyPosition();

        window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
        window.addEventListener('resize', scheduleUpdate, { passive: true });

        return () => {
            window.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('resize', scheduleUpdate);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };

    }, [open, applyPosition, scheduleUpdate]);

    if (!open) return null;

    return ReactDOM.createPortal(
        <div ref={nodeRef} style={{ display: 'none' }}>
            {children}
        </div>,
        document.body
    );

};

/* ─────────────────────────────────────────────
   Thin vertical separator
───────────────────────────────────────────── */
const Sep = () => (
    <div style={{
        width: 1, background: '#e0e0e0',
        alignSelf: 'stretch', margin: '12px 0', flexShrink: 0,
    }} />
);

/* ─────────────────────────────────────────────
   Shared dropdown list styles
───────────────────────────────────────────── */
const dropdownListStyle = {
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
    listStyle: "none",
    margin: 0,
    padding: "6px 0",
    overflowY: "auto",
    width: "100%",
    scrollbarWidth: "thin",
    scrollbarColor: "#d0d0d0 transparent",
    border: "1px solid #f0f0f0"
};

const dropdownItemStyle = {
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: 13,
    borderBottom: '1px solid #f5f5f5',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    transition: 'background 0.12s',
};

const fieldInput = (hasValue = false) => ({
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 14, color: '#1a1a1a', fontWeight: hasValue ? 500 : 400,
    padding: 0, lineHeight: 1, minWidth: 0,
});

/* ─────────────────────────────────────────────
   Service Search autocomplete
───────────────────────────────────────────── */
const InlineServiceSearch = ({ selectedService, onSelect }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);
    const anchorRef = useRef(null);

    const fetchSuggestions = useCallback(async (value) => {
        if (!value.trim()) { setSuggestions([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await serviceService.getAllServices({ search: value });
            const svcs = res.data?.services || res.data || [];
            setSuggestions(Array.isArray(svcs) ? svcs : []);
            setOpen((Array.isArray(svcs) ? svcs : []).length > 0);
        } catch { setSuggestions([]); }
        finally { setLoading(false); }
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (!val) onSelect(null);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 320);
    };

    const handleSelect = (svc) => {
        setQuery(svc.name);
        setOpen(false);
        onSelect(svc);
    };

    useEffect(() => {
        if (selectedService) setQuery(selectedService.name);
    }, [selectedService]);

    /* close on outside click — must check both wrapper and portal */
    useEffect(() => {
        const h = (e) => {
            if (
                wrapperRef.current && !wrapperRef.current.contains(e.target) &&
                !e.target.closest('[data-service-dropdown]')
            ) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    /* close (not just visually hide) once the field scrolls fully out of
       view — avoids leaving a dangling scroll listener + portal mounted
       indefinitely while the user keeps scrolling the page */
    useEffect(() => {
        if (!open) return;
        const checkStillVisible = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) setOpen(false);
        };
        window.addEventListener('scroll', checkStillVisible, { passive: true });
        return () => window.removeEventListener('scroll', checkStillVisible);
    }, [open]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            {/* anchor is the row that the dropdown will align to */}
            <div ref={anchorRef} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaSearch size={13} style={{ color: '#aaa', flexShrink: 0 }} />
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    placeholder="Search service..."
                    autoComplete="off"
                    style={fieldInput(!!selectedService)}
                />
                {loading && (
                    <span style={{ fontSize: 30, color: '#000000', flexShrink: 0, letterSpacing: 2 }}>···</span>
                )}
            </div>

            <PortalDropdown anchorRef={anchorRef} open={open} minWidth={280}>
                <ul data-service-dropdown style={dropdownListStyle}>
                    {suggestions.map((s) => (
                        <li
                            key={s._id}
                            onMouseDown={() => handleSelect(s)}
                            style={{ ...dropdownItemStyle, background: '#fff' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            <FaSearch size={11} style={{ color: '#ccc', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 500, color: '#1a1a1a', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {s.name}
                                </div>
                                {(s.category?.name || s.subcategory?.name) && (
                                    <div style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                        <FaTag size={9} />
                                        {[s.category?.name, s.subcategory?.name].filter(Boolean).join(' › ')}
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </PortalDropdown>
        </div>
    );
};

/* ─────────────────────────────────────────────
   Slot selector — portal dropdown of time slots
───────────────────────────────────────────── */
const SlotSelector = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);
    const anchorRef = useRef(null);

    useEffect(() => {
        const h = (e) => {
            if (
                wrapperRef.current && !wrapperRef.current.contains(e.target) &&
                !e.target.closest('[data-slot-dropdown]')
            ) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    /* same "close once fully scrolled out of view" guard as the search field */
    useEffect(() => {
        if (!open) return;
        const checkStillVisible = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) setOpen(false);
        };
        window.addEventListener('scroll', checkStillVisible, { passive: true });
        return () => window.removeEventListener('scroll', checkStillVisible);
    }, [open]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <button
                ref={anchorRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', border: 'none', background: 'transparent',
                    cursor: 'pointer', padding: 0,
                }}
            >
                <span style={{
                    fontSize: 14,
                    color: value ? '#1a1a1a' : '#a0a0a0',
                    fontWeight: value ? 500 : 400,
                    flex: 1,
                    textAlign: 'left',
                }}>
                    {value || 'Select slot'}
                </span>
                <FaChevronDown
                    size={11}
                    style={{
                        color: '#aaa',
                        flexShrink: 0,
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s',
                    }}
                />
            </button>

            <PortalDropdown anchorRef={anchorRef} open={open} minWidth={160}>
                <ul data-slot-dropdown style={dropdownListStyle}>
                    {TIME_SLOTS.map((t) => (
                        <li
                            key={t}
                            onMouseDown={() => { onChange(t); setOpen(false); }}
                            style={{
                                ...dropdownItemStyle,
                                background: value === t ? '#f5f5f5' : '#fff',
                                fontWeight: value === t ? 700 : 400,
                                color: '#1a1a1a',
                                justifyContent: 'center',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={e => e.currentTarget.style.background = value === t ? '#f5f5f5' : '#fff'}
                        >
                            {t}
                        </li>
                    ))}
                </ul>
            </PortalDropdown>
        </div>
    );
};

/* ─────────────────────────────────────────────
   Main HeroBookingBar
   Layout:  [ 🔍 Search service ] | [ Select slot ▾ ] | [ 📅 Date ] [ Book ]
───────────────────────────────────────────── */
const HeroBookingBar = () => {
    const navigate = useNavigate();
    const { addToCart } = useContext(CartContext);

    const [selectedService, setSelectedService] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const dateInputRef = useRef(null);

    /* formatted date shown inside the date field */
    const formattedDate = bookingDate
        ? new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

    const handleBook = () => {
        const token = localStorage.getItem('1App_token');
        if (!token) {
            toast.warning('Please login to book services');
            navigate('/login');
            return;
        }
        if (!selectedService) { toast.warning('Please select a service first'); return; }
        if (!selectedSlot) { toast.warning('Please select a time slot'); return; }
        if (!bookingDate) { toast.warning('Please select a booking date'); return; }

        const isoDate = new Date(bookingDate + 'T00:00:00').toISOString();
        sessionStorage.setItem('1App_booking_date', isoDate);
        sessionStorage.setItem('1App_booking_slot', selectedSlot);
        addToCart(selectedService, 1);
        navigate('/checkout');
    };

    /* Open native calendar picker when user clicks anywhere in date section */
    const openDatePicker = () => {
        if (dateInputRef.current) {
            try {
                dateInputRef.current.showPicker();
            } catch {
                dateInputRef.current.focus();
                dateInputRef.current.click();
            }
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#fff',
            borderRadius: '30px',
            boxShadow: '0 4px 28px rgba(0,0,0,0.14)',
            height: 60,
            maxWidth: 820,
            width: '100%',
            position: 'relative',
            zIndex: 10,
            border: '1.5px solid #e8e8e8',
            overflow: 'visible',
        }}>

            {/* ── Section 1: Service Search ── */}
            <div style={{
                flex: 1.4,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                height: '100%',
            }}>
                <InlineServiceSearch selectedService={selectedService} onSelect={setSelectedService} />
            </div>

            <Sep />

            {/* ── Section 2: Slot Selector ── */}
            <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                height: '100%',
            }}>
                <SlotSelector value={selectedSlot} onChange={setSelectedSlot} />
            </div>

            <Sep />

            {/* ── Section 3: Date picker ── */}
            {/* Clicking anywhere in this section opens the native calendar */}
            <div
                onClick={openDatePicker}
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 20px',
                    height: '100%',
                    cursor: 'pointer',
                    position: 'relative',
                }}
            >
                <FaCalendarAlt
                    size={13}
                    style={{ color: bookingDate ? '#1a1a1a' : '#aaa', flexShrink: 0, marginRight: 8 }}
                />
                <span style={{
                    fontSize: 14,
                    color: bookingDate ? '#1a1a1a' : '#a0a0a0',
                    fontWeight: bookingDate ? 500 : 400,
                    whiteSpace: 'nowrap',
                    flex: 1,
                    userSelect: 'none',
                }}>
                    {formattedDate || 'dd / mm / yyyy'}
                </span>

                {/* Hidden date input — not overlaid, just used programmatically */}
                <input
                    ref={dateInputRef}
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setBookingDate(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: 'none',
                        border: 'none',
                    }}
                />
            </div>

            {/* ── Book button ── */}
            <button
                onClick={handleBook}
                style={{
                    height: '100%',
                    padding: '0 36px',
                    background: '#1a1a1a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0 30px 30px 0',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    letterSpacing: '0.3px',
                    transition: 'background 0.18s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#333'}
                onMouseLeave={e => e.currentTarget.style.background = '#1a1a1a'}
            >
                Book
            </button>
        </div>
    );
};

export default HeroBookingBar;
