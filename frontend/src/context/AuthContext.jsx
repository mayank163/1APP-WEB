import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

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
        checkAuth();
    }, []);

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
            const errMsg = err.response?.data?.message || 'Login failed. Please try again.';
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

    const logout = () => {
        authService.logout();
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
            isAuthenticated: !!user,
            isAdmin: user?.role === 'admin'
        }}>
            {children}
        </AuthContext.Provider>
    );
};
