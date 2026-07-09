import API from './api';

const authService = {
    login: async (identifier, password) => {
        // identifier can be email or phone
        const payload = identifier.includes('@')
            ? { email: identifier, password }
            : { phone: identifier, password };
        const response = await API.post('/auth/login', payload);
        if (response.data.token) {
            localStorage.setItem('1App_token', response.data.token);
        }
        return response.data;
    },

    register: async (userData) => {
        const response = await API.post('/auth/register', userData);
        if (response.data.token) {
            localStorage.setItem('1App_token', response.data.token);
        }
        return response.data;
    },

    startRegister: async (userData) => {
        const response = await API.post('/auth/start-register', userData);
        return response.data;
    },

    verifyRegister: async (phone, code) => {
        const response = await API.post('/auth/verify-register', { phone, code });
        if (response.data.token) {
            localStorage.setItem('1App_token', response.data.token);
        }
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('1App_token');
    },

    getMe: async () => {
        const response = await API.get('/auth/me');
        return response.data;
    },

    updateMe: async (userData) => {
        const response = await API.put('/auth/me', userData);
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
