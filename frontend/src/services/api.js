import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_IMAGE_URL;

/**
 * Resolves a service image URL.
 * Backend stores images as relative paths like "/uploads/filename.jpg".
 * This converts them to absolute URLs pointing to the backend server.
 */
export const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    return `${API_BASE_URL}${imageUrl}`;
};

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || `${API_BASE_URL}/api`,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor to add Authorization JWT token
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('1App_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor to handle common responses (unauthorized, etc)
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('1App_token');
            // optionally redirect or handle logout
        }
        return Promise.reject(error);
    }
);

export default API;
