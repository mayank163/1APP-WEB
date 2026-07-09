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

    getMyBookings: async () => {
        const response = await API.get('/bookings/my-bookings');
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
    }
};

export default bookingService;
