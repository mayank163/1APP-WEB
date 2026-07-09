import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
    timeout: 30000
});

API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('1app_admin_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) localStorage.removeItem('1app_admin_token');
        return Promise.reject(error);
    }
);

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

const adminApi = {
    // ─── Auth ──────────────────────────────────────────────────────────────────
    login: async (email, password) => {
        const res = await API.post('/admin/login', { email, password });
        if (res.data.token) localStorage.setItem('1app_admin_token', res.data.token);
        return res.data;
    },
    logout: () => localStorage.removeItem('1app_admin_token'),

    // ─── Dashboard ─────────────────────────────────────────────────────────────
    getStats: async () => (await API.get('/admin/stats')).data,

    // ─── Bookings ──────────────────────────────────────────────────────────────
    getBookings: async (filters = {}) => {
        const { status, paymentStatus, search } = filters;
        const params = [];
        if (status) params.push(`status=${encodeURIComponent(status)}`);
        if (paymentStatus) params.push(`paymentStatus=${encodeURIComponent(paymentStatus)}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        return (await API.get(`/admin/bookings${params.length ? '?' + params.join('&') : ''}`)).data;
    },
    updateBooking: async (id, data) => (await API.put(`/admin/bookings/${id}`, data)).data,

    // ─── Users ─────────────────────────────────────────────────────────────────
    getUsers: async () => (await API.get('/admin/users')).data,

    // ─── Categories ────────────────────────────────────────────────────────────
    getCategories: async () => (await API.get('/services/categories')).data,
    createCategory: async (fd) => (await API.post('/services/categories', fd, multipart)).data,
    updateCategory: async (id, fd) => (await API.put(`/services/categories/${id}`, fd, multipart)).data,
    deleteCategory: async (id) => (await API.delete(`/services/categories/${id}`)).data,

    // ─── SubCategories ─────────────────────────────────────────────────────────
    getSubCategories: async (categoryId = '') => {
        const url = categoryId ? `/services/subcategories?category=${categoryId}` : '/services/subcategories';
        return (await API.get(url)).data;
    },
    createSubCategory: async (fd) => (await API.post('/services/subcategories', fd, multipart)).data,
    updateSubCategory: async (id, fd) => (await API.put(`/services/subcategories/${id}`, fd, multipart)).data,
    deleteSubCategory: async (id) => (await API.delete(`/services/subcategories/${id}`)).data,
    toggleSubCategoryStatus: async (id, isActive) => (await API.patch(`/services/subcategories/${id}/status`, { isActive })).data,

    // ─── Services ──────────────────────────────────────────────────────────────
    getServices: async (filters = {}) => {
        const params = [];
        Object.entries(filters).forEach(([k, v]) => { if (v) params.push(`${k}=${encodeURIComponent(v)}`); });
        return (await API.get(`/services${params.length ? '?' + params.join('&') : ''}`)).data;
    },
    getServiceById: async (id) => (await API.get(`/services/${id}`)).data,
    createService: async (fd) => (await API.post('/services', fd, multipart)).data,
    updateService: async (id, fd) => (await API.put(`/services/${id}`, fd, multipart)).data,
    deleteService: async (id) => (await API.delete(`/services/${id}`)).data,
    getServiceHierarchy: async () => (await API.get('/services/hierarchy')).data,

    // ─── Blogs ─────────────────────────────────────────────────────────────────
    getBlogs: async () => (await API.get('/blogs')).data,
    getBlogById: async (id) => (await API.get(`/blogs/${id}`)).data,
    createBlog: async (fd) => (await API.post('/blogs', fd, multipart)).data,
    updateBlog: async (id, fd) => (await API.put(`/blogs/${id}`, fd, multipart)).data,
    deleteBlog: async (id) => (await API.delete(`/blogs/${id}`)).data,
};

export default adminApi;
