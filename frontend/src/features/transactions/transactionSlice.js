import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionAPI } from '../../services/api';

// ✅ Helper function to safely parse amount
const parseAmount = (amount) => {
  if (typeof amount === 'number' && !isNaN(amount)) return amount;
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// ✅ Helper function to validate transaction data
const validateTransaction = (transaction) => ({
  ...transaction,
  _id: transaction._id || transaction.id,
  amount: parseAmount(transaction.amount),
  type: transaction.type || 'expense',
  category: transaction.category || 'Other',
  description: transaction.description || '',
  date: transaction.date || new Date().toISOString(),
  createdAt: transaction.createdAt || new Date().toISOString(),
  updatedAt: transaction.updatedAt || new Date().toISOString(),
});

// ✅ Enhanced fetch transactions with proper error handling
export const fetchTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux: Fetching transactions with params:', params);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      // Add pagination params
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      // Add filter params
      if (params.type) queryParams.append('type', params.type);
      if (params.category) queryParams.append('category', params.category);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.search) queryParams.append('search', params.search);
      if (params.source) queryParams.append('source', params.source);
      if (params.needsReview) queryParams.append('needsReview', params.needsReview);
      
      // Add sorting params
      if (params.sort) queryParams.append('sort', params.sort);
      if (params.order) queryParams.append('order', params.order);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/transactions?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Redux: Transactions fetched successfully:', data);
      
      if (data.success) {
        // Validate all transactions
        const validatedTransactions = Array.isArray(data.data) 
          ? data.data.map(validateTransaction)
          : [];

        return {
          data: validatedTransactions,
          pagination: data.pagination || null,
          summary: data.summary || null,
          filters: data.filters || null,
          success: true
        };
      } else {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
    } catch (error) {
      console.error('❌ Redux: Failed to fetch transactions:', error);
      return rejectWithValue(error.message || 'Failed to fetch transactions');
    }
  }
);

// ✅ Enhanced create transaction
export const createTransaction = createAsyncThunk(
  'transactions/create',
  async (transactionData, { rejectWithValue }) => {
    try {
      console.log('🚀 Redux: Creating transaction with data:', transactionData);
      
      // ✅ Validate and format data before sending
      const validatedData = {
        amount: parseAmount(transactionData.amount),
        category: (transactionData.category || '').trim(),
        description: (transactionData.description || '').trim(),
        date: transactionData.date || new Date().toISOString(),
        type: (transactionData.type || 'expense').toLowerCase(),
        ...(transactionData.merchant && { merchant: transactionData.merchant.trim() }),
        ...(transactionData.source && { source: transactionData.source }),
        ...(transactionData.extractedText && { extractedText: transactionData.extractedText }),
        ...(transactionData.parsingMethod && { parsingMethod: transactionData.parsingMethod }),
        ...(transactionData.needsManualReview !== undefined && { needsManualReview: transactionData.needsManualReview }),
        ...(transactionData.fileUrl && { fileUrl: transactionData.fileUrl })
      };

      // ✅ Additional validation
      if (validatedData.amount <= 0) {
        return rejectWithValue('Amount must be greater than 0');
      }

      if (!validatedData.category.trim()) {
        return rejectWithValue('Category is required');
      }

      if (!['income', 'expense'].includes(validatedData.type)) {
        return rejectWithValue('Type must be either income or expense');
      }

      console.log('📤 Redux: Sending validated data:', validatedData);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validatedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Redux: Transaction created successfully:', data);
      
      if (data.success) {
        const createdTransaction = validateTransaction(data.data);
        return createdTransaction;
      } else {
        throw new Error(data.error || 'Failed to create transaction');
      }
    } catch (error) {
      console.error('❌ Redux: Transaction creation failed:', error);
      return rejectWithValue(error.message || 'Failed to create transaction');
    }
  }
);

// ✅ Bulk create transactions (for upload functionality)
export const createBulkTransactions = createAsyncThunk(
  'transactions/createBulk',
  async ({ transactions, source = 'bulk_upload' }, { rejectWithValue }) => {
    try {
      console.log('🚀 Redux: Creating bulk transactions:', transactions.length, 'items');
      
      // Validate transactions array
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return rejectWithValue('Transactions array is required and must not be empty');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactions, source })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Redux: Bulk transactions created successfully:', data);
      
      if (data.success) {
        const validatedTransactions = Array.isArray(data.data) 
          ? data.data.map(validateTransaction)
          : [];

        return {
          transactions: validatedTransactions,
          summary: data.summary || null
        };
      } else {
        throw new Error(data.error || 'Failed to create bulk transactions');
      }
    } catch (error) {
      console.error('❌ Redux: Bulk transaction creation failed:', error);
      return rejectWithValue(error.message || 'Failed to create bulk transactions');
    }
  }
);

// ✅ Enhanced update transaction
export const updateTransaction = createAsyncThunk(
  'transactions/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux: Updating transaction:', id, data);
      
      // ✅ Validate update data
      const validatedData = {
        ...data,
        ...(data.amount && { amount: parseAmount(data.amount) }),
        ...(data.date && { date: data.date }),
        ...(data.category && { category: data.category.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.type && { type: data.type.toLowerCase() })
      };

      console.log('📤 Redux: Sending update data:', validatedData);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validatedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Redux: Transaction updated successfully:', responseData);
      
      if (responseData.success) {
        const updatedTransaction = validateTransaction(responseData.data);
        return { 
          originalId: id, 
          transaction: updatedTransaction 
        };
      } else {
        throw new Error(responseData.error || 'Failed to update transaction');
      }
    } catch (error) {
      console.error('❌ Redux: Failed to update transaction:', error);
      return rejectWithValue(error.message || 'Failed to update transaction');
    }
  }
);

// ✅ Enhanced delete transaction
export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (id, { rejectWithValue }) => {
    try {
      console.log('🗑️ Redux: Deleting transaction:', id);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Redux: Transaction deleted successfully');
      
      if (data.success) {
        return id;
      } else {
        throw new Error(data.error || 'Failed to delete transaction');
      }
    } catch (error) {
      console.error('❌ Redux: Failed to delete transaction:', error);
      return rejectWithValue(error.message || 'Failed to delete transaction');
    }
  }
);

// ✅ Fetch transaction statistics
export const fetchTransactionStats = createAsyncThunk(
  'transactions/fetchStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      console.log('📊 Redux: Fetching transaction stats with params:', params);
      
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.groupBy) queryParams.append('groupBy', params.groupBy);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/stats?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Redux: Stats fetched successfully:', data);
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch stats');
      }
    } catch (error) {
      console.error('❌ Redux: Failed to fetch stats:', error);
      return rejectWithValue(error.message || 'Failed to fetch stats');
    }
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState: {
    data: [],
    optimisticData: {},
    pagination: null,
    summary: null,
    stats: null,
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    error: null,
    filters: {
      search: '',
      type: '',
      category: '',
      startDate: null,
      endDate: null,
      page: 1,
      limit: 50,
      sort: 'date',
      order: 'desc'
    },
    chartFilters: {
      activeCategory: null,
      activeDateRange: null,
    },
    realTimeStats: {
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      transactionCount: 0,
      incomeCount: 0,
      expenseCount: 0,
    },
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      console.log('🔧 Redux: Filters updated:', state.filters);
    },
    
    clearFilters: (state) => {
      state.filters = {
        search: '',
        type: '',
        category: '',
        startDate: null,
        endDate: null,
        page: 1,
        limit: 50,
        sort: 'date',
        order: 'desc'
      };
      state.chartFilters = {
        activeCategory: null,
        activeDateRange: null,
      };
      console.log('🧹 Redux: Filters cleared');
    },
    
    setChartFilter: (state, action) => {
      state.chartFilters = { ...state.chartFilters, ...action.payload };
      // Auto-apply chart filter to main filters
      if (action.payload.activeCategory !== undefined) {
        state.filters.category = action.payload.activeCategory || '';
        state.filters.page = 1;
      }
    },
    
    addOptimisticTransaction: (state, action) => {
      const { tempId, transaction } = action.payload;
      
      // ✅ Validate optimistic transaction data
      const validatedTransaction = validateTransaction(transaction);
      state.optimisticData[tempId] = { 
        ...validatedTransaction, 
        isOptimistic: true,
        tempId 
      };
      
      console.log('⚡ Redux: Added optimistic transaction:', tempId);
      
      // ✅ Safe stats update
      transactionSlice.caseReducers.updateRealTimeStats(state);
    },
    
    updateOptimisticTransaction: (state, action) => {
      const { tempId, updates } = action.payload;
      
      if (state.optimisticData[tempId]) {
        const oldTransaction = state.optimisticData[tempId];
        const newTransaction = validateTransaction({ ...oldTransaction, ...updates });
        
        state.optimisticData[tempId] = newTransaction;
        console.log('⚡ Redux: Updated optimistic transaction:', tempId);
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      }
    },
    
    removeOptimisticTransaction: (state, action) => {
      const tempId = action.payload;
      
      if (state.optimisticData[tempId]) {
        delete state.optimisticData[tempId];
        console.log('⚡ Redux: Removed optimistic transaction:', tempId);
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      }
    },
    
    updateRealTimeStats: (state) => {
      // ✅ Safe recalculation with validation
      try {
        const allTransactions = [
          ...state.data.map(validateTransaction), 
          ...Object.values(state.optimisticData).map(validateTransaction)
        ];
        
        const stats = allTransactions.reduce((acc, t) => {
          const amount = parseAmount(t.amount);
          if (t.type === 'income') {
            acc.totalIncome += amount;
            acc.incomeCount++;
          } else if (t.type === 'expense') {
            acc.totalExpenses += amount;
            acc.expenseCount++;
          }
          acc.transactionCount++;
          return acc;
        }, { 
          totalIncome: 0, 
          totalExpenses: 0, 
          transactionCount: 0,
          incomeCount: 0,
          expenseCount: 0
        });
        
        state.realTimeStats = {
          totalIncome: stats.totalIncome,
          totalExpenses: stats.totalExpenses,
          netBalance: stats.totalIncome - stats.totalExpenses,
          transactionCount: stats.transactionCount,
          incomeCount: stats.incomeCount,
          expenseCount: stats.expenseCount,
        };
        
        console.log('📊 Redux: Real-time stats updated:', state.realTimeStats);
      } catch (error) {
        console.error('❌ Redux: Error updating real-time stats:', error);
        // Reset to safe defaults if calculation fails
        state.realTimeStats = {
          totalIncome: 0,
          totalExpenses: 0,
          netBalance: 0,
          transactionCount: 0,
          incomeCount: 0,
          expenseCount: 0,
        };
      }
    },

    // ✅ New reducer for handling upload updates
    handleUploadSuccess: (state, action) => {
      const { transactions, stats } = action.payload;
      
      console.log('📤 Redux: Handling upload success:', transactions.length, 'transactions');
      
      // Add new transactions to the beginning of the array
      const validatedTransactions = transactions.map(validateTransaction);
      state.data = [...validatedTransactions, ...state.data];
      
      // Update stats if provided
      if (stats) {
        state.summary = { ...state.summary, ...stats };
      }
      
      // Recalculate real-time stats
      transactionSlice.caseReducers.updateRealTimeStats(state);
      
      console.log('✅ Redux: Upload success handled, new total:', state.data.length, 'transactions');
    },
  },
  
  extraReducers: (builder) => {
    builder
      // ✅ Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // ✅ Safe data assignment with validation
        const responseData = action.payload;
        state.data = Array.isArray(responseData.data) 
          ? responseData.data.map(validateTransaction)
          : [];
        state.pagination = responseData.pagination || null;
        state.summary = responseData.summary || null;
        
        // Update real-time stats from fresh data
        transactionSlice.caseReducers.updateRealTimeStats(state);
        
        console.log('✅ Redux: Transactions loaded:', state.data.length, 'transactions');
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        console.error('❌ Redux: Failed to fetch transactions:', action.payload);
      })
      
      // ✅ Create transaction
      .addCase(createTransaction.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.isCreating = false;
        
        // ✅ Safe transaction addition with validation
        const realTransaction = validateTransaction(action.payload);
        
        // Add to the beginning of the array (most recent first)
        state.data.unshift(realTransaction);
        
        // ✅ Clean up any matching optimistic data
        Object.keys(state.optimisticData).forEach(tempId => {
          const optimistic = state.optimisticData[tempId];
          const optimisticAmount = parseAmount(optimistic.amount);
          const realAmount = parseAmount(realTransaction.amount);
          
          // Match by amount, type, and category (with some tolerance for amount)
          if (Math.abs(optimisticAmount - realAmount) < 0.01 && 
              optimistic.type === realTransaction.type &&
              optimistic.category === realTransaction.category) {
            delete state.optimisticData[tempId];
          }
        });
        
        // Recalculate stats
        transactionSlice.caseReducers.updateRealTimeStats(state);
        
        console.log('✅ Redux: Transaction created and added to state:', realTransaction._id);
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
        console.error('❌ Redux: Failed to create transaction:', action.payload);
      })

      // ✅ Bulk create transactions
      .addCase(createBulkTransactions.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createBulkTransactions.fulfilled, (state, action) => {
        state.isCreating = false;
        
        const { transactions, summary } = action.payload;
        const validatedTransactions = transactions.map(validateTransaction);
        
        // Add new transactions to the beginning
        state.data = [...validatedTransactions, ...state.data];
        
        // Update summary if provided
        if (summary) {
          state.summary = { ...state.summary, ...summary };
        }
        
        // Recalculate stats
        transactionSlice.caseReducers.updateRealTimeStats(state);
        
        console.log('✅ Redux: Bulk transactions created:', validatedTransactions.length, 'items');
      })
      .addCase(createBulkTransactions.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
        console.error('❌ Redux: Failed to create bulk transactions:', action.payload);
      })
      
      // ✅ Update transaction
      .addCase(updateTransaction.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        state.isUpdating = false;
        
        const { originalId, transaction } = action.payload;
        const validatedTransaction = validateTransaction(transaction);
        
        // ✅ Safe array update
        const index = state.data.findIndex(t => t._id === originalId);
        if (index !== -1) {
          state.data[index] = validatedTransaction;
          console.log('✅ Redux: Transaction updated in state:', validatedTransaction._id);
        }
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
        console.error('❌ Redux: Failed to update transaction:', action.payload);
      })
      
      // ✅ Delete transaction
      .addCase(deleteTransaction.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.isDeleting = false;
        
        // ✅ Safe array filtering
        const deletedId = action.payload;
        const originalLength = state.data.length;
        state.data = state.data.filter(t => t._id !== deletedId);
        
        console.log(`✅ Redux: Transaction deleted. Removed ${originalLength - state.data.length} items`);
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
        console.error('❌ Redux: Failed to delete transaction:', action.payload);
      })

      // ✅ Fetch stats
      .addCase(fetchTransactionStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactionStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
        console.log('✅ Redux: Transaction stats loaded');
      })
      .addCase(fetchTransactionStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        console.error('❌ Redux: Failed to fetch stats:', action.payload);
      });
  },
});

export const { 
  clearError, 
  setFilters, 
  clearFilters, 
  setChartFilter,
  addOptimisticTransaction,
  updateOptimisticTransaction,
  removeOptimisticTransaction,
  updateRealTimeStats,
  handleUploadSuccess
} = transactionSlice.actions;

export default transactionSlice.reducer;
