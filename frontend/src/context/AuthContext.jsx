import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { enableBrowserNotifications } from '../services/firebaseNotifications';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const checkAuth = async () => {
        const token = localStorage.getItem('1App_token');
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const res = await authService.getMe();
            if (res.success) {
                setUser(res.data.user);
            } else {
                localStorage.removeItem('1App_token');
                setUser(null);
            }
        } catch (err) {
            console.error('Auth verification failed', err);
            localStorage.removeItem('1App_token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const expireSession = () => setUser(null);
        window.addEventListener('1App:session-expired', expireSession);
        checkAuth();
        return () => window.removeEventListener('1App:session-expired', expireSession);
    }, []);

    useEffect(() => {
        if (!user) return undefined;
        let pending = false;
        const verifySession = async () => {
            if (pending || document.visibilityState === 'hidden') return;
            pending = true;
            try {
                // The API interceptor clears the session on 401. Network errors
                // leave the session intact so an offline device stays signed in.
                await authService.getMe();
            } catch (_) {
            } finally {
                pending = false;
            }
        };
        const syncStorage = (event) => {
            if (event.key === '1App_token') {
                if (!event.newValue) setUser(null);
                else verifySession();
            }
        };
        const timer = window.setInterval(verifySession, 10000);
        window.addEventListener('focus', verifySession);
        document.addEventListener('visibilitychange', verifySession);
        window.addEventListener('storage', syncStorage);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', verifySession);
            document.removeEventListener('visibilitychange', verifySession);
            window.removeEventListener('storage', syncStorage);
        };
    }, [user]);

    useEffect(() => {
        if (user && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            enableBrowserNotifications({ requestPermission: false }).catch(() => {});
        }
    }, [user]);

    const login = async (identifier, password) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.login(identifier, password);
            if (res.success) {
                setUser(res.data.user);
                return res.data.user;
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Login failed. Please try again.';
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.register(userData);
            if (res.success) {
                setUser(res.data.user);
                return res.data.user;
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Registration failed.';
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const startRegister = async (userData) => {
        setLoading(true);
        setError(null);
        try {
            return await authService.startRegister(userData);
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Failed to send registration OTP.';
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const verifyRegister = async (phone, code) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.verifyRegister(phone, code);
            if (res.success) {
                setUser(res.data.user);
                return res.data.user;
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Registration verification failed.';
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const googleLogin = async (accessToken) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.googleLogin(accessToken);
            if (res.success) {
                setUser(res.data.user);
                return res.data.user;
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Google login failed.';
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const googleSignup = async (accessToken) => {
        setLoading(true);
        setError(null);
        try {
            return await authService.googleSignup(accessToken);
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Google signup failed.';
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
    };

    const sendOTP = async () => {
        try {
            const res = await authService.sendOTP();
            return res;
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Failed to send OTP');
        }
    };

    const verifyOTP = async (code) => {
        try {
            const res = await authService.verifyOTP(code);
            if (res.success) {
                setUser(res.data.user);
                return res;
            }
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Verification failed');
        }
    };

    const updateProfile = async (userData) => {
        try {
            const res = await authService.updateMe(userData);
            if (res.success) {
                setUser(res.data.user);
                return res.data.user;
            }
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Update profile failed');
        }
    };

    const deleteAccount = async () => {
        try {
            const res = await authService.deleteAccount();
            setUser(null);
            return res;
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Account deletion failed');
        }
    };

    const uploadProfileImage = async (file) => {
        try {
            const res = await authService.uploadProfileImage(file);
            if (res.success) {
                setUser(res.data.user);
                return res.data.user;
            }
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Image upload failed');
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            login,
            register,
            startRegister,
            verifyRegister,
            logout,
            sendOTP,
            verifyOTP,
            updateProfile,
            deleteAccount,
            uploadProfileImage,
            isAuthenticated: !!user,
            isAdmin: user?.role === 'admin',
            isTechnician: user?.role === 'technician',
            googleLogin,
            googleSignup
        }}>
            {children}
        </AuthContext.Provider>
    );
};
