import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';
import adminApi from '../services/adminApi';

jest.mock('../services/firebaseNotifications', () => ({ enableBrowserNotifications: jest.fn() }));
jest.mock('../services/adminApi', () => ({
    getSession: jest.fn(),
    logout: jest.fn(() => {
        global.localStorage.removeItem('1app_admin_token');
        global.localStorage.removeItem('1app_admin_info');
    }),
}));

function Session() {
    const { admin, loading } = useAdminAuth();
    return <div>{loading ? 'Checking' : admin ? admin.name : 'Login required'}</div>;
}
const renderSession = () => render(<AdminAuthProvider><Session /></AdminAuthProvider>);

beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    adminApi.logout.mockImplementation(() => {
        localStorage.removeItem('1app_admin_token');
        localStorage.removeItem('1app_admin_info');
    });
});

test('does not restore cached admin information without a token', () => {
    localStorage.setItem('1app_admin_info', JSON.stringify({ name: 'Cached Admin' }));
    renderSession();
    expect(screen.getByText('Login required')).toBeTruthy();
    expect(adminApi.getSession).not.toHaveBeenCalled();
});

test('waits for server validation before restoring a session and clears a rejected session', async () => {
    localStorage.setItem('1app_admin_token', 'expired');
    let rejectSession;
    adminApi.getSession.mockReturnValue(new Promise((resolve, reject) => { rejectSession = reject; }));
    renderSession();
    expect(screen.getByText('Checking')).toBeTruthy();
    await act(async () => rejectSession(new Error('Unauthorized')));
    expect(screen.getByText('Login required')).toBeTruthy();
    expect(localStorage.getItem('1app_admin_token')).toBeNull();
});

test('ends an authenticated session immediately when an API rejects it', async () => {
    localStorage.setItem('1app_admin_token', 'valid');
    adminApi.getSession.mockResolvedValue({ data: { admin: { name: 'Verified Admin' } } });
    renderSession();
    expect(await screen.findByText('Verified Admin')).toBeTruthy();
    act(() => window.dispatchEvent(new Event('admin-session-ended')));
    expect(screen.getByText('Login required')).toBeTruthy();
    expect(localStorage.getItem('1app_admin_token')).toBeNull();
});
