import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Button,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  CreditCard,
  Add as AddIcon,
  FilterList,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Assessment,
  Savings,
  AccountBalanceWallet,
  CalendarToday,
  Category,
  Receipt,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchTransactions, deleteTransaction, updateTransaction } from '../features/transactions/transactionSlice';
import { transactionAPI } from '../services/api';

// ✅ FIXED: Move COLORS constant to top, before component definition
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0088fe', '#00c49f', '#ffbb28'];

// ✅ CRITICAL FIX: Enhanced format currency helper
const formatCurrency = (amount) => {
  let safeAmount;
  if (typeof amount === 'string') {
    safeAmount = parseFloat(amount) || 0;
  } else if (typeof amount === 'number') {
    safeAmount = isNaN(amount) ? 0 : amount;
  } else {
    safeAmount = 0;
  }
  return `₹${Math.abs(safeAmount).toLocaleString('en-IN')}`;
};

// ✅ CRITICAL FIX: Robust date parser for all transaction sources
const parseTransactionDate = (dateInput) => {
  if (!dateInput) return new Date();
  
  // Handle Date objects
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }
  
  // Handle string dates
  if (typeof dateInput === 'string') {
    // First try direct parsing
    let parsedDate = new Date(dateInput);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
    
    // Try various date formats
    const formats = [
      // ISO formats
      /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /^(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
      // European formats
      /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
      /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2})/, // DD-MM-YY or DD/MM/YY
    ];
    
    for (const format of formats) {
      const match = dateInput.match(format);
      if (match) {
        const [, part1, part2, part3] = match;
        
        if (format === formats[0] || format === formats[1]) {
          // YYYY-MM-DD or YYYY/MM/DD
          parsedDate = new Date(part1, part2 - 1, part3);
        } else {
          // DD-MM-YYYY formats - assuming European format
          const year = part3.length === 2 ? `20${part3}` : part3;
          parsedDate = new Date(year, part2 - 1, part1);
        }
        
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }
  }
  
  // Fallback to current date
  console.warn('⚠️ Could not parse date:', dateInput, 'using current date');
  return new Date();
};

const Dashboard = () => {
  const dispatch = useDispatch();
  
  // ✅ ALL HOOKS AT TOP LEVEL
  const { data: transactions = [], isLoading, error } = useSelector((state) => state.transactions);
  const { user } = useSelector((state) => state.auth);
  
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [timeFilter, setTimeFilter] = useState('30'); // days
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    transactionCount: 0,
    categoriesCount: 0,
    avgDailySpending: 0
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastTransactionCount, setLastTransactionCount] = useState(0);

  // ✅ Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        await dispatch(fetchTransactions()).unwrap();
        console.log('✅ Dashboard: Transactions fetched successfully');
      } catch (error) {
        console.error('❌ Dashboard: Failed to fetch transactions:', error);
      }
    };
    fetchData();
  }, [dispatch, refreshTrigger]);

  // ✅ Auto-refresh detection
  useEffect(() => {
    if (transactions.length > lastTransactionCount && lastTransactionCount > 0) {
      const newTransactionsCount = transactions.length - lastTransactionCount;
      setNotification({
        open: true,
        message: `🎉 ${newTransactionsCount} new transaction(s) added! Dashboard updated.`,
        severity: 'success'
      });
      console.log(`✅ Dashboard: Detected ${newTransactionsCount} new transactions`);
    }
    setLastTransactionCount(transactions.length);
  }, [transactions.length, lastTransactionCount]);

  // ✅ Listen for external updates
  useEffect(() => {
    const handleTransactionUpdate = (event) => {
      console.log('📥 Dashboard: Received transaction update event', event.detail);
      setRefreshTrigger(prev => prev + 1);
      
      if (event.detail && event.detail.message) {
        setNotification({
          open: true,
          message: event.detail.message,
          severity: 'success'
        });
      }
    };

    window.addEventListener('transactionUpdated', handleTransactionUpdate);
    return () => window.removeEventListener('transactionUpdated', handleTransactionUpdate);
  }, []);

  // ✅ Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Dashboard: Auto-refreshing transactions...');
      dispatch(fetchTransactions());
    }, 30000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // ✅ CRITICAL FIX: More lenient transaction filtering with spread operator
  const filteredTransactions = useMemo(() => {
    console.log('🔍 Dashboard: Starting transaction filtering...', {
      totalTransactions: transactions.length,
      selectedCategory,
      timeFilter
    });

    if (!transactions || !Array.isArray(transactions)) {
      console.warn('⚠️ Dashboard: No transactions or invalid format');
      return [];
    }

    // ✅ CRITICAL: Create a copy of transactions first to avoid read-only errors
    let filtered = [...transactions].map((t, index) => {
      // ✅ ROBUST DATE PARSING
      const normalizedDate = parseTransactionDate(t.date);
      
      // ✅ ROBUST AMOUNT PARSING
      let normalizedAmount = 0;
      try {
        if (typeof t.amount === 'number') {
          normalizedAmount = isNaN(t.amount) ? 0 : t.amount;
        } else if (typeof t.amount === 'string') {
          normalizedAmount = parseFloat(t.amount.replace(/[^\d.-]/g, '')) || 0;
        }
      } catch (error) {
        console.warn('⚠️ Amount parsing error:', error, 'for transaction:', t._id);
        normalizedAmount = 0;
      }

      const normalizedTransaction = {
        ...t,
        amount: normalizedAmount,
        date: normalizedDate,
        type: t.type || 'expense',
        category: t.category || 'Other',
        description: t.description || t.category || 'Unknown Transaction',
        source: t.source || 'manual'
      };

      return normalizedTransaction;
    });

    console.log(`✅ Dashboard: Normalized ${filtered.length} transactions`);

    // ✅ Category filtering
    if (selectedCategory !== 'all') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(t => t.category === selectedCategory);
      console.log(`🔍 Category filter (${selectedCategory}): ${beforeFilter} → ${filtered.length}`);
    }

    // ✅ EMERGENCY FIX: Very lenient time filtering (increased buffer)
    const now = new Date();
    const timeFilterDays = parseInt(timeFilter);
    
    // ✅ CRITICAL FIX: Add 2 days buffer and set to start of day
    const filterDate = new Date();
    filterDate.setDate(now.getDate() - timeFilterDays - 2); // Extra 2 days buffer
    filterDate.setHours(0, 0, 0, 0);
    
    console.log(`🕒 Time filter setup (LENIENT):`, {
      timeFilterDays: timeFilterDays,
      actualDaysBack: timeFilterDays + 2,
      filterDate: filterDate.toISOString().split('T')[0],
      now: now.toISOString().split('T')[0]
    });

    const beforeTimeFilter = filtered.length;
    filtered = filtered.filter((t, index) => {
      const transactionDate = t.date;
      const isInRange = transactionDate >= filterDate;
      
      // Debug ALL transactions that might be filtered out
      if (!isInRange) {
        console.log(`❌ FILTERED OUT:`, {
          id: t._id?.substring(0, 8),
          desc: t.description?.substring(0, 25),
          date: transactionDate.toISOString().split('T')[0],
          source: t.source,
          daysDiff: Math.ceil((now - transactionDate) / (1000 * 60 * 60 * 24))
        });
      }
      
      return isInRange;
    });

    console.log(`✅ Time filter result: ${beforeTimeFilter} → ${filtered.length} (filtered out: ${beforeTimeFilter - filtered.length})`);

    // ✅ CRITICAL FIX: Create copy before sorting
    const finalFiltered = [...filtered].sort((a, b) => b.date - a.date);

    // ✅ Final detailed summary
    const summary = {
      total: finalFiltered.length,
      sources: {},
      types: { income: 0, expense: 0 },
      totalAmount: 0,
      dateRange: {
        oldest: finalFiltered.length > 0 ? finalFiltered[finalFiltered.length - 1].date.toISOString().split('T')[0] : 'N/A',
        newest: finalFiltered.length > 0 ? finalFiltered[0].date.toISOString().split('T')[0] : 'N/A'
      }
    };

    finalFiltered.forEach(t => {
      summary.sources[t.source] = (summary.sources[t.source] || 0) + 1;
      summary.types[t.type]++;
      summary.totalAmount += t.amount;
    });

    console.log('✅ FINAL FILTERED TRANSACTIONS:', summary);

    return finalFiltered;
  }, [transactions, selectedCategory, timeFilter]);

  // ✅ EMERGENCY DEBUG: Log the filtering issue
  useEffect(() => {
    console.log('🔍 FILTERING DEBUG:', {
      totalTransactions: transactions.length,
      filteredTransactions: filteredTransactions.length,
      missingCount: transactions.length - filteredTransactions.length,
      timeFilter: timeFilter,
      selectedCategory: selectedCategory,
      
      // Show details of filtered out transactions
      filteredOutTransactions: transactions
        .filter(t => !filteredTransactions.some(ft => ft._id === t._id))
        .map(t => ({
          id: t._id?.substring(0, 8),
          amount: t.amount,
          date: t.date,
          source: t.source,
          description: t.description?.substring(0, 30),
          parsedDate: parseTransactionDate(t.date).toISOString().split('T')[0]
        }))
    });
  }, [transactions, filteredTransactions, timeFilter, selectedCategory]);

  // ✅ ENHANCED: Statistics calculation with all transactions for stats
  useEffect(() => {
    const calculateStats = () => {
      // ✅ EMERGENCY FIX: Use all transactions for statistics, not filtered ones
      const allNormalizedTransactions = [...transactions].map(t => ({
        ...t,
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0,
        date: parseTransactionDate(t.date),
        type: t.type || 'expense'
      }));

      if (!allNormalizedTransactions.length) {
        setStats({
          totalIncome: 0,
          totalExpenses: 0,
          netBalance: 0,
          transactionCount: 0,
          categoriesCount: 0,
          avgDailySpending: 0
        });
        return;
      }

      const incomeTransactions = allNormalizedTransactions.filter(t => t.type === 'income');
      const expenseTransactions = allNormalizedTransactions.filter(t => t.type === 'expense');

      const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

      const categories = new Set(allNormalizedTransactions.map(t => t.category).filter(Boolean));
      const days = parseInt(timeFilter);

      const newStats = {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        transactionCount: allNormalizedTransactions.length, // ✅ Show all transactions count
        categoriesCount: categories.size,
        avgDailySpending: totalExpenses / days
      };

      setStats(newStats);

      console.log('📊 Stats calculated (ALL TRANSACTIONS):', {
        transactions: newStats.transactionCount,
        income: formatCurrency(newStats.totalIncome),
        expenses: formatCurrency(newStats.totalExpenses),
        balance: formatCurrency(newStats.netBalance),
        incomeCount: incomeTransactions.length,
        expenseCount: expenseTransactions.length,
        sources: allNormalizedTransactions.reduce((acc, t) => {
          acc[t.source || 'manual'] = (acc[t.source || 'manual'] || 0) + 1;
          return acc;
        }, {})
      });
    };

    calculateStats();
  }, [transactions, timeFilter]); // ✅ Use transactions, not filteredTransactions

  // ✅ Category data for pie chart (use filtered for visualization)
  const categoryData = useMemo(() => {
    const categoryBreakdown = {};
    
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const category = t.category || 'Other';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + t.amount;
      });

    return Object.entries(categoryBreakdown)
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredTransactions]);

  // ✅ Chart data for trends (use filtered for visualization)
  const chartData = useMemo(() => {
    const last7Days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTransactions = filteredTransactions.filter(t => {
        const tDateStr = t.date.toISOString().split('T')[0];
        return tDateStr === dateStr;
      });
      
      const income = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      last7Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income,
        expenses,
        net: income - expenses
      });
    }
    
    return last7Days;
  }, [filteredTransactions]);

  // ✅ Event handlers
  const handleCategoryFilter = useCallback((categoryName) => {
    setSelectedCategory(categoryName === selectedCategory ? 'all' : categoryName);
    setNotification({
      open: true,
      message: categoryName 
        ? `Filtered by category: ${categoryName}`
        : 'Cleared category filter',
      severity: 'info'
    });
  }, [selectedCategory]);

  const handleMenuClick = useCallback((event, transaction) => {
    setAnchorEl(event.currentTarget);
    setSelectedTransaction(transaction);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedTransaction(null);
  }, []);

  const handleDeleteTransaction = useCallback(async () => {
    if (!selectedTransaction) return;

    try {
      setDeleteLoading(true);
      await dispatch(deleteTransaction(selectedTransaction._id)).unwrap();
      setNotification({
        open: true,
        message: 'Transaction deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      setNotification({
        open: true,
        message: `Failed to delete transaction: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setDeleteLoading(false);
      handleMenuClose();
    }
  }, [selectedTransaction, dispatch]);

  const handleNotificationClose = useCallback(() => {
    setNotification(prev => ({ ...prev, open: false }));
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      console.log('🔄 Dashboard: Manual refresh triggered');
      await dispatch(fetchTransactions()).unwrap();
      setNotification({
        open: true,
        message: `✅ Refreshed! Found ${transactions.length} transactions`,
        severity: 'success'
      });
    } catch (error) {
      setNotification({
        open: true,
        message: `❌ Refresh failed: ${error.message}`,
        severity: 'error'
      });
    }
  }, [dispatch, transactions.length]);

  // ✅ Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading dashboard: {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Welcome back, {user?.name || 'User'}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's your financial overview for the selected period
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Last updated: {new Date().toLocaleTimeString()} • {transactions.length} total • {filteredTransactions.length} in period
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              label="Time Period"
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 3 months</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="outlined"
            onClick={loadExpenses}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ minWidth: 100 }}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {/* Loading State */}
      {isLoading && <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />}

      {/* Statistics Cards */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <Grid container spacing={3} sx={{ maxWidth: '1200px' }}>
          <Grid item xs={12} sm={6} md={3}>
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              transition={{ duration: 0.2 }}
              key={`balance-${stats.netBalance}`}
              initial={{ scale: 0.95, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                height: '100%'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                      <AccountBalance />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Net Balance
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {formatCurrency(stats.netBalance)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {stats.netBalance >= 0 ? '📈 Positive' : '📉 Deficit'}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              transition={{ duration: 0.2 }}
              key={`income-${stats.totalIncome}`}
              initial={{ scale: 0.95, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                height: '100%'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                      <TrendingUp />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Total Income
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {formatCurrency(stats.totalIncome)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    All time total
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              transition={{ duration: 0.2 }}
              key={`expenses-${stats.totalExpenses}`}
              initial={{ scale: 0.95, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                height: '100%'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                      <TrendingDown />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Total Expenses
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {formatCurrency(stats.totalExpenses)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    All time total
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              transition={{ duration: 0.2 }}
              key={`count-${stats.transactionCount}`}
              initial={{ scale: 0.95, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                color: 'white',
                height: '100%'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                      <Receipt />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Transactions
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {stats.transactionCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {stats.categoriesCount} categories
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>
      </Box>

      {/* Charts */}
      <Box sx={{
        width: '75%',
        maxWidth: '1400px',
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        mb: 4,
        px: 3
      }}>
        <Grid container spacing={4} sx={{ width: '100%' }}>
          {/* Weekly Trend Chart */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ 
              p: 4, 
              borderRadius: 4, 
              height: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)'
              }
            }}>
              <Box sx={{ 
                mb: 3, 
                pb: 2, 
                borderBottom: '1px solid', 
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}>
                <Box sx={{
                  width: 8,
                  height: 40,
                  bgcolor: 'primary.main',
                  borderRadius: 1
                }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                    📈 Weekly Financial Trends
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    7-day income vs expenses analysis
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ height: 'calc(100% - 100px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value)}
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <RechartsTooltip 
                      formatter={(value, name) => [formatCurrency(value), name]}
                      labelStyle={{ color: '#333', fontWeight: 600 }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#4CAF50" 
                      strokeWidth={4}
                      dot={{ fill: '#4CAF50', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, stroke: '#4CAF50', strokeWidth: 2 }}
                      name="💰 Income"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="expenses" 
                      stroke="#f44336" 
                      strokeWidth={4}
                      dot={{ fill: '#f44336', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, stroke: '#f44336', strokeWidth: 2 }}
                      name="💸 Expenses"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="net" 
                      stroke="#2196F3" 
                      strokeWidth={3}
                      strokeDasharray="8 8"
                      dot={{ fill: '#2196F3', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#2196F3', strokeWidth: 2 }}
                      name="📊 Net Flow"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>

          {/* Category Breakdown */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ 
              p: 4, 
              borderRadius: 4, 
              height: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)'
              }
            }}>
              <Box sx={{ 
                mb: 3, 
                pb: 2, 
                borderBottom: '1px solid', 
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}>
                <Box sx={{
                  width: 8,
                  height: 40,
                  bgcolor: 'warning.main',
                  borderRadius: 1
                }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                    🎯 Expense Categories
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Spending breakdown analysis
                  </Typography>
                </Box>
              </Box>

              {categoryData.length > 0 ? (
                <Box sx={{ height: 'calc(100% - 100px)', display: 'flex', alignItems: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => 
                          percent > 5 ? `${name.length > 8 ? name.substring(0, 8) + '...' : name}` : ''
                        }
                        outerRadius={120}
                        innerRadius={50}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={3}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value, name) => [formatCurrency(value), name]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ 
                  height: 'calc(100% - 100px)',
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  py: 6
                }}>
                  <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3
                  }}>
                    <Typography variant="h3" sx={{ color: 'grey.400' }}>📊</Typography>
                  </Box>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Data Available
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    No expense data available for the selected period
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* ✅ CRITICAL FIX: Recent Transactions - Show ALL transactions without filtering */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 3, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Transactions ({transactions.length} total)
          </Typography>
          <IconButton 
            onClick={loadExpenses} 
            disabled={isLoading}
            sx={{ color: 'white' }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {transactions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Receipt sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No transactions found
              </Typography>
            </Box>
          ) : (
            <List>
              {/* ✅ CRITICAL FIX: Create a new array before sorting to avoid read-only error */}
              {[...transactions] // ✅ Create copy to avoid read-only error
                .sort((a, b) => {
                  const dateA = parseTransactionDate(a.date);
                  const dateB = parseTransactionDate(b.date);
                  return dateB - dateA; // Newest first
                })
                .slice(0, 15) // Show latest 15 transactions
                .map((transaction, index) => {
                  // Safe date parsing
                  let displayDate;
                  try {
                    displayDate = parseTransactionDate(transaction.date).toLocaleDateString();
                  } catch {
                    displayDate = 'Invalid Date';
                  }
                  
                  // Safe amount parsing
                  let displayAmount = 0;
                  try {
                    displayAmount = typeof transaction.amount === 'number' 
                      ? transaction.amount 
                      : parseFloat(transaction.amount) || 0;
                  } catch {
                    displayAmount = 0;
                  }

                  return (
                    <ListItem 
                      key={transaction._id || index}
                      sx={{ 
                        borderBottom: '1px solid #f0f0f0',
                        '&:hover': { bgcolor: 'grey.50' },
                        backgroundColor: transaction.source === 'receipt_upload' ? '#f0fff0' : 
                                         transaction.source === 'bank_statement' ? '#f0f0ff' : 'transparent'
                      }}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ 
                          bgcolor: transaction.type === 'income' ? 'success.main' : 'error.main',
                          width: 40,
                          height: 40
                        }}>
                          {transaction.type === 'income' ? <TrendingUp /> : <TrendingDown />}
                        </Avatar>
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {transaction.description || transaction.category || 'Unknown Transaction'}
                            </Typography>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 700,
                                color: transaction.type === 'income' ? 'success.main' : 'error.main'
                              }}
                            >
                              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(displayAmount)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip 
                                label={transaction.category || 'Other'} 
                                size="small" 
                                variant="outlined"
                                sx={{ cursor: 'pointer' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {displayDate}
                              </Typography>
                              {/* ✅ SOURCE INDICATOR */}
                              <Chip 
                                label={transaction.source || 'manual'}
                                size="small"
                                variant="filled"
                                sx={{ 
                                  fontSize: '0.65rem',
                                  height: '20px',
                                  bgcolor: transaction.source === 'receipt_upload' ? '#4caf50' : 
                                           transaction.source === 'bank_statement' ? '#2196f3' : '#757575',
                                  color: 'white',
                                  fontWeight: 'bold'
                                }}
                              />
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuClick(e, transaction)}
                            >
                              <MoreVert />
                            </IconButton>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
            </List>
          )}
        </Box>
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {/* Handle view */}}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {/* Handle edit */}}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteTransaction} disabled={deleteLoading}>
          <ListItemIcon>
            {deleteLoading ? <CircularProgress size={20} /> : <Delete fontSize="small" />}
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleNotificationClose} 
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
