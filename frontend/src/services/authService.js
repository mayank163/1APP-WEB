import API from './api';

const authService = {
    login: async (identifier, password) => {
        // identifier can be email or phone
        const payload = identifier.includes('@')
            ? { email: identifier, password }
            : { phone: identifier, password };

        // Try regular user login first, then technician login
        try {
            const response = await API.post('/auth/login', payload);
            const token = response.data.accessToken || response.data.token;
            if (token) {
                localStorage.setItem('1App_token', token);
            }
            if (response.data.refreshToken) {
                localStorage.setItem('1App_refreshToken', response.data.refreshToken);
            }
            return response.data;
        } catch (err) {
            // If regular login fails, try technician login
            const techRes = await API.post('/technician-auth/login', payload);
            const token = techRes.data.accessToken || techRes.data.token;
            if (token) {
                localStorage.setItem('1App_token', token);
            }
            if (techRes.data.refreshToken) {
                localStorage.setItem('1App_refreshToken', techRes.data.refreshToken);
            }
            return techRes.data;
        }
    },

    register: async (userData) => {
        const response = await API.post('/auth/register', userData);
        const token = response.data.accessToken || response.data.token;
        if (token) {
            localStorage.setItem('1App_token', token);
        }
        if (response.data.refreshToken) {
            localStorage.setItem('1App_refreshToken', response.data.refreshToken);
        }
        return response.data;
    },

    startRegister: async (userData) => {
        const response = await API.post('/auth/start-register', userData);
        return response.data;
    },

    verifyRegister: async (phone, code) => {
        const response = await API.post('/auth/verify-register', { phone, code });
        const token = response.data.accessToken || response.data.token;
        if (token) {
            localStorage.setItem('1App_token', token);
        }
        if (response.data.refreshToken) {
            localStorage.setItem('1App_refreshToken', response.data.refreshToken);
        }
        return response.data;
    },

    googleLogin: async (accessToken) => {
        const response = await API.post('/auth/google', { accessToken });
        const token = response.data.accessToken || response.data.token;
        if (token) {
            localStorage.setItem('1App_token', token);
        }
        if (response.data.refreshToken) {
            localStorage.setItem('1App_refreshToken', response.data.refreshToken);
        }
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('1App_token');
        localStorage.removeItem('1App_refreshToken');
    },

    getMe: async () => {
        const response = await API.get('/auth/me');
        return response.data;
    },

    updateMe: async (userData) => {
        const response = await API.put('/auth/me', userData);
        return response.data;
    },

    uploadProfileImage: async (file) => {
        const formData = new FormData();
        formData.append('profileImage', file);
        const response = await API.post('/auth/me/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    sendOTP: async () => {
        const response = await API.post('/auth/send-otp');
        return response.data;
    },

    verifyOTP: async (code) => {
        const response = await API.post('/auth/verify-otp', { code });
        return response.data;
    }
};

export default authService;
