import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TechnicianOnboarding from './TechnicianOnboarding';
import API from '../services/api';
jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }));
jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
const fill = () => {
  for (const [label, value] of [['Full name', 'Sam'], ['Mobile number', '2025550123'], ['Email address', 'sam@example.com'], ['Address', 'Delhi'], ['Service radius (miles)', '15'], ['Years of experience', '3'], ['Licence issue date', '2020-01-01'], ['Licence expiry date', '2030-01-01']]) {
    fireEvent.change(screen.getByLabelText(label, { exact: label === 'Address' }), { target: { value } });
  }
  fireEvent.change(screen.getByLabelText('Driving licence front image', { exact: false }), { target: { files: [new File(['licence'], 'licence.jpg', { type: 'image/jpeg' })] } });
  fireEvent.change(screen.getByLabelText('Driving licence back image', { exact: false }), { target: { files: [new File(['back'], 'back.jpg', { type: 'image/jpeg' })] } });
  fireEvent.click(screen.getByRole('checkbox'));
};
beforeEach(() => jest.clearAllMocks());
test('saves without a password and shows only a thank-you message', async () => {
  API.post.mockResolvedValueOnce({ data: { success: true } });
  render(<TechnicianOnboarding />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Register your interest' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Thank you!'));
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('form')).toBeNull();
  expect(screen.queryByText('Join as a technician')).toBeNull();
  const [url, data, config] = API.post.mock.calls[0];
  expect(url).toBe('/technician-auth/preregister');
  expect(data.get('phone')).toBe('+12025550123');
  expect(data.get('address')).toBe('Delhi');
  expect(data.get('serviceRadius')).toBe('15');
  expect(data.get('drivingLicenseFront').name).toBe('licence.jpg');
  expect(data.has('profilePhoto')).toBe(false);
  expect(data.has('password')).toBe(false);
  expect(config.headers['Content-Type']).toBe('multipart/form-data');
});
test('preserves entered details on a backend error', async () => {
  API.post.mockRejectedValueOnce({ response: { data: { message: 'Already registered.' } } });
  render(<TechnicianOnboarding />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Register your interest' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Already registered.'));
  expect(screen.getByLabelText('Full name').value).toBe('Sam');
});

test('country picker defaults to US +1 and submits the selected code', async () => {
  API.post.mockResolvedValueOnce({ data: { success: true } });
  render(<TechnicianOnboarding />);
  expect(screen.getByLabelText('Country calling code').value).toBe('+1');
  expect(screen.queryByLabelText(/Profile photo/)).toBeNull();
  fill();
  fireEvent.change(screen.getByLabelText('Country calling code'), { target: { value: '+91' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register your interest' }));
  await waitFor(() => expect(API.post).toHaveBeenCalled());
  expect(API.post.mock.calls[0][1].get('phone')).toBe('+912025550123');
});

test('phone input allows only the selected country digit count', () => {
  render(<TechnicianOnboarding />);
  const phone = screen.getByLabelText('Mobile number');
  fireEvent.change(screen.getByLabelText('Country calling code'), { target: { value: '+91' } });
  fireEvent.change(phone, { target: { value: '987654321099abc' } });
  expect(phone.value).toBe('9876543210');
  expect(phone.maxLength).toBe(10);
  fireEvent.change(phone, { target: { value: '98765' } });
  expect(phone.checkValidity()).toBe(false);
  fireEvent.change(phone, { target: { value: '9876543210' } });
  expect(phone.checkValidity()).toBe(true);
  fireEvent.change(screen.getByLabelText('Country calling code'), { target: { value: '+65' } });
  expect(phone.value).toBe('98765432');
  expect(phone.maxLength).toBe(8);
});

test('rejects expiry dates before the issue date', async () => {
  render(<TechnicianOnboarding />);
  fill();
  fireEvent.change(screen.getByLabelText('Licence expiry date'), { target: { value: '2019-01-01' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Register your interest' }).closest('form'));
  expect(screen.getByRole('alert').textContent).toContain('expiry date must be after');
  expect(API.post).not.toHaveBeenCalled();
});
