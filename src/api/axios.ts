import axios from 'axios';

// Get base URL from environment variable
// In production, this should be set to the production API URL (e.g., https://api.prashantthakar.com/api)
// In development, it defaults to http://localhost:3001/api
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  // If environment variable is set, use it
  if (envUrl) {
    // Ensure it ends with /api if it doesn't already
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }
  
  // Default to localhost for development
  return 'http://localhost:3001/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData (file uploads)
    // Let the browser set it automatically with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging for debugging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      response: error.response?.data,
      request: error.request,
    });
    
    // Log full error object in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error object:', error);
    }

    // Handle network errors (no response from server)
    if (!error.response && error.request) {
      const baseURL = error.config?.baseURL || 'http://localhost:3001/api';
      console.error(`Cannot connect to server at ${baseURL}. Make sure the backend is running.`);
    }

    // Don't redirect on login endpoint 401 errors
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

