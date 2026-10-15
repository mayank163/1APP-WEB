import axios from 'axios';
import './api';
jest.mock('axios', () => ({ create: jest.fn(() => ({ interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } })) }));
const rejectResponse = axios.create.mock.results[0].value.interceptors.response.use.mock.calls[0][1];
afterEach(() => localStorage.clear());
test('401 clears current tokens and announces session expiry', async () => {
    localStorage.setItem('1App_token', 'current');
    localStorage.setItem('1App_refreshToken', 'refresh');
    const listener = jest.fn();
    window.addEventListener('1App:session-expired', listener);
    const error = { response: { status: 401 }, config: { headers: { Authorization: 'Bearer current' } } };
    await expect(rejectResponse(error)).rejects.toBe(error);
    expect(localStorage.getItem('1App_token')).toBeNull();
    expect(localStorage.getItem('1App_refreshToken')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('1App:session-expired', listener);
});
test('late rejection from old session preserves the new login', async () => {
    localStorage.setItem('1App_token', 'new');
    const error = { response: { status: 401 }, config: { headers: { Authorization: 'Bearer old' } } };
    await expect(rejectResponse(error)).rejects.toBe(error);
    expect(localStorage.getItem('1App_token')).toBe('new');
});
