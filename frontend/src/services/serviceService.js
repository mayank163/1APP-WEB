import API from './api';

const serviceService = {
    getAllServices: async (filters = {}) => {
        const { category, subcategory, search } = filters;
        let url = '/services';
        const params = [];
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        if (subcategory) params.push(`subcategory=${encodeURIComponent(subcategory)}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (params.length > 0) url += `?${params.join('&')}`;
        const response = await API.get(url);
        return response.data;
    },

    getServiceById: async (id) => {
        const response = await API.get(`/services/${id}`);
        return response.data;
    },

    getCategories: async () => {
        const response = await API.get('/services/categories');
        return response.data;
    },

    getCategoriesWithSubcategories: async () => {
        const [catRes, subRes] = await Promise.all([
            API.get('/services/categories'),
            API.get('/services/subcategories'),
        ]);
        const categories = catRes.data.data.categories.map(cat => ({
            ...cat,
            id: cat._id,
            subcategories: subRes.data.data.subcategories.filter(
                sub => (sub.category?._id || sub.category) === (cat._id?.toString?.() || cat._id)
            ),
        }));
        return { success: true, data: { categories } };
    },

    getFeaturedServices: async () => {
        const response = await API.get('/services/featured');
        return response.data;
    },

    getSubCategories: async (categoryId = '') => {
        const url = categoryId ? `/services/subcategories?category=${categoryId}` : '/services/subcategories';
        const response = await API.get(url);
        return response.data;
    },


    getSubcategoriesByCategoryId: async (categoryId) => {
        const response = await API.get(`/services/categories/${categoryId}/subcategories`);
        return response.data;
    },

    getServicesBySubcategoryId: async (subcategoryId) => {
        const response = await API.get(`/services/subcategories/${subcategoryId}/services`);
        return response.data;
    },
};

export default serviceService;