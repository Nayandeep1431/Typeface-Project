import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionAPI } from '../../services/api';

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await transactionAPI.getAll(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch transactions');
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/create',
  async (transactionData, { rejectWithValue }) => {
    try {
      const response = await transactionAPI.create(transactionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create transaction');
    }
  }
);

export const updateTransaction = createAsyncThunk(
  'transactions/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await transactionAPI.update(id, data);
      return { originalId: id, transaction: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update transaction');
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (id, { rejectWithValue }) => {
    try {
      await transactionAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete transaction');
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
      state.optimisticData[tempId] = { ...transaction, isOptimistic: true };
      // Update real-time stats
      if (transaction.type === 'income') {
        state.realTimeStats.totalIncome += transaction.amount;
      } else {
        state.realTimeStats.totalExpenses += transaction.amount;
      }
      state.realTimeStats.netBalance = state.realTimeStats.totalIncome - state.realTimeStats.totalExpenses;
      state.realTimeStats.transactionCount += 1;
    },
    updateOptimisticTransaction: (state, action) => {
      const { tempId, updates } = action.payload;
      if (state.optimisticData[tempId]) {
        const oldTransaction = state.optimisticData[tempId];
        const newTransaction = { ...oldTransaction, ...updates };
        
        // Revert old stats
        if (oldTransaction.type === 'income') {
          state.realTimeStats.totalIncome -= oldTransaction.amount;
        } else {
          state.realTimeStats.totalExpenses -= oldTransaction.amount;
        }
        
        // Apply new stats
        if (newTransaction.type === 'income') {
          state.realTimeStats.totalIncome += newTransaction.amount;
        } else {
          state.realTimeStats.totalExpenses += newTransaction.amount;
        }
        
        state.optimisticData[tempId] = newTransaction;
        state.realTimeStats.netBalance = state.realTimeStats.totalIncome - state.realTimeStats.totalExpenses;
      }
    },
    removeOptimisticTransaction: (state, action) => {
      const tempId = action.payload;
      if (state.optimisticData[tempId]) {
        const transaction = state.optimisticData[tempId];
        // Revert stats
        if (transaction.type === 'income') {
          state.realTimeStats.totalIncome -= transaction.amount;
        } else {
          state.realTimeStats.totalExpenses -= transaction.amount;
        }
        state.realTimeStats.netBalance = state.realTimeStats.totalIncome - state.realTimeStats.totalExpenses;
        state.realTimeStats.transactionCount -= 1;
        
        delete state.optimisticData[tempId];
      }
    },
    updateRealTimeStats: (state) => {
      // Recalculate stats from current data
      const allTransactions = [...state.data, ...Object.values(state.optimisticData)];
      const stats = allTransactions.reduce((acc, t) => {
        if (t.type === 'income') {
          acc.totalIncome += t.amount;
        } else {
          acc.totalExpenses += t.amount;
        }
        acc.transactionCount++;
        return acc;
      }, { totalIncome: 0, totalExpenses: 0, transactionCount: 0 });
      
      state.realTimeStats = {
        ...stats,
        netBalance: stats.totalIncome - stats.totalExpenses,
      };
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
        state.data = action.payload.data || [];
        state.pagination = action.payload.pagination;
        // Update real-time stats from fresh data
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create transaction
      .addCase(createTransaction.pending, (state) => {
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        // Remove optimistic version and add real transaction
        const realTransaction = action.payload;
        state.data.unshift(realTransaction);
        
        // Clean up any optimistic data that matches
        Object.keys(state.optimisticData).forEach(tempId => {
          const optimistic = state.optimisticData[tempId];
          if (optimistic.amount === realTransaction.amount && 
              optimistic.type === realTransaction.type &&
              optimistic.category === realTransaction.category) {
            delete state.optimisticData[tempId];
          }
        });
        
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.error = action.payload;
        // Keep optimistic data for user to retry
      })
      // Update transaction
      .addCase(updateTransaction.fulfilled, (state, action) => {
        const { originalId, transaction } = action.payload;
        const index = state.data.findIndex(t => t._id === originalId);
        if (index !== -1) {
          state.data[index] = transaction;
        }
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Delete transaction
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.data = state.data.filter(t => t._id !== action.payload);
        transactionSlice.caseReducers.updateRealTimeStats(state);
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.error = action.payload;
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
