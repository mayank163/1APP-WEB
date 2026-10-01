import API from './api';

const planService = {
    getPlans: async (filters = {}) => (await API.get('/plans', { params: filters })).data,
    createPurchase: async (planId) => (await API.post('/plans/purchases', { planId })).data,
    verifyPurchase: async (planPurchaseId, stripePaymentIntentId) => (
        await API.post('/plans/purchases/verify', { planPurchaseId, stripePaymentIntentId })
    ).data,
    getMyPurchases: async () => (await API.get('/plans/my-purchases')).data
};

export default planService;