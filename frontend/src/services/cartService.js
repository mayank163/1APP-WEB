import API from './api';

const cartService = {
    getCart: async () => {
        const res = await API.get('/cart');
        return res.data;
    },

    addToCart: async (serviceId, quantity = 1) => {
        const res = await API.post('/cart', { serviceId, quantity });
        return res.data;
    },

    updateCartItem: async (serviceId, quantity) => {
        const res = await API.put(`/cart/${serviceId}`, { quantity });
        return res.data;
    },

    removeFromCart: async (serviceId) => {
        const res = await API.delete(`/cart/${serviceId}`);
        return res.data;
    },

    clearCart: async () => {
        const res = await API.delete('/cart');
        return res.data;
    },

    // Merge a guest localStorage cart into the DB cart after login
    mergeCart: async (items) => {
        const res = await API.post('/cart/merge', { items });
        return res.data;
    }
};

export default cartService;
