import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TechnicianProfile from './TechnicianProfile';
import adminApi from '../services/adminApi';
jest.mock('../services/adminApi', () => ({ __esModule: true, default: { getTechnicianFinancials: jest.fn(), saveTechnicianNote: jest.fn() } }));
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('./TechnicianFormModal', () => ({ errorMessage: error => error.message }));
jest.mock('recharts', () => ({ ResponsiveContainer: ({ children }) => <div>{children}</div>, AreaChart: ({ children }) => <div>{children}</div>, BarChart: ({ children }) => <div>{children}</div>, Area: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null }));
const technician = { _id: 'tech1', technicianId: 'TK-1042', name: 'Arun Kumar', email: 'arun@example.com', phone: '+919876543210', primaryService: 'Electrical', serviceArea: 'Chandigarh, India', verificationStatus: 'approved', isOnline: true, totalJobsDone: 2, rating: 4.5, ratingCount: 2, skills: ['Wiring'], createdAt: '2026-10-01T10:00:00Z', documents: [{ documentId: 'id', label: 'Government ID', s3Key: 'id.png', status: 'approved' }, { documentId: 'address', label: 'Address Proof', s3Key: 'proof.pdf', status: 'pending' }], workOrderRatings: [{ job: 'job1', score: 5, ratedAt: '2026-10-08T12:00:00Z' }] };
const jobs = [{ _id: 'job1', title: 'Electrical Repair', category: 'Electrical', assignedTechnician: { _id: 'tech1' }, status: 'completed', scheduledDate: '2026-10-08T10:00:00Z', completedAt: '2026-10-08T12:00:00Z', finalPrice: 120, payment: { status: 'paid', basePrice: 130, paidAt: '2026-10-08T12:00:00Z' }, sourceBooking: { user: { name: 'John Doe' } }, statusHistory: [{ status: 'completed', changedAt: '2026-10-08T12:00:00Z' }] }, { _id: 'job2', title: 'Wiring', assignedTechnician: { _id: 'tech1' }, status: 'assigned', finalPrice: 80 }];
const financial = { technicianId: 'tech1', summary: { totalEarned: 120, thisMonth: 120, totalWithdrawn: 20, pendingWithdrawals: 10, availableBalance: 100, pendingEarnings: 80 }, activity: { points: [{ label: '1', amount: 120 }] }, recentTransactions: [{ id: 'job1', jobId: 'job1', date: '2026-10-08T12:00:00Z', status: 'completed', amount: 120 }], withdrawals: [{ id: 'withdraw1', status: 'pending', amount: 10, method: 'bank-transfer', createdAt: '2026-10-08' }], transactions: { items: [], pagination: { hasNextPage: false } } };
const show = (props = {}) => render(<TechnicianProfile technician={technician} jobs={jobs} canWrite onClose={jest.fn()} onEdit={jest.fn()} onAction={jest.fn()} onAdd={jest.fn()} onInvite={jest.fn()} {...props} />);
beforeEach(() => { jest.clearAllMocks(); adminApi.getTechnicianFinancials.mockResolvedValue({ success: true, data: financial }); });
test('renders shared profile and job filtering with real customer and financial data', async () => {
  show(); await waitFor(() => expect(screen.getByText('$120.00')).toBeTruthy());
  expect(screen.getAllByRole('tab').length).toBe(6);
  fireEvent.click(screen.getByRole('tab', { name: 'Jobs' }));
  expect(screen.getByText('John Doe')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Upcoming (1)' }));
  expect(screen.getByText('Wiring')).toBeTruthy(); expect(screen.queryByText('Electrical Repair')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search jobs...'), { target: { value: 'missing' } });
  expect(screen.getByText('No jobs match these filters.')).toBeTruthy();
});
test('document selection updates preview and activity search filters recorded events', async () => {
  show(); await waitFor(() => expect(adminApi.getTechnicianFinancials).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
  expect(screen.getByRole('img', { name: 'Government ID' })).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'View' })[1]);
  expect(screen.getByText('Open the document to view this file.')).toBeTruthy();
  expect(screen.getByRole('link', { name: /View Full Document/ }).getAttribute('href')).toContain('proof.pdf');
  fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
  fireEvent.change(screen.getByPlaceholderText('Search activity...'), { target: { value: 'Payment credited' } });
  expect(screen.getByText('Payment credited – $120.00')).toBeTruthy(); expect(screen.queryByText('Technician account created')).toBeNull();
});
test('financial tab presents payouts and fetches filtered transaction history', async () => {
  show(); await waitFor(() => expect(screen.getByText('$120.00')).toBeTruthy());
  fireEvent.click(screen.getByRole('tab', { name: 'Earnings & Payouts' }));
  expect(screen.getByText('Pending Payout')).toBeTruthy(); expect(screen.getAllByText('$10.00').length).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: /View All Transactions/ }));
  await waitFor(() => expect(adminApi.getTechnicianFinancials).toHaveBeenLastCalledWith('tech1', { page: 1, limit: 10, status: 'all' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
  await waitFor(() => expect(adminApi.getTechnicianFinancials).toHaveBeenLastCalledWith('tech1', { page: 1, limit: 10, status: 'pending' }));
});
test('read only admin cannot edit profile, invite, or add notes', async () => {
  show({ canWrite: false }); await waitFor(() => expect(screen.getByText('$120.00')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Edit Profile' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Add Technician' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: /Add Note/ }).disabled).toBe(true);
});
test('financial failures show retry and never display fake earnings', async () => {
  adminApi.getTechnicianFinancials.mockRejectedValueOnce(new Error('Financial service unavailable'));
  show(); await waitFor(() => expect(screen.getByText('Unable to load earnings')).toBeTruthy());
  fireEvent.click(screen.getByRole('tab', { name: 'Earnings & Payouts' }));
  expect(screen.getByRole('alert').textContent).toContain('Financial service unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('Total Paid Out')).toBeTruthy());
});

test('quick notes persist through the admin API and report failures without closing editor', async () => {
  adminApi.saveTechnicianNote.mockRejectedValueOnce(new Error('Note save failed')).mockResolvedValueOnce({ data: { note: 'Bring a ladder' } });
  const onNoteSaved = jest.fn(); show({ onNoteSaved });
  await waitFor(() => expect(screen.getByText('$120.00')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Add Note/ }));
  fireEvent.change(screen.getByLabelText('Quick note'), { target: { value: 'Bring a ladder' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Note save failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await waitFor(() => expect(onNoteSaved).toHaveBeenCalledWith('Bring a ladder'));
  expect(adminApi.saveTechnicianNote).toHaveBeenLastCalledWith('tech1', 'Bring a ladder');
});
