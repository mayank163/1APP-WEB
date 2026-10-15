import React, { useContext } from 'react';
import { act, render, screen } from '@testing-library/react';
import { AuthContext, AuthProvider } from './AuthContext';
import authService from '../services/authService';
jest.mock('../services/authService', () => ({ getMe: jest.fn() }));
jest.mock('../services/firebaseNotifications', () => ({ enableBrowserNotifications: jest.fn() }));
const Status = () => <span>{useContext(AuthContext).isAuthenticated ? 'signed in' : 'signed out'}</span>;
beforeEach(() => {
    jest.useFakeTimers();
    localStorage.setItem('1App_token', 'web-token');
    authService.getMe.mockReset();
    authService.getMe.mockResolvedValue({ success: true, data: { user: { _id: 'user' } } });
});
afterEach(() => { jest.useRealTimers(); localStorage.clear(); });
const mount = async () => {
    await act(async () => { render(<AuthProvider><Status /></AuthProvider>); });
    expect(screen.getByText('signed in')).toBeTruthy();
};
test('session rejection clears displayed authentication state', async () => {
    await mount();
    act(() => { window.dispatchEvent(new Event('1App:session-expired')); });
    expect(screen.getByText('signed out')).toBeTruthy();
});
test('idle sessions are checked and cleared after replacement', async () => {
    await mount();
    authService.getMe.mockImplementation(async () => {
        window.dispatchEvent(new Event('1App:session-expired'));
        throw new Error('Session has been logged out');
    });
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(authService.getMe).toHaveBeenCalledTimes(2);
    expect(screen.getByText('signed out')).toBeTruthy();
});
test('focus checks session; network errors preserve login', async () => {
    await mount();
    authService.getMe.mockRejectedValue(new Error('Offline'));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(authService.getMe).toHaveBeenCalledTimes(2);
    expect(screen.getByText('signed in')).toBeTruthy();
});
