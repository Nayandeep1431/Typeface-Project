import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionAPI } from '../../services/api';

// ✅ Helper function to safely parse amount
const parseAmount = (amount) => {
  if (typeof amount === 'number' && !isNaN(amount)) return amount;
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// ✅ Helper function to validate transaction data
const validateTransaction = (transaction) => ({
  ...transaction,
  amount: parseAmount(transaction.amount),
  type: transaction.type || 'expense',
  category: transaction.category || 'Other',
  description: transaction.description || '',
  date: transaction.date || new Date().toISOString(),
});

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      console.log('🔄 Fetching transactions with params:', params);
      const response = await transactionAPI.getAll(params);
      console.log('✅ Transactions fetched successfully:', response);
      
      // ✅ Handle both direct array and nested response formats
      const transactions = response.data || response || [];
      const validatedTransactions = Array.isArray(transactions) 
        ? transactions.map(validateTransaction)
        : [];

      return {
        data: validatedTransactions,
        pagination: response.pagination || null,
        success: true
      };
    } catch (error) {
      console.error('❌ Failed to fetch transactions:', error);
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to fetch transactions'
      );
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/create',
  async (transactionData, { rejectWithValue }) => {
    try {
      console.log('🚀 Creating transaction with data:', transactionData);
      
      // ✅ Validate and format data before sending
      const validatedData = {
        amount: parseAmount(transactionData.amount),
        category: transactionData.category || '',
        description: transactionData.description || '',
        date: transactionData.date || new Date().toISOString(),
        type: transactionData.type || 'expense',
        ...(transactionData.merchant && { merchant: transactionData.merchant })
      };

      // ✅ Additional validation
      if (validatedData.amount <= 0) {
        return rejectWithValue('Amount must be greater than 0');
      }

      if (!validatedData.category.trim()) {
        return rejectWithValue('Category is required');
      }

      if (!validatedData.type || !['income', 'expense'].includes(validatedData.type)) {
        return rejectWithValue('Type must be either income or expense');
      }

      console.log('📤 Sending validated data:', validatedData);
      
      const response = await transactionAPI.create(validatedData);
      console.log('✅ Transaction created successfully:', response);
      
      // ✅ Validate response data
      const createdTransaction = validateTransaction(response.data || response);
      
      return createdTransaction;
    } catch (error) {
      console.error('❌ Transaction creation failed:', error);
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to create transaction'
      );
    }
  }
);

export const updateTransaction = createAsyncThunk(
  'transactions/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      console.log('🔄 Updating transaction:', id, data);
      
      // ✅ Validate update data
      const validatedData = {
        ...data,
        ...(data.amount && { amount: parseAmount(data.amount) }),
        ...(data.date && { date: data.date })
      };

      console.log('📤 Sending update data:', validatedData);
      
      const response = await transactionAPI.update(id, validatedData);
      console.log('✅ Transaction updated successfully:', response);
      
      const updatedTransaction = validateTransaction(response.data || response);
      
      return { 
        originalId: id, 
        transaction: updatedTransaction 
      };
    } catch (error) {
      console.error('❌ Failed to update transaction:', error);
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to update transaction'
      );
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (id, { rejectWithValue }) => {
    try {
      console.log('🗑️ Deleting transaction:', id);
      await transactionAPI.delete(id);
      console.log('✅ Transaction deleted successfully');
      return id;
    } catch (error) {
      console.error('❌ Failed to delete transaction:', error);
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to delete transaction'
      );
    }
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState: {
    data: [],
    optimisticData: {},
    pagination: null,
    isLoading: false,
    error: null,
    filters: {
      search: '',
      type: '',
      category: '',
      startDate: null,
      endDate: null,
      page: 1,
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
    },
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    clearFilters: (state) => {
      state.filters = {
        search: '',
        type: '',
        category: '',
        startDate: null,
        endDate: null,
        page: 1,
      };
      state.chartFilters = {
        activeCategory: null,
        activeDateRange: null,
      };
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
      
      // ✅ Safe stats update
      const amount = parseAmount(validatedTransaction.amount);
      if (validatedTransaction.type === 'income') {
        state.realTimeStats.totalIncome += amount;
      } else {
        state.realTimeStats.totalExpenses += amount;
      }
      state.realTimeStats.netBalance = state.realTimeStats.totalIncome - state.realTimeStats.totalExpenses;
      state.realTimeStats.transactionCount += 1;
    },
    
    updateOptimisticTransaction: (state, action) => {
      const { tempId, updates } = action.payload;
      
      if (state.optimisticData[tempId]) {
        const oldTransaction = state.optimisticData[tempId];
        const newTransaction = validateTransaction({ ...oldTransaction, ...updates });
        
        // ✅ Safe stats revert
        const oldAmount = parseAmount(oldTransaction.amount);
        const newAmount = parseAmount(newTransaction.amount);
        
        // Revert old stats
        if (oldTransaction.type === 'income') {
          state.realTimeStats.totalIncome -= oldAmount;
        } else {
          state.realTimeStats.totalExpenses -= oldAmount;
        }
        
        // Apply new stats
        if (newTransaction.type === 'income') {
          state.realTimeStats.totalIncome += newAmount;
        } else {
          state.realTimeStats.totalExpenses += newAmount;
        }
        
        state.optimisticData[tempId] = newTransaction;
        state.realTimeStats.netBalance = state.realTimeStats.totalIncome - state.realTimeStats.totalExpenses;
      }
    },
    
    removeOptimisticTransaction: (state, action) => {
      const tempId = action.payload;
      
      if (state.optimisticData[tempId]) {
        const transaction = state.optimisticData[tempId];
        
        // ✅ Safe stats revert
        const amount = parseAmount(transaction.amount);
        if (transaction.type === 'income') {
          state.realTimeStats.totalIncome -= amount;
        } else {
          state.realTimeStats.totalExpenses -= amount;
        }
        state.realTimeStats.netBalance = state.realTimeStats.totalIncome - state.realTimeStats.totalExpenses;
        state.realTimeStats.transactionCount = Math.max(0, state.realTimeStats.transactionCount - 1);
        
        delete state.optimisticData[tempId];
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
          } else if (t.type === 'expense') {
            acc.totalExpenses += amount;
          }
          acc.transactionCount++;
          return acc;
        }, { totalIncome: 0, totalExpenses: 0, transactionCount: 0 });
        
        state.realTimeStats = {
          totalIncome: stats.totalIncome,
          totalExpenses: stats.totalExpenses,
          netBalance: stats.totalIncome - stats.totalExpenses,
          transactionCount: stats.transactionCount,
        };
      } catch (error) {
        console.error('❌ Error updating real-time stats:', error);
        // Reset to safe defaults if calculation fails
        state.realTimeStats = {
          totalIncome: 0,
          totalExpenses: 0,
          netBalance: 0,
          transactionCount: 0,
        };
      }
    },
  },
  
  extraReducers: (builder) => {
    builder
      // Fetch transactions
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
        
        // Update real-time stats from fresh data
        transactionSlice.caseReducers.updateRealTimeStats(state);
        
        console.log('✅ Transactions loaded:', state.data.length, 'transactions');
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        console.error('❌ Failed to fetch transactions:', action.payload);
      })
      
      // Create transaction
      .addCase(createTransaction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.isLoading = false;
        
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
        
        console.log('✅ Transaction created and added to state:', realTransaction);
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        console.error('❌ Failed to create transaction:', action.payload);
        // Keep optimistic data for user to retry
      })
      
      // Update transaction
      .addCase(updateTransaction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        state.isLoading = false;
        
        const { originalId, transaction } = action.payload;
        const validatedTransaction = validateTransaction(transaction);
        
        // ✅ Safe array update
        const index = state.data.findIndex(t => t._id === originalId);
        if (index !== -1) {
          state.data[index] = validatedTransaction;
          console.log('✅ Transaction updated in state:', validatedTransaction);
        }
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        console.error('❌ Failed to update transaction:', action.payload);
      })
      
      // Delete transaction
      .addCase(deleteTransaction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // ✅ Safe array filtering
        const deletedId = action.payload;
        const originalLength = state.data.length;
        state.data = state.data.filter(t => t._id !== deletedId);
        
        console.log(`✅ Transaction deleted. Removed ${originalLength - state.data.length} items`);
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        console.error('❌ Failed to delete transaction:', action.payload);
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
  updateRealTimeStats
} = transactionSlice.actions;

export default transactionSlice.reducer;
