import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for file uploads and AI processing
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Log API requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
  }
  
  return config;
});

// Response interceptor for error handling and token management
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  (error) => {
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`);
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

// Transaction API - MAIN API FOR DATA
export const transactionAPI = {
  create: (transactionData) => {
    console.log('💰 Creating transaction:', transactionData.type, transactionData.amount);
    return api.post('/transactions', transactionData);
  },
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    console.log('📋 Fetching transactions:', queryString || 'no filters');
    return api.get('/transactions', { params });
  },
  getById: (id) => {
    console.log('🔍 Fetching transaction:', id);
    return api.get(`/transactions/${id}`);
  },
  update: (id, transactionData) => {
    console.log('✏️ Updating transaction:', id);
    return api.put(`/transactions/${id}`, transactionData);
  },
  delete: (id) => {
    console.log('🗑️ Deleting transaction:', id);
    return api.delete(`/transactions/${id}`);
  },
  bulkCreate: (transactions) => {
    console.log('📦 Bulk creating transactions:', transactions.length);
    return api.post('/transactions/bulk', { transactions });
  },
  getStats: (params = {}) => {
    console.log('📊 Fetching transaction stats');
    return api.get('/transactions/stats', { params });
  },
};

// Upload API - CORRECTED ENDPOINTS
export const uploadAPI = {
  uploadReceipt: (formData) => {
    console.log('📸 Uploading receipt for OCR processing');
    return api.post('/upload/receipt', formData, { // This calls /api/upload/receipt
      headers: { 
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000, // 2 minutes for OCR + AI processing
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`📤 Receipt upload progress: ${percentCompleted}%`);
      }
    });
  },
  uploadBankStatement: (formData) => {
    console.log('🏦 Uploading bank statement for PDF processing');
    return api.post('/upload/bank-statement', formData, { // This calls /api/upload/bank-statement
      headers: { 
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000, // 2 minutes for PDF processing
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`📤 Bank statement upload progress: ${percentCompleted}%`);
      }
    });
  },
};

// Authentication API
export const authAPI = {
  register: (userData) => {
    console.log('📝 Registering user:', userData.username);
    return api.post('/auth/register', userData);
  },
  login: (credentials) => {
    console.log('🔐 Logging in user:', credentials.email);
    return api.post('/auth/login', credentials);
  },
  logout: () => {
    console.log('👋 Logging out user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    return api.get('/auth/me');
  },
};

// Helper functions for common operations
export const apiHelpers = {
  // Handle API errors consistently
  handleApiError: (error, defaultMessage = 'An error occurred') => {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return defaultMessage;
  },
  
  // Check if response is successful
  isSuccessResponse: (response) => {
    return response.status >= 200 && response.status < 300 && response.data?.success !== false;
  },
};

// Export default api instance for custom calls
export default api;

// Export all APIs as a single object for easy importing
export const API = {
  auth: authAPI,
  transactions: transactionAPI,
  upload: uploadAPI,
  helpers: apiHelpers,
};

// Legacy support - keep these exports for backward compatibility
export const uploadExpenseFile = uploadAPI.uploadReceipt;
