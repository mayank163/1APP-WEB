import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TechnicianVerification from './TechnicianVerification';
import adminApi from '../services/adminApi';
jest.mock('../context/AdminAuthContext', () => ({ useAdminAuth: () => ({ can: () => true }) }));
jest.mock('../services/adminApi', () => ({ __esModule: true, default: { getTechnicianVerificationRequests: jest.fn(), assignTechnicianReviewer: jest.fn() } }));
jest.mock('../services/socket', () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useSearchParams: () => [new URLSearchParams(), jest.fn()] }), { virtual: true });
const data = { requests: [{ _id: 'tech1', name: 'Arun', verificationStatus: 'pending', documents: {}, reviewerId: null }, { _id: 'tech2', name: 'Ravi', verificationStatus: 'pending', documents: {}, reviewerId: 'admin2', reviewer: 'Priya' }], reviewers: [{ _id: 'admin1', name: 'Anita' }, { _id: 'admin2', name: 'Priya' }] };
beforeEach(() => { jest.clearAllMocks(); adminApi.getTechnicianVerificationRequests.mockResolvedValue({ data }); adminApi.assignTechnicianReviewer.mockResolvedValue({ success: true }); });
test('shows sub-admin options and saves selected reviewer', async () => {
  render(<TechnicianVerification />);
  const dropdown = await screen.findByLabelText('Reviewer for Arun');
  expect(Array.from(dropdown.options).map(option => option.text)).toEqual(['Unassigned', 'Anita', 'Priya']);
  fireEvent.change(dropdown, { target: { value: 'admin1' } });
  await waitFor(() => expect(adminApi.assignTechnicianReviewer).toHaveBeenCalledWith('tech1', 'admin1'));
  await waitFor(() => expect(adminApi.getTechnicianVerificationRequests).toHaveBeenCalledTimes(2));
});
test('reviewer filter uses sub-admin IDs', async () => {
  render(<TechnicianVerification />);
  await screen.findByLabelText('Reviewer for Arun');
  fireEvent.change(screen.getByLabelText('Reviewer filter'), { target: { value: 'admin2' } });
  expect(screen.queryByLabelText('Reviewer for Arun')).toBeNull();
  expect(screen.getByLabelText('Reviewer for Ravi').value).toBe('admin2');
});
