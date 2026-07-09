import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import bookingService from '../services/bookingService';
import BookingCard from '../components/BookingCard';

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadBookings = () => {
        setLoading(true);
        bookingService.getMyBookings()
            .then(res => { if (res.success) setBookings(res.data.bookings); })
            .catch(err => console.error('Failed to fetch bookings', err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadBookings();
    }, []);

    if (loading) return null;

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
            <div style={{ ...styles.grid, ...(bookings.length === 1 ? styles.singleCardGrid : bookings.length === 2 ? { gridTemplateColumns: 'repeat(2, minmax(0, 360px))' } : {}) }}>
                {bookings.map(booking => (
                    <div key={booking._id} style={styles.cardWrap}>
                        <BookingCard booking={booking} onCancelled={loadBookings} />
                    </div>
                ))}
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
        color: '#2e7d32',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
    },
    wrapper: {
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 20px 40px',
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
};

export default Bookings;
