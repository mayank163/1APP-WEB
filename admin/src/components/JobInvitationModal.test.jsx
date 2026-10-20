import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import JobInvitationModal from './JobInvitationModal';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
jest.mock('../services/socket', () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }));

jest.mock('../services/adminApi', () => ({ __esModule: true, default: {
  getJobRoutingCandidates: jest.fn(), getTechnicianRequests: jest.fn(), sendJobInvitation: jest.fn(),
} }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn() } }));
jest.mock('../utils/helpers', () => ({ getImageUrl: value => value }));
const technicians = [
  { _id: 'a', name: 'Harry', accountStatus: 'active', primaryService: 'Audio', distanceKm: 4, rating: 4.8, ratingCount: 2, completedJobCount: 10, matchingJobCount: 5, isOnline: true },
  { _id: 'b', name: 'Williams Brew', accountStatus: 'online', primaryService: 'Video', distanceKm: 30, rating: 3.5, ratingCount: 1, completedJobCount: 2, matchingJobCount: 1 },
];
const job = { _id: 'job1', title: 'Home Theater Setup', location: 'Sector 22', workType: { name: 'A/V & Digital Signage' } };
beforeEach(() => {
  jest.clearAllMocks();
  adminApi.getJobRoutingCandidates.mockResolvedValue({ data: { technicians } });
  adminApi.getTechnicianRequests.mockResolvedValue({ data: { requests: [] } });
  adminApi.sendJobInvitation.mockResolvedValue({ success: true });
});
test('filters rows and preserves selected technicians across tabs', async () => {
  render(<JobInvitationModal job={job} onClose={() => {}} onSent={() => {}} />);
  await screen.findByText('Williams Brew');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Williams Brew' }));
  fireEvent.click(screen.getByRole('tab', { name: /Selected Technicians/ }));
  expect(screen.queryByText('Harry')).toBeNull();
  expect(screen.getByText('Williams Brew')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /Available Technicians/ }));
  fireEvent.change(screen.getByLabelText('Filter by distance'), { target: { value: '25' } });
  expect(screen.getByText('Williams Brew')).toBeTruthy();
  expect(screen.getByText('18.6 miles')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Filter by distance'), { target: { value: '10' } });
  expect(screen.queryByText('Williams Brew')).toBeNull();
  expect(screen.getByText('Harry')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send Requests (1)' }).disabled).toBe(false);
});
test('bulk selection sends the selected IDs and message', async () => {
  const onSent = jest.fn(); const onClose = jest.fn();
  render(<JobInvitationModal job={job} onClose={onClose} onSent={onSent} />);
  await screen.findByText('Williams Brew');
  fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'all' } });
  fireEvent.change(screen.getByLabelText('Message to technicians (optional)'), { target: { value: 'Bring tools' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Requests (2)' }));
  await waitFor(() => expect(adminApi.sendJobInvitation).toHaveBeenCalledWith('job1', { technicianIds: ['a', 'b'], message: 'Bring tools' }));
  expect(onSent).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('shows profile photo and live presence, preserving selection when status changes', async () => {
  const lastActiveAt = new Date().toISOString();
  adminApi.getJobRoutingCandidates.mockResolvedValue({ data: { technicians: [
    { ...technicians[0], photoUrl: '/harry.jpg', lastActiveAt },
    { ...technicians[1], accountStatus: 'active', isOnline: false, lastActiveAt: new Date(Date.now() - 300000).toISOString() },
  ] } });
  const { unmount } = render(<JobInvitationModal job={job} onClose={() => {}} onSent={() => {}} />);
  const card = await screen.findByRole('article', { name: 'Harry' });
  expect(within(card).getByText('Online')).toBeTruthy();
  expect(within(card).getByText('Active now')).toBeTruthy();
  expect(within(card).getByRole('presentation', { hidden: true }).getAttribute('src')).toBe('/harry.jpg');
  expect(screen.getByText('Last active 5 minutes ago')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Harry' }));
  const handler = socket.on.mock.calls.find(([event]) => event === 'technician:presence')[1];
  act(() => handler({ technicianId: 'a', isOnline: false, lastActiveAt }));
  expect(within(card).getByText('Offline')).toBeTruthy();
  expect(within(card).getByText('Last active just now')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Select Harry' }).checked).toBe(true);
  fireEvent.error(within(card).getByRole('presentation', { hidden: true }));
  expect(within(card).queryByRole('presentation', { hidden: true })).toBeNull();
  expect(within(card).getByText('H')).toBeTruthy();
  unmount();
  expect(socket.off).toHaveBeenCalledWith('technician:presence', handler);
});

test('online-only filter responds to live status updates', async () => {
  adminApi.getJobRoutingCandidates.mockResolvedValue({ data: { technicians: [
    { ...technicians[0], lastActiveAt: new Date().toISOString() },
    { ...technicians[1], accountStatus: 'active', isOnline: false },
  ] } });
  render(<JobInvitationModal job={job} onClose={() => {}} onSent={() => {}} />);
  await screen.findByText('Williams Brew');
  fireEvent.click(screen.getByRole('button', { name: /More Filters/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Online technicians only' }));
  expect(screen.queryByText('Williams Brew')).toBeNull();
  expect(screen.getByText('Harry')).toBeTruthy();
  const handler = socket.on.mock.calls.find(([event]) => event === 'technician:presence')[1];
  act(() => handler({ technicianId: 'a', isOnline: false, lastActiveAt: new Date().toISOString() }));
  expect(screen.queryByText('Harry')).toBeNull();
  expect(screen.getByText('No technicians match these filters.')).toBeTruthy();
});
