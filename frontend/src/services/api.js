import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL ||"https://finance-tracker-49qx.onrender.com" || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for file uploads and AI processing
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log API requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      if (config.data && config.headers['Content-Type'] === 'application/json') {
        console.log('📤 Request data:', config.data);
      }
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token management
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
      console.log('📥 Response data:', response.data);
    }
    
    // ✅ FIXED: Ensure consistent response format
    return response;
  },
  (error) => {
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`);
      console.error('❌ Error details:', error.response?.data || error.message);
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.warn('🔐 Authentication failed, clearing tokens');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection and try again.';
    }
    
    // Enhance error information
    if (error.response?.data) {
      error.apiError = error.response.data;
    }
    
    return Promise.reject(error);
  }
);

// ✅ FIXED: Transaction API with proper response handling
export const transactionAPI = {
  create: async (transactionData) => {
    try {
      console.log('💰 Creating transaction:', transactionData.type, transactionData.amount);
      
      // ✅ Validate data before sending
      const validatedData = {
        amount: parseFloat(transactionData.amount),
        category: transactionData.category?.trim() || '',
        description: transactionData.description?.trim() || '',
        date: transactionData.date || new Date().toISOString(),
        type: transactionData.type || 'expense',
        ...(transactionData.merchant && { merchant: transactionData.merchant.trim() })
      };

      // Additional client-side validation
      if (validatedData.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (!validatedData.category) {
        throw new Error('Category is required');
      }

      if (!['income', 'expense'].includes(validatedData.type)) {
        throw new Error('Type must be either income or expense');
      }

      console.log('📤 Sending validated transaction data:', validatedData);
      
      const response = await api.post('/transactions', validatedData);
      
      // ✅ Extract data from response consistently
      const transactionData_response = response.data?.data || response.data;
      console.log('✅ Transaction created successfully:', transactionData_response);
      
      return { data: transactionData_response };
    } catch (error) {
      console.error('❌ Transaction creation failed:', error);
      throw error;
    }
  },

  getAll: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      console.log('📋 Fetching transactions:', queryString || 'no filters');
      
      const response = await api.get('/transactions', { params });
      
      // ✅ Handle different response formats
      let transactions = [];
      if (response.data?.data) {
        transactions = Array.isArray(response.data.data) ? response.data.data : [];
      } else if (Array.isArray(response.data)) {
        transactions = response.data;
      }

      console.log(`✅ Fetched ${transactions.length} transactions`);
      
      return {
        data: transactions,
        pagination: response.data?.pagination || null,
        success: true
      };
    } catch (error) {
      console.error('❌ Failed to fetch transactions:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      console.log('🔍 Fetching transaction:', id);
      const response = await api.get(`/transactions/${id}`);
      
      const transaction = response.data?.data || response.data;
      console.log('✅ Transaction fetched successfully:', transaction);
      
      return { data: transaction };
    } catch (error) {
      console.error('❌ Failed to fetch transaction:', error);
      throw error;
    }
  },

  update: async (id, transactionData) => {
    try {
      console.log('✏️ Updating transaction:', id, transactionData);
      
      // ✅ Validate update data
      const validatedData = { ...transactionData };
      
      if (validatedData.amount !== undefined) {
        validatedData.amount = parseFloat(validatedData.amount);
        if (validatedData.amount <= 0) {
          throw new Error('Amount must be greater than 0');
        }
      }

      if (validatedData.category !== undefined) {
        validatedData.category = validatedData.category.trim();
        if (!validatedData.category) {
          throw new Error('Category cannot be empty');
        }
      }

      if (validatedData.type !== undefined && !['income', 'expense'].includes(validatedData.type)) {
        throw new Error('Type must be either income or expense');
      }

      const response = await api.put(`/transactions/${id}`, validatedData);
      
      const updatedTransaction = response.data?.data || response.data;
      console.log('✅ Transaction updated successfully:', updatedTransaction);
      
      return { data: updatedTransaction };
    } catch (error) {
      console.error('❌ Failed to update transaction:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      console.log('🗑️ Deleting transaction:', id);
      const response = await api.delete(`/transactions/${id}`);
      
      console.log('✅ Transaction deleted successfully');
      return { data: response.data, success: true };
    } catch (error) {
      console.error('❌ Failed to delete transaction:', error);
      throw error;
    }
  },

  bulkCreate: async (transactions) => {
    try {
      console.log('📦 Bulk creating transactions:', transactions.length);
      
      // ✅ Validate all transactions
      const validatedTransactions = transactions.map(t => ({
        amount: parseFloat(t.amount),
        category: t.category?.trim() || '',
        description: t.description?.trim() || '',
        date: t.date || new Date().toISOString(),
        type: t.type || 'expense',
        ...(t.merchant && { merchant: t.merchant.trim() })
      }));

      const response = await api.post('/transactions/bulk', { transactions: validatedTransactions });
      
      const createdTransactions = response.data?.data || response.data?.transactions || [];
      console.log(`✅ Bulk created ${createdTransactions.length} transactions`);
      
      return { data: createdTransactions };
    } catch (error) {
      console.error('❌ Failed to bulk create transactions:', error);
      throw error;
    }
  },

  getStats: async (params = {}) => {
    try {
      console.log('📊 Fetching transaction stats');
      const response = await api.get('/transactions/stats', { params });
      
      const stats = response.data?.data || response.data;
      console.log('✅ Transaction stats fetched successfully:', stats);
      
      return { data: stats };
    } catch (error) {
      console.error('❌ Failed to fetch transaction stats:', error);
      throw error;
    }
  },
};

// ✅ ENHANCED: Upload API with better error handling
export const uploadAPI = {
  uploadReceipt: async (formData) => {
    try {
      console.log('📸 Uploading receipt for OCR processing');
      
      // ✅ Validate FormData
      if (!(formData instanceof FormData)) {
        throw new Error('Invalid file data provided');
      }

      const response = await api.post('/upload/receipt', formData, {
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

      console.log('✅ Receipt uploaded and processed successfully');
      return response;
    } catch (error) {
      console.error('❌ Receipt upload failed:', error);
      
      // ✅ Enhanced error messages for upload failures
      if (error.code === 'ECONNABORTED') {
        error.message = 'Upload timeout. Please try with a smaller file or check your connection.';
      } else if (error.response?.status === 413) {
        error.message = 'File too large. Please upload a smaller image.';
      } else if (error.response?.status === 415) {
        error.message = 'Unsupported file type. Please upload a valid image file.';
      }
      
      throw error;
    }
  },

  uploadBankStatement: async (formData) => {
    try {
      console.log('🏦 Uploading bank statement for PDF processing');
      
      // ✅ Validate FormData
      if (!(formData instanceof FormData)) {
        throw new Error('Invalid file data provided');
      }

      const response = await api.post('/upload/bank-statement', formData, {
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

      console.log('✅ Bank statement uploaded and processed successfully');
      return response;
    } catch (error) {
      console.error('❌ Bank statement upload failed:', error);
      
      // ✅ Enhanced error messages for upload failures
      if (error.code === 'ECONNABORTED') {
        error.message = 'Upload timeout. Please try with a smaller file or check your connection.';
      } else if (error.response?.status === 413) {
        error.message = 'File too large. Please upload a smaller PDF.';
      } else if (error.response?.status === 415) {
        error.message = 'Unsupported file type. Please upload a valid PDF file.';
      }
      
      throw error;
    }
  },
};

// Authentication API
export const authAPI = {
  register: async (userData) => {
    try {
      console.log('📝 Registering user:', userData.username || userData.email);
      
      // ✅ Basic validation
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }

      const response = await api.post('/auth/register', userData);
      
      const result = response.data;
      console.log('✅ User registered successfully');
      
      // ✅ Auto-store token if provided
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
      }
      
      return response;
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw error;
    }
  },

  login: async (credentials) => {
    try {
      console.log('🔐 Logging in user:', credentials.email);
      
      // ✅ Basic validation
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }

      const response = await api.post('/auth/login', credentials);
      
      const result = response.data;
      console.log('✅ User logged in successfully');
      
      // ✅ Auto-store auth data
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
      }
      
      return response;
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  },

  logout: () => {
    console.log('👋 Logging out user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear any other user-related data
    localStorage.removeItem('preferences');
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      
      const user = response.data?.user || response.data;
      console.log('✅ Current user fetched successfully');
      
      return { data: user };
    } catch (error) {
      console.error('❌ Failed to fetch current user:', error);
      throw error;
    }
  },
};

// ✅ ENHANCED: Helper functions for common operations
export const apiHelpers = {
  // Handle API errors consistently
  handleApiError: (error, defaultMessage = 'An error occurred') => {
    console.error('🚨 Handling API error:', error);
    
    // Priority order for error messages
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.details) {
      return Array.isArray(error.response.data.details) 
        ? error.response.data.details.join(', ')
        : error.response.data.details;
    }
    if (error.message) {
      return error.message;
    }
    return defaultMessage;
  },
  
  // Check if response is successful
  isSuccessResponse: (response) => {
    return response.status >= 200 && 
           response.status < 300 && 
           response.data?.success !== false;
  },

  // ✅ NEW: Extract data from API response consistently
  extractResponseData: (response) => {
    if (response.data?.data) {
      return response.data.data;
    }
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }
    return response.data;
  },

  // ✅ NEW: Format transaction data for API
  formatTransactionForAPI: (transaction) => ({
    amount: parseFloat(transaction.amount) || 0,
    category: transaction.category?.trim() || '',
    description: transaction.description?.trim() || '',
    date: transaction.date || new Date().toISOString(),
    type: transaction.type || 'expense',
    ...(transaction.merchant && { merchant: transaction.merchant.trim() })
  }),

  // ✅ NEW: Validate transaction data
  validateTransaction: (transaction) => {
    const errors = [];
    
    if (!transaction.amount || parseFloat(transaction.amount) <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    if (!transaction.category?.trim()) {
      errors.push('Category is required');
    }
    
    if (!transaction.type || !['income', 'expense'].includes(transaction.type)) {
      errors.push('Type must be either income or expense');
    }
    
    if (!transaction.date) {
      errors.push('Date is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
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

// ✅ NEW: Health check function
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    console.log('✅ API health check passed');
    return response.data;
  } catch (error) {
    console.error('❌ API health check failed:', error);
    throw error;
  }
};
