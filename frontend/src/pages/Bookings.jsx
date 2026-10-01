import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import bookingService from '../services/bookingService';
import BookingCard from '../components/BookingCard';
import { BookingsShimmer } from '../components/Shimmer';

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [pagination, setPagination] = useState(null);

    const loadBookings = () => setRefreshKey(key => key + 1);

    useEffect(() => {
        let active = true;
        setLoading(true);
        bookingService.getMyBookings({ page, limit: 10 })
            .then(res => {
                if (!active || !res.success) return;
                if (page > res.pagination.totalPages) {
                    setPage(res.pagination.totalPages);
                    return;
                }
                setBookings(res.data.bookings);
                setPagination(res.pagination);
            })
            .catch(err => console.error('Failed to fetch bookings', err))
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [page, refreshKey]);

    if (loading) return <BookingsShimmer />;

    if (bookings.length === 0) {
        return (
            <div style={styles.emptyContainer}>
                <h2 style={styles.emptyTitle}>No bookings yet.</h2>
                <p style={styles.emptySubtitle}>
                    Looks like you haven't experienced quality services at home.
                </p>
                <Link to="/services" style={styles.exploreLink}>
                    Explore our services →
                </Link>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            <div style={styles.content}>
                <div style={{ ...styles.grid, ...(bookings.length === 1 ? styles.singleCardGrid : bookings.length === 2 ? { gridTemplateColumns: 'repeat(2, minmax(0, 360px))' } : {}) }}>
                    {bookings.map(booking => (
                        <div key={booking._id} style={styles.cardWrap}>
                            <BookingCard booking={booking} onCancelled={loadBookings} />
                        </div>
                    ))}
                </div>
                {pagination?.totalPages > 1 && (
                    <div style={styles.pagination}>
                        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} style={styles.pageButton}>
                            Previous
                        </button>
                        <span style={styles.pageLabel}>{page} / {pagination.totalPages}</span>
                        <button type="button" onClick={() => setPage(current => Math.min(pagination.totalPages, current + 1))} disabled={page === pagination.totalPages} style={styles.pageButton}>
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    emptyContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 20px',
    },
    emptyTitle: {
        fontSize: 26,
        fontWeight: 800,
        color: '#111',
        marginBottom: 12,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#888',
        maxWidth: 320,
        lineHeight: 1.6,
        marginBottom: 20,
    },
    exploreLink: {
        color: '#000000',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
    },
    wrapper: {
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 20px 40px',
    },
    content: {
        width: '100%',
        maxWidth: 1140,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 360px))',
        gap: 20,
        width: '100%',
        maxWidth: 1140,
    },
    singleCardGrid: {
        gridTemplateColumns: 'minmax(0, 360px)',
    },
    cardWrap: {},
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginTop: 24,
    },
    pageButton: {
        padding: '7px 16px',
        border: '1px solid #ddd',
        borderRadius: 6,
        background: '#fff',
        cursor: 'pointer',
    },
    pageLabel: {
        color: '#555',
        fontSize: 14,
    },
};

export default Bookings;
