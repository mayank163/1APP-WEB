import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiFilter, FiCalendar, FiShield, FiArrowRight } from 'react-icons/fi';
import bookingService from '../services/bookingService';
import BookingCard from '../components/BookingCard';
import { BookingsShimmer } from '../components/Shimmer';
import '../styles/Bookings.css';

const groupOf = booking => {
    const status = (booking.status || '').toLowerCase();
    return status === 'completed' || status === 'cancelled' ? status : 'upcoming';
};
const tabs = [ ['all', 'All Bookings'], ['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled'] ];
const PAGE_SIZE = 9;

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [tab, setTab] = useState('all');
    const [status, setStatus] = useState('all');
    const [dateRange, setDateRange] = useState('all');
    const [search, setSearch] = useState('');
    const loadBookings = () => setRefreshKey(key => key + 1);

    useEffect(() => {
        let active = true;
        const fetchBookings = async () => {
            setLoading(true);
            setError('');
            try {
                let nextPage = 1;
                let totalPages = 1;
                const allBookings = [];
                do {
                    const res = await bookingService.getMyBookings({ page: nextPage, limit: 100 });
                    if (!active) return;
                    if (!res.success) throw new Error(res.message || 'Unable to load bookings.');
                    allBookings.push(...(res.data?.bookings || []));
                    totalPages = res.pagination?.totalPages || 1;
                    nextPage += 1;
                } while (nextPage <= totalPages);
                setBookings(allBookings);
            } catch (err) {
                if (active) setError('Unable to load your bookings. Please try again.');
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchBookings();
        return () => { active = false; };
    }, [refreshKey]);

    useEffect(() => { setPage(1); }, [tab, status, dateRange, search]);

    const counts = { all: bookings.length, upcoming: 0, completed: 0, cancelled: 0 };
    bookings.forEach(booking => { counts[groupOf(booking)] += 1; });
    const filtered = bookings.filter(booking => {
        if (tab !== 'all' && groupOf(booking) !== tab) return false;
        if (status !== 'all' && (booking.status || '').toLowerCase() !== status) return false;
        if (dateRange !== 'all') {
            const date = new Date(booking.serviceDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const end = new Date(today);
            const start = new Date(today);
            if (dateRange === 'next30') end.setDate(end.getDate() + 30);
            else { start.setDate(start.getDate() - 30); end.setDate(end.getDate() + 1); }
            if (Number.isNaN(date.getTime()) || date < start || date >= end) return false;
        }
        const query = search.trim().toLowerCase();
        const address = typeof booking.address === 'string' ? booking.address : Object.values(booking.address || {}).filter(value => typeof value === 'string').join(' ');
        return !query || [booking._id, ...((booking.services || []).map(item => item.service?.name)), address, booking.assignedTechnician?.name].join(' ').toLowerCase().includes(query);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    if (loading) return <BookingsShimmer />;

    return (
        <main className="bookings-page">
            <div className="bookings-content">
                <header className="bookings-header">
                    <div><h1>My Bookings</h1><p>Track and manage all your service bookings in one place.</p></div>
                    <div className="bookings-tabs" aria-label="Filter bookings by category">
                        {tabs.map(([value, label]) => <button key={value} type="button" className={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => { setTab(value); setStatus('all'); }}>
                            {label}<span>{counts[value]}</span>
                        </button>)}
                    </div>
                </header>
                <div className="bookings-toolbar">
                    <div className="bookings-filters">
                        <label className="bookings-select"><FiFilter /><span>Status:</span><select aria-label="Booking status" value={status} onChange={event => setStatus(event.target.value)}>
                            <option value="all">Any</option>
                            {['Pending', 'Confirmed', 'Assigned', 'On the Way', 'In Progress', 'Checkout', 'Completed', 'Cancelled'].map(value => <option value={value.toLowerCase()} key={value}>{value}</option>)}
                        </select></label>
                        <label className="bookings-select"><FiCalendar /><span>Date Range:</span><select aria-label="Booking date range" value={dateRange} onChange={event => setDateRange(event.target.value)}>
                            <option value="all">All time</option><option value="next30">Next 30 days</option><option value="last30">Past 30 days</option>
                        </select></label>
                    </div>
                    <label className="bookings-search"><FiSearch /><input type="search" aria-label="Search bookings" placeholder="Search bookings…" value={search} onChange={event => setSearch(event.target.value)} /></label>
                </div>
                {error ? <div className="bookings-empty" role="alert"><h2>{error}</h2><button className="booking-action-secondary" onClick={loadBookings}>Try again</button></div> : visible.length ? (
                    <div className="bookings-grid">{visible.map(booking => <BookingCard key={booking._id} booking={booking} onCancelled={loadBookings} />)}</div>
                ) : <div className="bookings-empty"><h2>{bookings.length ? 'No matching bookings' : 'No bookings yet'}</h2>
                    <p>{bookings.length ? 'Try a different search or adjust your filters.' : 'Find your next service and manage your bookings here.'}</p>
                    {bookings.length ? <button className="booking-action-secondary" onClick={() => { setTab('all'); setStatus('all'); setDateRange('all'); setSearch(''); }}>Clear filters</button> : <Link to="/services">Explore our services <FiArrowRight /></Link>}
                </div>}
                {!error && totalPages > 1 && <nav className="bookings-pagination" aria-label="Booking pages">
                    <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
                </nav>}
                <aside className="bookings-protection"><span className="bookings-protection-icon"><FiShield /></span>
                    <div><strong>Here to help with every booking</strong><p>Questions about your service? Our support team is ready to help.</p></div>
                    <Link to="/contact">Contact service support <FiArrowRight /></Link>
                </aside>
            </div>
        </main>
    );
};

export default Bookings;
