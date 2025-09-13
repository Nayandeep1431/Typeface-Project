import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  CreditCard,
  Add as AddIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { 
  fetchTransactions, 
  setChartFilter, 
  addOptimisticTransaction,
  removeOptimisticTransaction,
  createTransaction 
} from '../features/transactions/transactionSlice';
import TransactionForm from '../components/TransactionForm';
import { 
  InteractivePieChart, 
  InteractiveLineChart, 
  InteractiveBarChart 
} from '../components/Charts/InteractiveCharts';
import { 
  FadeIn, 
  SlideIn, 
  StaggerContainer, 
  StaggerItem, 
  AnimatedCard,
  AnimatedNumber 
} from '../components/Animations/AnimatedComponents';
import { useOptimisticUpdates } from '../hooks/useOptimisticUpdates';

const StatCard = ({ title, value, icon, color, trend, trendValue, index, isOptimistic = false }) => {
  const getGradientColors = (color) => {
    switch (color) {
      case 'success':
        return 'linear-gradient(135deg, #10b981, #34d399)';
      case 'error':
        return 'linear-gradient(135deg, #ef4444, #f87171)';
      case 'primary':
        return 'linear-gradient(135deg, #2563eb, #3b82f6)';
      case 'warning':
        return 'linear-gradient(135deg, #f59e0b, #fbbf24)';
      case 'info':
        return 'linear-gradient(135deg, #06b6d4, #67e8f9)';
      default:
        return 'linear-gradient(135deg, #6b7280, #9ca3af)';
    }
  };

  return (
    <StaggerItem index={index}>
      <AnimatedCard>
        <Card 
          sx={{ 
            height: '100%', 
            borderRadius: 3,
            background: getGradientColors(color),
            position: 'relative',
            overflow: 'hidden',
            border: isOptimistic ? '2px solid #fff' : 'none',
            transition: 'all 0.3s ease-in-out',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isOptimistic 
                ? 'linear-gradient(45deg, rgba(255,255,255,0.2) 0%, transparent 50%)'
                : 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
              pointerEvents: 'none',
            }
          }}
        >
          <CardContent sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <motion.div
                animate={isOptimistic ? { rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 0.5, repeat: isOptimistic ? Infinity : 0, repeatDelay: 2 }}
              >
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mr: 2 }}>
                  {icon}
                </Avatar>
              </motion.div>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" sx={{ color: 'white', opacity: 0.9, fontWeight: 500 }}>
                  {title} {isOptimistic && '(Updating...)'}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                  ₹<AnimatedNumber value={value} />
                </Typography>
              </Box>
            </Box>
            {trendValue && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <motion.div
                    animate={{ y: [0, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    {trend === 'up' ? (
                      <TrendingUp sx={{ color: 'white', fontSize: 16, mr: 0.5 }} />
                    ) : (
                      <TrendingDown sx={{ color: 'white', fontSize: 16, mr: 0.5 }} />
                    )}
                  </motion.div>
                  <Typography variant="body2" sx={{ color: 'white', opacity: 0.9 }}>
                    {trendValue}% from last month
                  </Typography>
                </Box>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>
    </StaggerItem>
  );
};

const Dashboard = () => {
  const dispatch = useDispatch();

  // ✅ ALL HOOKS AT TOP LEVEL - FIXED
  const { 
    data: transactions = [], 
    optimisticData = {},
    realTimeStats = {}, 
    chartFilters = {}
  } = useSelector((state) => state.transactions);

  const [openForm, setOpenForm] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // ✅ MOVED useOptimisticUpdates TO TOP LEVEL - FIXED
  const {
    addOptimisticTransaction: addOptimistic,
    confirmOptimisticTransaction,
    revertOptimisticTransaction,
  } = useOptimisticUpdates();

  // ✅ All other hooks
  useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch]);

  // Combine real and optimistic data for display
  const allTransactions = [...transactions, ...Object.values(optimisticData)];

  // Calculate statistics with real-time updates
  const stats = allTransactions.reduce((acc, transaction) => {
    if (transaction.type === 'income') {
      acc.totalIncome += transaction.amount;
    } else {
      acc.totalExpenses += transaction.amount;
      if (!acc.expensesByCategory[transaction.category]) {
        acc.expensesByCategory[transaction.category] = 0;
      }
      acc.expensesByCategory[transaction.category] += transaction.amount;
    }
    return acc;
  }, {
    totalIncome: 0,
    totalExpenses: 0,
    expensesByCategory: {},
  });

  const totalBalance = stats.totalIncome - stats.totalExpenses;
  const savings = totalBalance > 0 ? totalBalance : 0;
  const hasOptimisticData = Object.keys(optimisticData).length > 0;

  // Prepare chart data (Pie chart updates automatically whenever stats changes)
  const expenseData = Object.entries(stats.expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const dailyData = {};
  allTransactions.forEach(transaction => {
    const date = dayjs(transaction.date).format('MMM DD');
    if (!dailyData[date]) {
      dailyData[date] = { date, income: 0, expenses: 0 };
    }
    if (transaction.type === 'income') {
      dailyData[date].income += transaction.amount;
    } else {
      dailyData[date].expenses += transaction.amount;
    }
    dailyData[date].net = dailyData[date].income - dailyData[date].expenses;
  });

  const trendData = Object.values(dailyData).sort((a, b) => 
    dayjs(a.date, 'MMM DD').valueOf() - dayjs(b.date, 'MMM DD').valueOf()
  );

  // Handle chart interactions
  const handlePieChartClick = (categoryName) => {
    dispatch(setChartFilter({ activeCategory: categoryName }));
    setNotification({
      open: true,
      message: categoryName 
        ? `Filtered transactions by category: ${categoryName}` // ✅ FIXED: Added backticks
        : 'Cleared category filter',
      severity: 'info'
    });
  };

  const handleLineChartClick = (data, lineKey) => {
    setNotification({
      open: true,
      message: `${data.date}: ${lineKey} = ₹${data[lineKey]?.toLocaleString('en-IN')}`, // ✅ FIXED: Added backticks
      severity: 'info'
    });
  };

  // Handle optimistic transaction creation
  const handleOptimisticCreate = async (transactionData) => {
    const tempId = `temp_${Date.now()}`; // ✅ FIXED: Added backticks
    
    try {
      const optimisticTransaction = addOptimistic(tempId, transactionData);
      dispatch(addOptimisticTransaction({ tempId, transaction: optimisticTransaction }));
      
      setNotification({
        open: true,
        message: 'Transaction added! Syncing with server...',
        severity: 'info'
      });

      const result = await dispatch(createTransaction(transactionData)).unwrap();
      confirmOptimisticTransaction(tempId, result);
      dispatch(removeOptimisticTransaction(tempId));
      
      setNotification({
        open: true,
        message: 'Transaction successfully saved!',
        severity: 'success'
      });
    } catch (error) {
      revertOptimisticTransaction(tempId);
      dispatch(removeOptimisticTransaction(tempId));
      
      setNotification({
        open: true,
        message: 'Failed to save transaction. Please try again.',
        severity: 'error'
      });
    }
  };

  return (
    <Box>
      <FadeIn>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Dashboard Overview
            {hasOptimisticData && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Typography component="span" variant="caption" sx={{ ml: 2, color: 'primary.main' }}>
                  • Syncing...
                </Typography>
              </motion.span>
            )}
          </Typography>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenForm(true)}
              sx={{ px: 3, py: 1.5 }}
            >
              Quick Add
            </Button>
          </motion.div>
        </Box>
      </FadeIn>

      {/* Stats */}
      <StaggerContainer staggerDelay={0.1}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Total Balance" 
              value={totalBalance} 
              icon={<AccountBalance />} 
              color="primary" 
              trend={totalBalance >= 0 ? "up" : "down"} 
              trendValue={12} 
              index={0} 
              isOptimistic={hasOptimisticData} 
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Total Income" 
              value={stats.totalIncome} 
              icon={<TrendingUp />} 
              color="success" 
              trend="up" 
              trendValue={8} 
              index={1} 
              isOptimistic={hasOptimisticData} 
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Total Expenses" 
              value={stats.totalExpenses} 
              icon={<TrendingDown />} 
              color="error" 
              trend="down" 
              trendValue={5} 
              index={2} 
              isOptimistic={hasOptimisticData} 
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Savings" 
              value={savings} 
              icon={<CreditCard />} 
              color="warning" 
              trend={savings > 0 ? "up" : "down"} 
              trendValue={15} 
              index={3} 
              isOptimistic={hasOptimisticData} 
            />
          </Grid>
        </Grid>
      </StaggerContainer>

      {/* Charts */}
      <SlideIn direction="up" delay={0.4}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <InteractivePieChart
              data={expenseData}
              onSegmentClick={handlePieChartClick}
              activeSegment={chartFilters.activeCategory}
              title="Expense Categories (Click to Filter)"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <InteractiveLineChart
              data={trendData}
              onPointClick={handleLineChartClick}
              title="Daily Trends (Click for Details)"
            />
          </Grid>
        </Grid>
      </SlideIn>

      {/* Recent Transactions */}
      <SlideIn direction="up" delay={0.6}>
        <AnimatedCard>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Recent Transactions
              {hasOptimisticData && (
                <Typography component="span" variant="caption" sx={{ ml: 2, color: 'primary.main' }}>
                  (Including pending updates)
                </Typography>
              )}
            </Typography>
            <AnimatePresence mode="popLayout">
              {allTransactions.slice(0, 5).map((transaction, index) => (
                <motion.div
                  key={transaction._id || transaction.tempId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  layout
                >
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      py: 2, 
                      px: 2,
                      borderBottom: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      mb: 1,
                      backgroundColor: transaction.isOptimistic ? 'action.hover' : 'transparent',
                      opacity: transaction.isOptimistic ? 0.8 : 1,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        transform: 'translateX(4px)',
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {transaction.description || transaction.category}
                        {transaction.isOptimistic && (
                          <Typography component="span" variant="caption" sx={{ ml: 1, color: 'primary.main' }}>
                            (Syncing...)
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(transaction.date).format('MMM DD, YYYY')}
                      </Typography>
                    </Box>
                    <motion.div
                      animate={transaction.isOptimistic ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1, repeat: transaction.isOptimistic ? Infinity : 0 }}
                    >
                      <Typography variant="body2" sx={{ 
                        color: transaction.type === 'income' ? 'success.main' : 'error.main',
                        fontWeight: 600 
                      }}>
                        {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                      </Typography>
                    </motion.div>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Paper>
        </AnimatedCard>
      </SlideIn>

      {/* Transaction Form */}
      <TransactionForm 
        open={openForm} 
        onClose={() => setOpenForm(false)} 
        onOptimisticSubmit={handleOptimisticCreate} 
      />

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity} 
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
