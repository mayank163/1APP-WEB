import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserSupportCenter from './UserSupportCenter';
import API from '../services/supportApi';
jest.mock('../services/supportApi', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock('../services/bookingService', () => ({ getMyBookings: jest.fn().mockResolvedValue({ data: { bookings: [] } }) }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Test User', email: 'test@example.com', phone: '1234567890' } }) }));
let mockInitialParams = {};
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
    useSearchParams: () => { const [params, setParams] = require('react').useState(new URLSearchParams(mockInitialParams)); return [params, next => setParams(new URLSearchParams(next))]; }
}));
const ticket = { _id: 'ticket1', ticketId: 'TK-123', subject: 'Refund not received', category: 'Payment & Billing', description: 'Please check my refund.', status: 'resolved', createdAt: '2026-10-08T10:00:00Z' };
beforeEach(() => {
    jest.clearAllMocks(); mockInitialParams = {};
    Element.prototype.scrollIntoView = jest.fn();
    API.get.mockImplementation(url => Promise.resolve({ data: url === '/support/articles' ? { data: [] } : url.endsWith('/messages') ? { data: [], nextCursor: null } : url === '/support/tickets' ? { data: [], total: 0 } : { data: ticket } }));
    API.patch.mockResolvedValue({ data: {} });
});
test('empty ticket list leads to a validated form and successful submission', async () => {
    API.post.mockResolvedValue({ data: { data: { ...ticket, status: 'open' } } });
    render(<UserSupportCenter />);
    fireEvent.click(screen.getByText('View tickets'));
    expect(await screen.findByText('No support tickets yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Raise a Ticket'));
    fireEvent.change(screen.getByLabelText(/What do you need help with/), { target: { value: 'Account' } });
    fireEvent.change(screen.getByLabelText(/What seems to be the issue/), { target: { value: 'Login issue' } });
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: 'Cannot sign in' } });
    fireEvent.change(screen.getByLabelText(/Describe your issue/), { target: { value: 'My login fails.' } });
    const upload = document.querySelector('input[multiple]');
    const attachments = [new File(['first'], 'first.png', { type: 'image/png' }), new File(['second'], 'second.pdf', { type: 'application/pdf' })];
    fireEvent.change(upload, { target: { files: attachments } });
    fireEvent.click(screen.getByText('Submit Ticket'));
    expect(await screen.findByText('Ticket submitted successfully!')).toBeInTheDocument();
    const [url, body, config] = API.post.mock.calls[0];
    expect(url).toBe('/support/tickets'); expect(body.get('subcategory')).toBe('Login issue'); expect(body.get('description')).toBe('My login fails.');
    expect(body.getAll('files').map(file => file.name)).toEqual(['first.png', 'second.pdf']);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    fireEvent.click(screen.getByText('View Ticket'));
    expect(await screen.findByText('Conversation')).toBeInTheDocument();
});
test('resolved tickets reopen before a user can send another reply', async () => {
    mockInitialParams = { ticket: 'ticket1' };
    render(<UserSupportCenter />);
    expect(await screen.findByText('Was your issue resolved?')).toBeInTheDocument();
    expect(screen.getByLabelText('Send reply')).toBeDisabled();
    fireEvent.click(screen.getByText('Need more help'));
    await waitFor(() => expect(API.patch).toHaveBeenCalledWith('/support/tickets/ticket1', { status: 'open' }));
});
test('open and resolved filters show the matching tickets', async () => {
    API.get.mockImplementation(url => Promise.resolve({ data: url === '/support/tickets' ? { data: [ticket, { ...ticket, _id: 'ticket2', ticketId: 'TK-456', subject: 'Late technician', status: 'in_progress' }], total: 2 } : { data: [] } }));
    mockInitialParams = { view: 'tickets' };
    render(<UserSupportCenter />);
    fireEvent.click(await screen.findByText('Open (1)'));
    expect(screen.getByText('Late technician')).toBeInTheDocument(); expect(screen.queryByText('Refund not received')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Resolved (1)'));
    expect(screen.getByText('Refund not received')).toBeInTheDocument(); expect(screen.queryByText('Late technician')).not.toBeInTheDocument();
});

test('unsupported attachments are rejected before upload', async () => {
    mockInitialParams = { view: 'new' };
    render(<UserSupportCenter />);
    fireEvent.change(document.querySelector('input[multiple]'), { target: { files: [new File(['bad'], 'file.exe', { type: 'application/octet-stream' })] } });
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Choose up to 5');
    expect(API.post).not.toHaveBeenCalled();
});
