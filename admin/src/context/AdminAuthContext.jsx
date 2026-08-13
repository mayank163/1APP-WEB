import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);

    useEffect(() => {
        const stored = localStorage.getItem('1app_admin_info');
        if (stored) {
            try { setAdmin(JSON.parse(stored)); } catch { /* ignore */ }
        }
    }, []);

    const saveAdmin = (adminData) => {
        setAdmin(adminData);
        localStorage.setItem('1app_admin_info', JSON.stringify(adminData));
    };

    const clearAdmin = () => {
        setAdmin(null);
        localStorage.removeItem('1app_admin_info');
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
        <AdminAuthContext.Provider value={{ admin, saveAdmin, clearAdmin, can }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
