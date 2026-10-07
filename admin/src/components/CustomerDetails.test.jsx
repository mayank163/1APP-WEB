import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomerDetails from './CustomerDetails';
import adminApi from '../services/adminApi';
jest.mock('../services/adminApi', () => ({ updateCustomer: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const user = {
    _id: 'customer-1', name: 'Aarav Sharma', phone: '9876543210', email: 'aarav@example.com', accountStatus: 'active', createdAt: '2026-01-05',
    addresses: [{ _id: 'address-1', label: 'Home', addressLine: 'House 24', city: 'Chandigarh', coordinates: { lat: 30.7194, lng: 76.7625 } }],
    bookings: [{ _id: 'BK-1', services: [{ service: { name: 'Plumbing' } }], status: 'In Progress', paymentStatus: 'Pending', totalAmount: 599, serviceDate: '2026-10-07T10:30:00Z', createdAt: '2026-10-06', paymentDetails: { provider: 'stripe', paymentId: 'TXN-1' } }, { _id: 'BK-2', services: [{ service: { name: 'Cleaning' } }], status: 'Completed', paymentStatus: 'Paid', totalAmount: 1899, serviceDate: '2026-09-16', createdAt: '2026-09-14' }],
    reviews: [{ _id: 'review-1', booking: 'BK-2', rating: 5, review: 'Excellent service', service: { name: 'Cleaning' }, createdAt: '2026-09-17' }], planPurchases: []
};
const refresh = jest.fn();
function Page({ initial = 'Bookings' }) {
    const [tab, setTab] = useState(initial);
    return <CustomerDetails user={user} tab={tab} setTab={setTab} onRefresh={refresh} onBack={jest.fn()} onEdit={jest.fn()} onStatus={jest.fn()} onExport={jest.fn()} />;
}
beforeEach(() => { jest.clearAllMocks(); });
test('booking status and dates filter actual bookings and detail buttons open records', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Ongoing' }));
    expect(screen.getByText('BK-1')).toBeInTheDocument();
    expect(screen.queryByText('BK-2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Booking' }));
    expect(screen.getByRole('dialog', { name: 'Booking details' })).toHaveTextContent('Plumbing');
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Bookings from date'), { target: { value: '2026-10-01' } });
    expect(screen.queryByText('BK-2')).not.toBeInTheDocument();
});
test('address cards link to saved coordinates and persist edits', async () => {
    adminApi.updateCustomer.mockResolvedValue({ success: true });
    render(<Page initial="Addresses" />);
    expect(screen.getByRole('link', { name: 'View on Map' })).toHaveAttribute('href', expect.stringContaining('30.7194%2C76.7625'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: 'House 25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Address' }));
    await waitFor(() => expect(adminApi.updateCustomer).toHaveBeenCalledWith('customer-1', { addresses: [expect.objectContaining({ addressLine: 'House 25' })] }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
});
test('review distribution and timeline use submitted review data', () => {
    render(<Page initial="Reviews" />);
    expect(screen.getByText('Excellent service')).toBeInTheDocument();
    expect(screen.getByText('5.0', { selector: 'strong' })).toBeInTheDocument();
    const bars = screen.getAllByRole('progressbar');
    expect(bars[0]).toHaveAttribute('value', '1');
    expect(bars[1]).toHaveAttribute('value', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.getByText('Review submitted — 5★ for Cleaning')).toBeInTheDocument();
});
test('transaction details display only the selected record', () => {
    render(<Page initial="Payments" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View Transaction' })[0]);
    expect(screen.getByRole('dialog', { name: 'Transaction details' })).toHaveTextContent('TXN-1');
    expect(screen.getByRole('dialog')).toHaveTextContent('stripe');
});
