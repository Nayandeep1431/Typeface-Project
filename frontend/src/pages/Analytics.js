import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  TextField,
  Divider,
  Container,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Analytics as AnalyticsIcon,
  Assessment,
  Savings,
  AccountBalanceWallet,
  Receipt,
  CalendarToday,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { fetchTransactions } from '../features/transactions/transactionSlice';

// Currency formatter for rupees
const formatCurrency = (value) => `₹${Math.abs(value || 0).toLocaleString('en-IN')}`;

// Custom tooltip component for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 2, border: '1px solid #ccc', boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

// Statistics Card Component
const StatCard = ({ title, value, icon, color, subtitle, trend = null }) => {
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
    <Card sx={{ 
      borderRadius: 3, 
      height: '100%', 
      background: getGradientColors(color),
      transition: 'all 0.3s ease-in-out',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
      }
    }}>
      <CardContent sx={{ color: 'white', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(255,255,255,0.2)', 
            borderRadius: 2, 
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'white' }}>
          {formatCurrency(value)}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.8, color: 'white' }}>
          {subtitle}
        </Typography>
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            {trend > 0 ? <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} /> : <TrendingDown sx={{ fontSize: 16, mr: 0.5 }} />}
            <Typography variant="caption" sx={{ color: 'white' }}>
              {Math.abs(trend).toFixed(1)}% from previous period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const AnalyticsPage = () => {
  const dispatch = useDispatch();
  const { data: transactions, isLoading, error } = useSelector((state) => state.transactions);
  
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().subtract(30, 'day'),
    endDate: dayjs(),
  });

  const [filteredData, setFilteredData] = useState({
    transactions: [],
    statistics: {},
    chartData: [],
    categoryData: [],
  });

  // Fetch transactions on component mount
  useEffect(() => {
    handleDateRangeSubmit();
  }, [dispatch]);

  // Filter and analyze data when date range changes
  const handleDateRangeSubmit = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      alert('Please select both start and end dates');
      return;
    }
    
    if (dateRange.startDate.isAfter(dateRange.endDate)) {
      alert('Start date cannot be after end date');
      return;
    }

    // Fetch transactions for the selected date range
    const params = {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    };
    
    dispatch(fetchTransactions(params));
  };

  // Analyze data when transactions change
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      analyzeTransactionData();
    } else {
      // Reset data if no transactions
      setFilteredData({
        transactions: [],
        statistics: {
          totalIncome: 0,
          totalExpenses: 0,
          totalSavings: 0,
          averageExpenditure: 0,
          transactionCount: 0,
          avgDailySpending: 0,
          highestExpense: 0,
          highestIncome: 0,
        },
        chartData: [],
        categoryData: [],
      });
    }
  }, [transactions]);

  const analyzeTransactionData = () => {
    // Calculate basic statistics
    const stats = transactions.reduce((acc, transaction) => {
      const amount = parseFloat(transaction.amount) || 0;
      
      if (transaction.type === 'income') {
        acc.totalIncome += amount;
        acc.highestIncome = Math.max(acc.highestIncome, amount);
      } else if (transaction.type === 'expense') {
        acc.totalExpenses += amount;
        acc.highestExpense = Math.max(acc.highestExpense, amount);
      }
      acc.transactionCount++;
      return acc;
    }, {
      totalIncome: 0,
      totalExpenses: 0,
      highestIncome: 0,
      highestExpense: 0,
      transactionCount: 0,
    });

    // Calculate derived statistics
    stats.totalSavings = stats.totalIncome - stats.totalExpenses;
    stats.averageExpenditure = stats.totalExpenses / (stats.transactionCount > 0 ? stats.transactionCount : 1);
    
    // Calculate average daily spending
    const daysDiff = dateRange.endDate.diff(dateRange.startDate, 'day') + 1;
    stats.avgDailySpending = stats.totalExpenses / daysDiff;

    // Prepare daily chart data
    const dailyData = {};
    
    // Initialize all days in range with 0 values
    for (let d = dayjs(dateRange.startDate); d.isBefore(dateRange.endDate) || d.isSame(dateRange.endDate, 'day'); d = d.add(1, 'day')) {
      const dateKey = d.format('YYYY-MM-DD');
      dailyData[dateKey] = {
        date: d.format('MMM DD'),
        income: 0,
        expenses: 0,
        net: 0,
      };
    }

    // Fill in actual transaction data
    transactions.forEach(transaction => {
      const date = dayjs(transaction.date).format('YYYY-MM-DD');
      const amount = parseFloat(transaction.amount) || 0;
      
      if (dailyData[date]) {
        if (transaction.type === 'income') {
          dailyData[date].income += amount;
        } else if (transaction.type === 'expense') {
          dailyData[date].expenses += amount;
        }
        dailyData[date].net = dailyData[date].income - dailyData[date].expenses;
      }
    });

    const chartData = Object.values(dailyData).sort((a, b) => 
      dayjs(a.date, 'MMM DD').valueOf() - dayjs(b.date, 'MMM DD').valueOf()
    );

    // Prepare category data for pie chart
    const categoryBreakdown = {};
    transactions.forEach(transaction => {
      if (transaction.type === 'expense') {
        const category = transaction.category || 'Other';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (parseFloat(transaction.amount) || 0);
      }
    });

    const categoryData = Object.entries(categoryBreakdown)
      .map(([name, value], index) => ({
        name,
        value,
        color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'][index % 8]
      }))
      .sort((a, b) => b.value - a.value);

    setFilteredData({
      transactions,
      statistics: stats,
      chartData,
      categoryData,
    });
  };

  const resetDateRange = () => {
    setDateRange({
      startDate: dayjs().subtract(30, 'day'),
      endDate: dayjs(),
    });
  };

  if (error) {
    return (
      <Container maxWidth="xl">
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading transactions: {error}
        </Alert>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl">
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AnalyticsIcon sx={{ fontSize: 36, color: 'primary.main', mr: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Financial Analytics Dashboard
            </Typography>
          </Box>
          <Typography variant="subtitle1" color="text.secondary">
            Comprehensive analysis of your financial data with interactive charts and insights
          </Typography>
        </Box>

        {/* Date Range Selection */}
        <Paper sx={{ 
          p: 4, 
          mb: 4, 
          borderRadius: 4, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'white' }}>
            📊 Select Analysis Period
          </Typography>
          
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <DatePicker
                label="From Date"
                value={dateRange.startDate}
                onChange={(newValue) => setDateRange(prev => ({ ...prev, startDate: newValue }))}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    fullWidth 
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: 3,
                        backgroundColor: 'white'
                      } 
                    }}
                  />
                )}
                maxDate={dayjs()}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <DatePicker
                label="To Date"
                value={dateRange.endDate}
                onChange={(newValue) => setDateRange(prev => ({ ...prev, endDate: newValue }))}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    fullWidth 
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: 3,
                        backgroundColor: 'white'
                      } 
                    }}
                  />
                )}
                maxDate={dayjs()}
                minDate={dateRange.startDate}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleDateRangeSubmit}
                  disabled={isLoading}
                  sx={{ 
                    px: 4, 
                    py: 1.5,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 3,
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.3)'
                    }
                  }}
                  startIcon={<CalendarToday />}
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Period'}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={resetDateRange}
                  sx={{ 
                    px: 3, 
                    py: 1.5, 
                    borderColor: 'white', 
                    color: 'white',
                    borderRadius: 3,
                    fontWeight: 600,
                    '&:hover': { 
                      borderColor: 'grey.300', 
                      backgroundColor: 'rgba(255,255,255,0.1)' 
                    }
                  }}
                >
                  Reset
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          <Typography variant="body2" sx={{ mt: 3, color: 'white', opacity: 0.9 }}>
            📅 Period: {dateRange.startDate?.format('MMM DD, YYYY')} to {dateRange.endDate?.format('MMM DD, YYYY')} 
            ({dateRange.endDate?.diff(dateRange.startDate, 'day') + 1} days)
          </Typography>
        </Paper>

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        )}

        {/* Statistics Cards */}
        {!isLoading && (
          <>
            <Grid container spacing={3} sx={{ mb: 5 }}>
              <Grid item xs={12} sm={6} lg={3}>
                <StatCard
                  title="Total Income"
                  value={filteredData.statistics.totalIncome}
                  icon={<TrendingUp sx={{ fontSize: 28 }} />}
                  color="success"
                  subtitle={`Highest: ${formatCurrency(filteredData.statistics.highestIncome)}`}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} lg={3}>
                <StatCard
                  title="Total Expenses"
                  value={filteredData.statistics.totalExpenses}
                  icon={<TrendingDown sx={{ fontSize: 28 }} />}
                  color="error"
                  subtitle={`Highest: ${formatCurrency(filteredData.statistics.highestExpense)}`}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} lg={3}>
                <StatCard
                  title="Net Savings"
                  value={filteredData.statistics.totalSavings}
                  icon={<Savings sx={{ fontSize: 28 }} />}
                  color={filteredData.statistics.totalSavings >= 0 ? "primary" : "warning"}
                  subtitle={filteredData.statistics.totalSavings >= 0 ? "Surplus" : "Deficit"}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} lg={3}>
                <StatCard
                  title="Avg Daily Spending"
                  value={filteredData.statistics.avgDailySpending}
                  icon={<AccountBalanceWallet sx={{ fontSize: 28 }} />}
                  color="info"
                  subtitle={`${filteredData.statistics.transactionCount} transactions`}
                />
              </Grid>
            </Grid>

            {/* Additional Statistics */}
            <Paper sx={{ p: 4, mb: 5, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ mr: 1, color: 'primary.main' }} />
                Detailed Analytics
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ 
                    p: 3, 
                    bgcolor: 'linear-gradient(135deg, #e3f2fd, #bbdefb)', 
                    borderRadius: 3,
                    border: '1px solid #e3f2fd'
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                      Average Expenditure per Transaction
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {formatCurrency(filteredData.statistics.averageExpenditure)}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ 
                    p: 3, 
                    bgcolor: 'linear-gradient(135deg, #e8f5e8, #c8e6c9)', 
                    borderRadius: 3,
                    border: '1px solid #e8f5e8'
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                      Savings Rate
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {filteredData.statistics.totalIncome > 0 
                        ? `${((filteredData.statistics.totalSavings / filteredData.statistics.totalIncome) * 100).toFixed(1)}%`
                        : '0%'
                      }
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* ✅ UPDATED: All Three Charts in Same Row with Proper Alignment */}
  <Grid container spacing={4} sx={{ mb: 4 }}> {/* ✅ INCREASED spacing from 3 to 4 for better gaps */}
  {/* Daily Trend Line Chart - ✅ EQUAL WIDTH */}
  <Grid item xs={12} xl={4} lg={12}> {/* ✅ xl={4} for equal width on large screens, lg={12} for stacking on medium */}
    <Paper sx={{ 
      p: 4, // ✅ INCREASED padding from 3 to 4
      borderRadius: 4, 
      height: 550, // ✅ INCREASED height from 500 to 550
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
        <TrendingUp sx={{ mr: 1, color: 'success.main', fontSize: 22 }} />
        Daily Income & Expense Trends
      </Typography>
      
      {filteredData.chartData.length > 0 ? (
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={filteredData.chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }} // ✅ PROPER margins
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }} // ✅ INCREASED font size
                angle={-45}
                textAnchor="end"
                height={70}
                interval="preserveStartEnd"
              />
              <YAxis 
                tickFormatter={(value) => `₹${Math.abs(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }} // ✅ INCREASED font size
                width={60} // ✅ INCREASED width
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '13px', paddingTop: '15px' }}
                iconSize={14}
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#4CAF50"
                strokeWidth={3} // ✅ INCREASED stroke width
                dot={{ fill: '#4CAF50', r: 4 }}
                activeDot={{ r: 6, stroke: '#4CAF50', strokeWidth: 2 }}
                name="Income"
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#f44336"
                strokeWidth={3} // ✅ INCREASED stroke width
                dot={{ fill: '#f44336', r: 4 }}
                activeDot={{ r: 6, stroke: '#f44336', strokeWidth: 2 }}
                name="Expenses"
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#2196F3"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#2196F3', r: 3 }}
                activeDot={{ r: 5 }}
                name="Net Flow"
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: 6 // ✅ INCREASED padding
        }}>
          <TrendingUp sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No trend data available
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Select a date range with transactions to view daily trends
          </Typography>
        </Box>
      )}
    </Paper>
  </Grid>

  {/* Category Breakdown Pie Chart - ✅ EQUAL WIDTH */}
  <Grid item xs={12} xl={4} lg={6}> {/* ✅ xl={4} for equal width, lg={6} for 2 columns on medium screens */}
    <Paper sx={{ 
      p: 4, // ✅ INCREASED padding
      borderRadius: 4, 
      height: 550, // ✅ MATCHED height
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
        <Assessment sx={{ mr: 1, color: 'warning.main', fontSize: 22 }} />
        Expense Categories Breakdown
      </Typography>
      
      {filteredData.categoryData.length > 0 ? (
        <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={filteredData.categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => 
                  percent > 5 ? `${name.length > 10 ? name.substring(0, 10) + '...' : name}` : ''
                } // ✅ IMPROVED label logic
                outerRadius={140} // ✅ INCREASED radius for better visibility
                innerRadius={60}   // ✅ INCREASED inner radius
                fill="#8884d8"
                dataKey="value"
                stroke="#fff"
                strokeWidth={3}
              >
                {filteredData.categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [formatCurrency(value), name]}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #ccc', 
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: 6
        }}>
          <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No expense categories
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No expense data available for the selected period
          </Typography>
        </Box>
      )}
    </Paper>
  </Grid>

  {/* Summary Bar Chart - ✅ EQUAL WIDTH */}
  <Grid item xs={12} xl={4} lg={6}> {/* ✅ xl={4} for equal width, lg={6} for 2 columns on medium screens */}
    <Paper sx={{ 
      p: 4, // ✅ INCREASED padding
      borderRadius: 4, 
      height: 550, // ✅ MATCHED height
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
        <AnalyticsIcon sx={{ mr: 1, color: 'info.main', fontSize: 22 }} />
        Financial Summary Overview
      </Typography>
      
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={[
              { 
                name: 'Income', 
                value: filteredData.statistics.totalIncome, 
                fill: '#4CAF50',
                label: `₹${(filteredData.statistics.totalIncome / 1000).toFixed(1)}k`
              },
              { 
                name: 'Expenses', 
                value: filteredData.statistics.totalExpenses, 
                fill: '#f44336',
                label: `₹${(filteredData.statistics.totalExpenses / 1000).toFixed(1)}k`
              },
              { 
                name: 'Net Savings', 
                value: Math.abs(filteredData.statistics.totalSavings), 
                fill: filteredData.statistics.totalSavings >= 0 ? '#2196F3' : '#ff9800',
                label: `₹${(Math.abs(filteredData.statistics.totalSavings) / 1000).toFixed(1)}k`
              }
            ]}
            margin={{ top: 30, right: 30, left: 30, bottom: 60 }} // ✅ INCREASED margins
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fontWeight: 600 }} // ✅ INCREASED font size and weight
              angle={0} // ✅ STRAIGHT text for better readability
              textAnchor="middle"
              height={60}
            />
            <YAxis 
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              width={70} // ✅ INCREASED width
            />
            <Tooltip 
              formatter={(value, name) => [formatCurrency(value), name]}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #ccc', 
                borderRadius: '8px',
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
            <Bar 
              dataKey="value" 
              radius={[6, 6, 0, 0]} // ✅ INCREASED border radius
              fill={(entry) => entry.fill}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
            >
              {[
                { name: 'Income', value: filteredData.statistics.totalIncome, fill: '#4CAF50' },
                { name: 'Expenses', value: filteredData.statistics.totalExpenses, fill: '#f44336' },
                { name: 'Savings', value: Math.abs(filteredData.statistics.totalSavings), fill: filteredData.statistics.totalSavings >= 0 ? '#2196F3' : '#ff9800' }
              ].map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  </Grid>
</Grid>


            {/* ✅ ADDED: Category Legend for Better Understanding */}
            {filteredData.categoryData.length > 0 && (
              <Paper sx={{ 
                p: 3, 
                mb: 4, 
                borderRadius: 4, 
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  <Assessment sx={{ mr: 1, color: 'primary.main', fontSize: 20 }} />
                  Category Breakdown Details
                </Typography>
                
                <Grid container spacing={2}>
                  {filteredData.categoryData.slice(0, 8).map((category, index) => (
                    <Grid item xs={6} sm={4} md={3} key={category.name}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        p: 2, 
                        bgcolor: 'grey.50', 
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'grey.200'
                      }}>
                        <Box 
                          sx={{ 
                            width: 16, 
                            height: 16, 
                            bgcolor: category.color, 
                            borderRadius: 1, 
                            mr: 1.5,
                            flexShrink: 0
                          }} 
                        />
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {category.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatCurrency(category.value)} ({((category.value / filteredData.statistics.totalExpenses) * 100).toFixed(1)}%)
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
          </>
        )}
      </Container>
    </LocalizationProvider>
  );
};

export default AnalyticsPage;
