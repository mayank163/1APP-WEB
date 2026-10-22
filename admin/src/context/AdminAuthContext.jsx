import React, { createContext, useContext, useState, useEffect } from 'react';
import adminApi from '../services/adminApi';
import { enableBrowserNotifications } from '../services/firebaseNotifications';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const endSession = () => {
            adminApi.logout();
            setAdmin(null);
            setLoading(false);
        };
        const onStorage = (event) => {
            if (event.key === null || event.key === '1app_admin_token') endSession();
        };
        window.addEventListener('admin-session-ended', endSession);
        window.addEventListener('storage', onStorage);
        const sessionToken = localStorage.getItem('1app_admin_token');
        if (!sessionToken) {
            endSession();
        } else {
            adminApi.getSession().then((response) => {
                if (!active || localStorage.getItem('1app_admin_token') !== sessionToken) return;
                const currentAdmin = response.data?.admin;
                if (!currentAdmin) return endSession();
                setAdmin(currentAdmin);
                localStorage.setItem('1app_admin_info', JSON.stringify(currentAdmin));
            }).catch(() => {
                if (active) endSession();
            }).finally(() => {
                if (active) setLoading(false);
            });
        }
        return () => {
            active = false;
            window.removeEventListener('admin-session-ended', endSession);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    useEffect(() => {
        if (admin && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            enableBrowserNotifications({ requestPermission: false }).catch(() => {});
        }
    }, [admin]);

    const saveAdmin = (adminData) => {
        setAdmin(adminData);
        localStorage.setItem('1app_admin_info', JSON.stringify(adminData));
    };

    const clearAdmin = () => {
        setAdmin(null);
        adminApi.logout();
    };

    // Returns true if admin can perform the given access on a resource
    const can = (resource, access = 'read') => {
        if (!admin) return false;
        if (admin.isSuperAdmin) return true;
        const perm = (admin.permissions || []).find(p => p.resource === resource);
        if (!perm) return false;
        return perm.access === 'both' || perm.access === access;
    };

    return (
        <AdminAuthContext.Provider value={{ admin, loading, saveAdmin, clearAdmin, can }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
