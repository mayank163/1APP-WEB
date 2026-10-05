import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Bookings from './Bookings';
import BookingCard from '../components/BookingCard';
import bookingService from '../services/bookingService';

jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }));
jest.mock('../components/Shimmer', () => ({ BookingsShimmer: () => <div>Loading bookings</div> }));
jest.mock('../services/api', () => ({ resolveImageUrl: image => image || null }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../services/bookingService', () => ({
    getMyBookings: jest.fn(), cancelBooking: jest.fn(), downloadInvoice: jest.fn(), getReviewableServices: jest.fn(), submitServiceReview: jest.fn(),
}));

const booking = (id, status, name) => ({
    _id: id, status, totalAmount: 149, serviceDate: '2026-10-04T17:00:00',
    services: [{ service: { name, featuredImage: '/service.jpg' } }],
    address: { addressLine: '123 Park Road', city: 'Panchkula' },
});

beforeEach(() => jest.clearAllMocks());

test('search and tabs include bookings fetched from later API pages', async () => {
    bookingService.getMyBookings
        .mockResolvedValueOnce({ success: true, data: { bookings: [booking('1', 'Pending', 'Plumbing')] }, pagination: { totalPages: 2 } })
        .mockResolvedValueOnce({ success: true, data: { bookings: [booking('2', 'Completed', 'Smoke alarm installation')] }, pagination: { totalPages: 2 } });
    render(<Bookings />);
    expect(await screen.findByRole('heading', { name: 'Plumbing' })).toBeInTheDocument();
    expect(bookingService.getMyBookings).toHaveBeenLastCalledWith({ page: 2, limit: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'Completed 1' }));
    expect(screen.queryByRole('heading', { name: 'Plumbing' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Smoke alarm installation' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not found' } });
    expect(screen.getByText('No matching bookings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('heading', { name: 'Plumbing' })).toBeInTheDocument();
});

test('cancellation still calls the existing API and refreshes the list', async () => {
    bookingService.cancelBooking.mockResolvedValue({ success: true });
    const onCancelled = jest.fn();
    render(<BookingCard booking={booking('pending-booking', 'Pending', 'Plumbing')} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith('pending-booking'));
    expect(bookingService.cancelBooking).toHaveBeenCalledWith('pending-booking');
});

test('completed bookings offer review and invoice actions without cancellation', async () => {
    bookingService.getReviewableServices.mockResolvedValue({ success: true, data: { services: [] } });
    render(<BookingCard booking={booking('completed-booking', 'Completed', 'Smoke alarm')} />);
    expect(screen.getByRole('button', { name: 'Download Invoice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Booking' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rate & Review Service' }));
    expect(await screen.findByText('No services available for review.')).toBeInTheDocument();
    expect(bookingService.getReviewableServices).toHaveBeenCalledWith('completed-booking');
});

test('failed requests show a retry action instead of an empty booking list', async () => {
    bookingService.getMyBookings.mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ success: true, data: { bookings: [] }, pagination: { totalPages: 1 } });
    render(<Bookings />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your bookings');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No bookings yet')).toBeInTheDocument();
});


test('review popup submits the selected rating and comment to the existing service', async () => {
    bookingService.getReviewableServices.mockResolvedValue({ success: true, data: { services: [{ service: { _id: 'alarm-service', name: 'Smoke alarm', featuredImage: '/alarm.jpg' } }] } });
    bookingService.submitServiceReview.mockResolvedValue({ success: true });
    const onReviewed = jest.fn();
    render(<BookingCard booking={booking('completed-booking', 'Completed', 'Smoke alarm')} onCancelled={onReviewed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate & Review Service' }));
    const submit = await screen.findByRole('button', { name: 'Submit Review' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Share your experience/ }), { target: { value: 'Great service' } });
    expect(screen.getByText('13/500')).toBeInTheDocument();
    fireEvent.click(submit);
    await waitFor(() => expect(bookingService.submitServiceReview).toHaveBeenCalledWith('alarm-service', { rating: 4, review: 'Great service', bookingId: 'completed-booking' }));
    await waitFor(() => expect(onReviewed).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
