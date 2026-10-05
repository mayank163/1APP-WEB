import API from './api';

const bookingService = {
    createBooking: async (bookingData) => {
        const response = await API.post('/bookings', bookingData);
        return response.data;
    },

    verifyPayment: async (verificationData) => {
        const response = await API.post('/bookings/verify', verificationData);
        return response.data;
    },

    verifyStripePayment: async (paymentAttemptId, stripePaymentIntentId) => {
        const response = await API.post('/bookings/verify', { paymentAttemptId, stripePaymentIntentId });
        return response.data;
    },

    verifyPayPalPayment: async (paymentAttemptId, paypalOrderId) => {
        const response = await API.post('/bookings/verify', { paymentAttemptId, paypalOrderId });
        return response.data;
    },

    getMyBookings: async ({ page = 1, limit = 10 } = {}) => {
        const response = await API.get('/bookings/my-bookings', { params: { page, limit } });
        return response.data;
    },

    getBookingDetails: async (id) => {
        const response = await API.get(`/bookings/${id}`);
        return response.data;
    },

    cancelBooking: async (id) => {
        const response = await API.post(`/bookings/${id}/cancel`);
        return response.data;
    },

    downloadInvoice: async (id) => {
        // Return file contents directly
        const response = await API.get(`/bookings/${id}/invoice`, {
            responseType: 'blob'
        });
        return response.data;
    },

    getReviewableServices: async (bookingId) => {
        const response = await API.get(`/bookings/${bookingId}/reviewable-services`);
        return response.data;
    },

    submitServiceReview: async (serviceId, payload) => {
        // payload: { rating, review, bookingId }
        const response = await API.post(`/services/${serviceId}/reviews`, payload);
        return response.data;
    },
};

export default bookingService;
