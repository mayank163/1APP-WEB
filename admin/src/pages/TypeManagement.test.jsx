import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TypeManagement from './TypeManagement';
import adminApi from '../services/adminApi';
let mockPath = '/work-types';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mockPath }), useNavigate: () => mockNavigate, Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../services/adminApi', () => ({ __esModule: true, default: { getWorkTypes: jest.fn(), getServiceTypes: jest.fn(), getServices: jest.fn(), createWorkType: jest.fn() } }));
jest.mock('../context/AdminAuthContext', () => ({ useAdminAuth: () => ({ can: () => true }) }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
beforeEach(() => {
    jest.clearAllMocks(); mockPath = '/work-types';
    adminApi.getWorkTypes.mockResolvedValue({ data: { workTypes: [{ _id: 'w1', name: 'Cameras', description: 'Camera systems', isActive: true, subTypes: [{ _id: 'sub1', name: 'CCTV', isActive: true }] }] } });
    adminApi.getServiceTypes.mockResolvedValue({ data: { serviceTypes: [{ _id: 's1', name: 'Installation', isActive: true }, { _id: 's2', name: 'Repair', isActive: false }] } });
    adminApi.getServices.mockResolvedValue({ pagination: { total: 38 } });
    adminApi.createWorkType.mockResolvedValue({ success: true });
});
const setup = (path = '/work-types') => { mockPath = path; return render(<TypeManagement />); };
test('shows live counts, expands sub-types and switches tabs', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Cameras' })).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Cameras' }));
    expect(screen.getByText('CCTV')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('tab', { name: /Service Types/ })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/service-types');
});
test('saves a work type and its initial sub-type with inactive status', async () => {
    setup(); await screen.findByRole('heading', { name: 'Cameras' });
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Type' }));
    fireEvent.change(screen.getByLabelText(/^Work Type Name/), { target: { value: 'Networking' } });
    fireEvent.change(screen.getByLabelText(/Sub - Work Type Name/), { target: { value: 'Cabling' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Active status' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Work Type' }).slice(-1)[0]);
    await waitFor(() => expect(adminApi.createWorkType).toHaveBeenCalledWith({ name: 'Networking', description: '', isActive: false, subTypes: [{ name: 'Cabling', description: '', isActive: false }] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('filters service types and resets filters', async () => {
    setup('/service-types'); await screen.findByText('Installation');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
    expect(screen.queryByText('Installation')).not.toBeInTheDocument();
    expect(screen.getByText('Repair')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(screen.getByText('Installation')).toBeInTheDocument();
});
