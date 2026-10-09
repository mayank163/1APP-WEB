import { cssValue } from '../utils/cssValue';
import '../styles/HeroBookingBar.css';
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaTag, FaChevronDown } from 'react-icons/fa';
import serviceService from '../services/serviceService';
import { CartContext } from '../context/CartContext';
import { toast } from 'react-toastify';

const BOOKING_PERIODS = [
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
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
            node.classList.add('hero-dropdown-hidden');
            return;
        }

        const availableHeight =
            window.innerHeight - rect.bottom - DROPDOWN_GAP - 10;

        const width = minWidth || rect.width;
        const maxHeight = Math.max(120, Math.min(DROPDOWN_MAX_HEIGHT, availableHeight));

        node.classList.remove('hero-dropdown-hidden');
        node.classList.add('hero-positioned-dropdown');
        node.style.setProperty('--hero-dropdown-left', `${rect.left}px`);
        node.style.setProperty('--hero-dropdown-width', `${width}px`);
        node.style.setProperty('--hero-dropdown-max-height', `${maxHeight}px`);
        // GPU-composited move instead of a layout-affecting `top` change
        node.style.setProperty('--hero-dropdown-transform', `translate3d(0, ${rect.bottom + DROPDOWN_GAP}px, 0)`);

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
        <div className="ui-herobookingbar-1" ref={nodeRef} >
            {children}
        </div>,
        document.body
    );

};

/* ─────────────────────────────────────────────
   Thin vertical separator
───────────────────────────────────────────── */
const Sep = () => (
    <div className="ui-herobookingbar-2"  />
);

/* ─────────────────────────────────────────────
   Shared dropdown list styles
───────────────────────────────────────────── */






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
        <div className="ui-herobookingbar-3" ref={wrapperRef} >
            {/* anchor is the row that the dropdown will align to */}
            <div className="ui-herobookingbar-4" ref={anchorRef} >
                <FaSearch className="ui-herobookingbar-5" size={13}  />
                <input className="ui-herobookingbar-6"
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    placeholder="Search service..."
                    autoComplete="off"
                    style={{ "--ui-herobookingbar-6-font-weight": cssValue(!!selectedService ? 500 : 400, "fontWeight") }}
                />
                {loading && (
                    <span className="ui-herobookingbar-7" >···</span>
                )}
            </div>

            <PortalDropdown anchorRef={anchorRef} open={open} minWidth={280}>
                <ul className="ui-herobookingbar-8" data-service-dropdown >
                    {suggestions.map((s) => (
                        <li className="ui-herobookingbar-9"
                            key={s._id}
                            onMouseDown={() => handleSelect(s)}



                        >
                            <FaSearch className="ui-herobookingbar-10" size={11}  />
                            <div className="ui-herobookingbar-11" >
                                <div className="ui-herobookingbar-12" >
                                    {s.name}
                                </div>
                                {(s.category?.name || s.subcategory?.name) && (
                                    <div className="ui-herobookingbar-13" >
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

const BookingPeriodSelector = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);
    const anchorRef = useRef(null);

    useEffect(() => {
        const h = (e) => {
            if (
                wrapperRef.current && !wrapperRef.current.contains(e.target) &&
                !e.target.closest('[data-booking-period-dropdown]')
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
        <div className="ui-herobookingbar-14" ref={wrapperRef} >
            <button className="ui-herobookingbar-15"
                ref={anchorRef}
                type="button"
                onClick={() => setOpen(v => !v)}

            >
                <span className="ui-herobookingbar-16" style={{ "--ui-herobookingbar-16-color": cssValue(value ? "var(--ui-color-7)" : "var(--ui-color-270)", "color"), "--ui-herobookingbar-16-font-weight": cssValue(value ? 500 : 400, "fontWeight") }}>
                    {BOOKING_PERIODS.find(period => period.value === value)?.label || 'Select period'}
                </span>
                <FaChevronDown className="ui-herobookingbar-17"
                    size={11}
                    style={{ "--ui-herobookingbar-17-transform": cssValue(open ? 'rotate(180deg)' : 'rotate(0deg)', "transform") }}
                />
            </button>

            <PortalDropdown anchorRef={anchorRef} open={open} minWidth={160}>
                <ul className="ui-herobookingbar-18" data-booking-period-dropdown >
                    {BOOKING_PERIODS.map((period) => (
                        <li className="ui-herobookingbar-19"
                            key={period.value}
                            onMouseDown={() => { onChange(period.value); setOpen(false); }}
                            style={{ "--ui-herobookingbar-19-background": cssValue(value === period.value ? "var(--ui-color-35)" : "var(--ui-color-2)", "background"), "--ui-herobookingbar-19-font-weight": cssValue(value === period.value ? 700 : 400, "fontWeight") }}


                        >
                            {period.label}
                        </li>
                    ))}
                </ul>
            </PortalDropdown>
        </div>
    );
};

/* ─────────────────────────────────────────────
   Main HeroBookingBar
    Layout:  [ Search service ] | [ Select period ] [ Book ]
───────────────────────────────────────────── */
const HeroBookingBar = () => {
    const navigate = useNavigate();
    const { addToCart } = useContext(CartContext);

    const [selectedService, setSelectedService] = useState(null);
    const [bookingPeriod, setBookingPeriod] = useState('');

    const handleBook = () => {
        const token = localStorage.getItem('1App_token');
        if (!token) {
            toast.warning('Please login to book services');
            navigate('/login');
            return;
        }
        if (!selectedService) { toast.warning('Please select a service first'); return; }
        if (!bookingPeriod) { toast.warning('Please select when you need the service'); return; }

        const bookingDate = new Date();
        if (bookingPeriod === 'tomorrow') bookingDate.setDate(bookingDate.getDate() + 1);
        if (bookingPeriod === 'week') bookingDate.setDate(bookingDate.getDate() + (7 - bookingDate.getDay() || 7));
        if (bookingPeriod === 'month') bookingDate.setMonth(bookingDate.getMonth() + 1, 1);
        sessionStorage.setItem('1App_booking_date', bookingDate.toISOString());
        sessionStorage.setItem('1App_booking_period', bookingPeriod);
        addToCart(selectedService, 1);
        navigate('/cart');
    };

    return (
        <div className="ui-herobookingbar-20" >

            {/* ── Section 1: Service Search ── */}
            <div className="ui-herobookingbar-21" >
                <InlineServiceSearch selectedService={selectedService} onSelect={setSelectedService} />
            </div>

            <Sep />

            {/* ── Section 2: Booking period ── */}
            <div className="ui-herobookingbar-22" >
                <BookingPeriodSelector value={bookingPeriod} onChange={setBookingPeriod} />
            </div>

            {/* ── Book button ── */}
            <button className="ui-herobookingbar-23"
                onClick={handleBook}



            >
                Book
            </button>
        </div>
    );
};

export default HeroBookingBar;
