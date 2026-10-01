import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
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
        const fcmToken = localStorage.getItem('1app_fcm_token');
        const res = await API.post('/admin/login', { email, password, ...(fcmToken && { fcmToken }) });
        if (res.data.token) {
            localStorage.setItem('1app_admin_token', res.data.token);
            localStorage.setItem('1app_admin_info', JSON.stringify(res.data.data?.admin || {}));
        }
        return res.data;
    },
    logout: () => {
        localStorage.removeItem('1app_admin_token');
        localStorage.removeItem('1app_admin_info');
    },

    // ─── Dashboard ─────────────────────────────────────────────────────────────
    getStats: async (params = {}) => (await API.get('/admin/stats', { params })).data,
    getNotifications: async () => (await API.get('/notifications')).data,
    markNotificationsRead: async () => (await API.patch('/notifications/read')).data,
    registerNotificationToken: async (token) => (await API.post('/notifications/token', { token })).data,

    // ─── Bookings ──────────────────────────────────────────────────────────────
    getBookings: async (params = {}) => (await API.get('/admin/bookings', { params })).data,
    updateBooking: async (id, data) => (await API.put(`/admin/bookings/${id}`, data)).data,

    getTechnicians: async () => (await API.get('/admin/technicians')).data,
    getChatInbox: async (participantType) => (await API.get(`/chat/conversations/inbox/${participantType}`)).data,
    getChatMessages: async (technicianId, params = {}) => (await API.get(`/chat/conversations/${technicianId}/messages`, { params })).data,
    getUserChatMessages: async (userId, params = {}) => (await API.get(`/chat/conversations/user/${userId}/messages`, { params })).data,
    markChatRead: async (technicianId) => (await API.patch(`/chat/conversations/${technicianId}/read`)).data,
    markUserChatRead: async (userId) => (await API.patch(`/chat/conversations/user/${userId}/read`)).data,
    sendChatMedia: async (technicianId, formData) => (await API.post(`/chat/conversations/${technicianId}/messages`, formData, multipart)).data,
    sendUserChatMedia: async (userId, formData) => (await API.post(`/chat/conversations/user/${userId}/messages`, formData, multipart)).data,
    createTechnician: async (payload) => (await API.post('/admin/technicians', payload, multipart)).data,
    updateTechnician: async (id, payload) => (await API.patch(`/admin/technicians/${id}`, payload)).data,
    updateTechnicianAccount: async (id, status) => (await API.patch(`/admin/technicians/${id}/account`, { status })).data,
    inviteTechnician: async (payload) => (await API.post('/admin/technicians/invite', payload)).data,

    // ─── Technician Jobs ─────────────────────────────────────────────────────
    getTechnicianJobTemplate: async (id) => (await API.get(`/admin/technician-job-templates/${id}`)).data,
    updateTechnicianJobTemplate: async (id, payload) => (await API.put(`/admin/technician-job-templates/${id}`, payload)).data,
    deleteTechnicianJobTemplate: async (id) => (await API.delete(`/admin/technician-job-templates/${id}`)).data,
    getTechnicianJobTemplates: async () => (await API.get('/admin/technician-job-templates')).data,
    createTechnicianJobTemplate: async (payload) => (await API.post('/admin/technician-job-templates', payload)).data,
    sendJobInvitation: async (jobId, payload) => (await API.post(`/admin/technician-jobs/${jobId}/invitations`, payload)).data,
    getTechnicianJobs: async () => (await API.get('/admin/technician-jobs')).data,
    createTechnicianJob: async (payload) => (await API.post('/admin/technician-jobs', payload)).data,
    updateTechnicianJob: async (id, payload) => (await API.put(`/admin/technician-jobs/${id}`, payload)).data,
    deleteTechnicianJob: async (id) => (await API.delete(`/admin/technician-jobs/${id}`)).data,
    updateTechnicianJobStatus: async (id, payload) => (await API.patch(`/admin/technician-jobs/${id}/status`, payload)).data,
    payTechnician: async (id, payload) => (await API.post(`/admin/technician-jobs/${id}/pay`, payload)).data,
    rescheduleJob: async (id, payload) => (await API.patch(`/admin/technician-jobs/${id}/reschedule`, payload)).data,
    completeTask: async (jobId, taskIndex, payload = {}) => (await API.patch(`/technician/jobs/${jobId}/tasks/${taskIndex}/complete`, payload)).data,
    getTechnicianRequests: async () => (await API.get('/admin/technician-requests')).data,
    updateTechnicianRequest: async (id, payload) => (await API.patch(`/admin/technician-requests/${id}/status`, payload)).data,
    sendTechnicianRequestMessage: async (id, message) => (await API.patch(`/admin/technician-requests/${id}/message`, { message })).data,
    // ── Additional Charges (admin side) ────────────────────────────────────────
    getJobCharges: async (requestId) => (await API.get(`/admin/technician-requests/${requestId}/charges`)).data,
    reviewCharge: async (chargeId, payload) => (await API.patch(`/admin/charges/${chargeId}/review`, payload)).data,
    generateInvoice: async (requestId, payload = {}) => (await API.post(`/admin/technician-requests/${requestId}/invoice`, payload)).data,
    getInvoice: async (requestId) => (await API.get(`/admin/technician-requests/${requestId}/invoice`)).data,

    getTechnicianVerificationRequests: async () => (await API.get('/admin/technician-verifications')).data,
    updateTechnicianVerificationStatus: async (technicianId, payload) => (await API.patch(`/admin/technician-verifications/${technicianId}/status`, payload)).data,
    updateDocumentStatus: async (technicianId, documentId, payload) => (await API.patch(`/admin/technician-verifications/${technicianId}/documents/${documentId}`, payload)).data,

    // ─── Users ─────────────────────────────────────────────────────────────────
    getUsers: async (params = {}) => (await API.get('/admin/users', { params })).data,
    updateUserAccount: async (id, status) => (await API.patch(`/admin/users/${id}/status`, { status })).data,

    // ─── Plans ────────────────────────────────────────────────────────────────
    getPlans: async () => (await API.get('/plans/admin/plans')).data,
    createPlan: async (payload) => (await API.post('/plans/admin/plans', payload)).data,
    updatePlan: async (id, payload) => (await API.put(`/plans/admin/plans/${id}`, payload)).data,
    updatePlanStatus: async (id, isActive) => (await API.patch(`/plans/admin/plans/${id}/status`, { isActive })).data,
    getPlanPurchases: async () => (await API.get('/plans/admin/purchases')).data,

    // ─── Categories ────────────────────────────────────────────────────────────
    getCategories: async (params = {}) => (await API.get('/services/categories', { params: Object.keys(params).length ? params : { limit: 100 } })).data,
    createCategory: async (fd) => (await API.post('/services/categories', fd, multipart)).data,
    updateCategory: async (id, fd) => (await API.put(`/services/categories/${id}`, fd, multipart)).data,
    deleteCategory: async (id) => (await API.delete(`/services/categories/${id}`)).data,

    // ─── SubCategories ─────────────────────────────────────────────────────────
    getSubCategories: async (categoryId = '', params = {}) => {
        const query = Object.keys(params).length ? params : { limit: 100 };
        return (await API.get('/services/subcategories', { params: { ...query, ...(categoryId && { category: categoryId }) } })).data;
    },
    getSubCategoriesByCategory: async (categoryId) => (await API.get(`/services/categories/${categoryId}/subcategories`)).data,
    getServicesBySubCategory: async (subcategoryId) => (await API.get(`/services/subcategories/${subcategoryId}/services`)).data,
    createSubCategory: async (fd) => (await API.post('/services/subcategories', fd, multipart)).data,
    updateSubCategory: async (id, fd) => (await API.put(`/services/subcategories/${id}`, fd, multipart)).data,
    deleteSubCategory: async (id) => (await API.delete(`/services/subcategories/${id}`)).data,
    toggleSubCategoryStatus: async (id, isActive) => (await API.patch(`/services/subcategories/${id}/status`, { isActive })).data,

    // ─── Services ──────────────────────────────────────────────────────────────
    getServices: async (params = {}) => (await API.get('/services', { params: Object.keys(params).length ? params : { limit: 100 } })).data,
    getServiceById: async (id) => (await API.get(`/services/${id}`)).data,
    createService: async (fd) => (await API.post('/services', fd, multipart)).data,
    updateService: async (id, fd) => (await API.put(`/services/${id}`, fd, multipart)).data,
    deleteService: async (id) => (await API.delete(`/services/${id}`)).data,
    getServiceHierarchy: async () => (await API.get('/services/hierarchy')).data,

    // ─── Sub-Admins (RBAC) ──────────────────────────────────────────────────────
    getSubAdmins: async () => (await API.get('/admin/sub-admins')).data,
    getResources: async () => (await API.get('/admin/sub-admins/resources')).data,
    createSubAdmin: async (data) => (await API.post('/admin/sub-admins', data)).data,
    updateSubAdmin: async (id, data) => (await API.put(`/admin/sub-admins/${id}`, data)).data,
    deleteSubAdmin: async (id) => (await API.delete(`/admin/sub-admins/${id}`)).data,

    // ─── Blogs ─────────────────────────────────────────────────────────────────
    getBlogs: async () => (await API.get('/blogs')).data,
    getBlogById: async (id) => (await API.get(`/blogs/${id}`)).data,
    createBlog: async (fd) => (await API.post('/blogs', fd, multipart)).data,
    updateBlog: async (id, fd) => (await API.put(`/blogs/${id}`, fd, multipart)).data,
    deleteBlog: async (id) => (await API.delete(`/blogs/${id}`)).data,

    // ─── Work Types ────────────────────────────────────────────────────────────
    getWorkTypes: async () => (await API.get('/work-types?includeInactive=true')).data,
    createWorkType: async (data) => (await API.post('/work-types', data)).data,
    updateWorkType: async (id, data) => (await API.put(`/work-types/${id}`, data)).data,
    deleteWorkType: async (id) => (await API.delete(`/work-types/${id}`)).data,
    // Sub-types
    addWorkSubType: async (workTypeId, data) => (await API.post(`/work-types/${workTypeId}/sub-types`, data)).data,
    updateWorkSubType: async (workTypeId, subId, data) => (await API.put(`/work-types/${workTypeId}/sub-types/${subId}`, data)).data,
    deleteWorkSubType: async (workTypeId, subId) => (await API.delete(`/work-types/${workTypeId}/sub-types/${subId}`)).data,

    // ─── Service Types ─────────────────────────────────────────────────────────
    getServiceTypes: async () => (await API.get('/service-types?includeInactive=true')).data,
    createServiceType: async (data) => (await API.post('/service-types', data)).data,
    updateServiceType: async (id, data) => (await API.put(`/service-types/${id}`, data)).data,
    deleteServiceType: async (id) => (await API.delete(`/service-types/${id}`)).data,
    toggleServiceTypeStatus: async (id, isActive) => (await API.patch(`/service-types/${id}/status`, { isActive })).data,
};

export default adminApi;
