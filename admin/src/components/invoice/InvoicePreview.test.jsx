import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoicePreview from './InvoicePreview';
import adminApi from '../../services/adminApi';
jest.mock('../../services/adminApi', () => ({ getBookingInvoice: jest.fn() }));
const invoice = { bookingId: 'booking-123', invoiceNumber: 'INV-123', invoiceDate: '2026-10-01', scheduledDate: '2026-10-07', status: 'Completed', paymentStatus: 'Paid', customer: { name: 'Anita Desai', email: 'anita@example.com', phone: '9876543210', address: { addressLine: '12 Civil Lines', city: 'Ludhiana' } }, services: [{ name: 'AC Repair', quantity: 2, unitPrice: 100, variantName: 'Split AC', addons: [{ name: 'Cleaning' }] }], totals: { totalAmount: 220 } };
beforeEach(() => { jest.clearAllMocks(); adminApi.getBookingInvoice.mockResolvedValue({ success: true, data: { invoice } }); });
test('admin preview renders customer invoice layout and totals from the authorized endpoint', async () => {
    render(<InvoicePreview bookingId="booking-123" onClose={jest.fn()} />);
    expect(await screen.findByText('AC Repair')).toBeInTheDocument();
    expect(adminApi.getBookingInvoice).toHaveBeenCalledWith('booking-123');
    expect(screen.getByText('SERVICES ORDERED')).toBeInTheDocument();
    expect(screen.getByText('CUSTOMER DETAILS')).toBeInTheDocument();
    expect(screen.getByText('TERMS OF SERVICE')).toBeInTheDocument();
    expect(screen.getByText('Adjustments').parentElement).toHaveTextContent('$20.00');
    expect(screen.getByText('Balance Due').parentElement).toHaveTextContent('$0.00');
    expect(screen.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download Invoice' })).toBeEnabled();
});
test('failed invoice request can be retried', async () => {
    adminApi.getBookingInvoice.mockRejectedValueOnce(new Error('Temporary failure'));
    render(<InvoicePreview bookingId="booking-123" onClose={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load invoice');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('AC Repair');
    await waitFor(() => expect(adminApi.getBookingInvoice).toHaveBeenCalledTimes(2));
});
