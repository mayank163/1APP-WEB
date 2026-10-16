import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JobInvitationModal from './JobInvitationModal';
import adminApi from '../services/adminApi';

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
