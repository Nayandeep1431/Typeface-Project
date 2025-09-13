import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Pagination,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Fab,
  Alert,
  CircularProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  TrendingUp,
  TrendingDown,
  CalendarToday,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Clear as ClearIcon,
  TableChart as TableIcon,
  ViewModule as CardIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { 
  fetchTransactions, 
  deleteTransaction, 
  setFilters, 
  clearFilters,
  clearError 
} from '../features/transactions/transactionSlice';
import TransactionForm from '../components/TransactionForm';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import { 
  FadeIn, 
  SlideIn, 
  StaggerContainer, 
  StaggerItem, 
  AnimatedCard,
  AnimatedListItem 
} from '../components/Animations/AnimatedComponents';

const dateRangePresets = [
  { label: 'Today', getValue: () => ({ start: dayjs().startOf('day'), end: dayjs().endOf('day') }) },
  { label: 'This Week', getValue: () => ({ start: dayjs().startOf('week'), end: dayjs().endOf('week') }) },
  { label: 'This Month', getValue: () => ({ start: dayjs().startOf('month'), end: dayjs().endOf('month') }) },
  { label: 'Last Month', getValue: () => ({ start: dayjs().subtract(1, 'month').startOf('month'), end: dayjs().subtract(1, 'month').endOf('month') }) },
  { label: 'Last 3 Months', getValue: () => ({ start: dayjs().subtract(3, 'month').startOf('month'), end: dayjs().endOf('month') }) },
  { label: 'This Year', getValue: () => ({ start: dayjs().startOf('year'), end: dayjs().endOf('year') }) },
];

const categories = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities',
  'Healthcare', 'Education', 'Travel', 'Rent', 'Insurance', 'Salary', 'Freelance',
  'Investment', 'Business Income', 'Other'
];

const Transactions = () => {
  const dispatch = useDispatch();
  const { 
    data: transactions, 
    pagination, 
    isLoading, 
    error, 
    filters 
  } = useSelector((state) => state.transactions);
  
  const [openForm, setOpenForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, transaction: null });
  const [actionMenu, setActionMenu] = useState({ anchorEl: null, transaction: null });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    applyFilters();
  }, [dispatch, filters]);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const applyFilters = () => {
    const params = {
      page: filters.page,
      ...(filters.search && { search: filters.search }),
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...(filters.startDate && { startDate: filters.startDate.toISOString() }),
      ...(filters.endDate && { endDate: filters.endDate.toISOString() }),
    };
    
    dispatch(fetchTransactions(params));
  };

  const handleFilterChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value, page: 1 };
    setLocalFilters(newFilters);
    dispatch(setFilters(newFilters));
  };

  const handleDatePresetChange = (preset) => {
    if (preset) {
      const range = dateRangePresets.find(p => p.label === preset).getValue();
      const newFilters = {
        ...localFilters,
        startDate: range.start,
        endDate: range.end,
        page: 1,
      };
      setLocalFilters(newFilters);
      dispatch(setFilters(newFilters));
    }
  };

  const clearAllFilters = () => {
    setLocalFilters({
      search: '',
      type: '',
      category: '',
      startDate: null,
      endDate: null,
      page: 1,
    });
    dispatch(clearFilters());
  };

  const handleEditTransaction = (transaction) => {
    setEditTransaction(transaction);
    setOpenForm(true);
    handleCloseActionMenu();
  };

  const handleViewTransaction = (transaction) => {
    setViewTransaction(transaction);
    setOpenForm(true);
    handleCloseActionMenu();
  };

  const handleDeleteClick = (transaction) => {
    setDeleteDialog({ open: true, transaction });
    handleCloseActionMenu();
  };

  const handleDeleteConfirm = async () => {
    try {
      await dispatch(deleteTransaction(deleteDialog.transaction._id)).unwrap();
      setDeleteDialog({ open: false, transaction: null });
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditTransaction(null);
    setViewTransaction(null);
  };

  const handleActionMenuClick = (event, transaction) => {
    setActionMenu({ anchorEl: event.currentTarget, transaction });
  };

  const handleCloseActionMenu = () => {
    setActionMenu({ anchorEl: null, transaction: null });
  };

  const getTypeColor = (type) => {
    return type === 'income' ? 'success' : 'error';
  };

  const getTypeIcon = (type) => {
    return type === 'income' ? <TrendingUp /> : <TrendingDown />;
  };

  const summary = transactions.reduce((acc, transaction) => {
    if (transaction.type === 'income') {
      acc.totalIncome += transaction.amount;
    } else {
      acc.totalExpenses += transaction.amount;
    }
    return acc;
  }, { totalIncome: 0, totalExpenses: 0 });

  const netBalance = summary.totalIncome - summary.totalExpenses;

  // Transaction Card Component
  const TransactionCard = ({ transaction, index }) => (
    <StaggerItem index={index}>
      <AnimatedCard>
        <Card sx={{ borderRadius: 3, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  icon={getTypeIcon(transaction.type)}
                  label={transaction.type}
                  color={getTypeColor(transaction.type)}
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  ₹{transaction.amount.toLocaleString('en-IN')}
                </Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={(e) => handleActionMenuClick(e, transaction)}
              >
                <MoreIcon />
              </IconButton>
            </Box>
            
            <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
              {transaction.category}
            </Typography>
            
            {transaction.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {transaction.description}
              </Typography>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarToday sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" color="text.secondary">
                  {dayjs(transaction.date).format('MMM DD, YYYY hh:mm A')}
                </Typography>
              </Box>
              
              {transaction.merchant && (
                <Typography variant="caption" color="text.secondary">
                  {transaction.merchant}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </AnimatedCard>
    </StaggerItem>
  );

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <FadeIn>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Transaction Management
            </Typography>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenForm(true)}
                sx={{ px: 3, py: 1.5 }}
              >
                Add Transaction
              </Button>
            </motion.div>
          </Box>
        </FadeIn>

        {/* Summary Cards */}
        <SlideIn direction="up" delay={0.1}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <AnimatedCard>
                <Card sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }} gutterBottom>
                      Total Income
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                      ₹{summary.totalIncome.toLocaleString('en-IN')}
                    </Typography>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <AnimatedCard>
                <Card sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #ef4444, #f87171)' }}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }} gutterBottom>
                      Total Expenses
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                      ₹{summary.totalExpenses.toLocaleString('en-IN')}
                    </Typography>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <AnimatedCard>
                <Card sx={{ 
                  borderRadius: 3, 
                  background: `linear-gradient(135deg, ${netBalance >= 0 ? '#2563eb, #3b82f6' : '#f59e0b, #fbbf24'})`
                }}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }} gutterBottom>
                      Net Balance
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                      ₹{netBalance.toLocaleString('en-IN')}
                    </Typography>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </Grid>
          </Grid>
        </SlideIn>

        {/* Filters */}
        <SlideIn direction="up" delay={0.2}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Filters & Search
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={viewMode === 'card'}
                      onChange={(e) => setViewMode(e.target.checked ? 'card' : 'table')}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {viewMode === 'table' ? <TableIcon sx={{ mr: 0.5 }} /> : <CardIcon sx={{ mr: 0.5 }} />}
                      {viewMode === 'table' ? 'Table' : 'Cards'}
                    </Box>
                  }
                />
              </Box>
            </Box>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  placeholder="Search transactions..."
                  value={localFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: localFilters.search && (
                      <InputAdornment position="end">
                        <IconButton 
                          size="small" 
                          onClick={() => handleFilterChange('search', '')}
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={localFilters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="income">Income</MenuItem>
                    <MenuItem value="expense">Expense</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={localFilters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Date Range</InputLabel>
                  <Select
                    value=""
                    onChange={(e) => handleDatePresetChange(e.target.value)}
                    label="Date Range"
                  >
                    {dateRangePresets.map((preset) => (
                      <MenuItem key={preset.label} value={preset.label}>
                        {preset.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={1.5}>
                <DatePicker
                  label="Start Date"
                  value={localFilters.startDate}
                  onChange={(value) => handleFilterChange('startDate', value)}
                  renderInput={(params) => <TextField {...params} fullWidth size="small" />}
                />
              </Grid>

              <Grid item xs={12} md={1.5}>
                <DatePicker
                  label="End Date"
                  value={localFilters.endDate}
                  onChange={(value) => handleFilterChange('endDate', value)}
                  renderInput={(params) => <TextField {...params} fullWidth size="small" />}
                />
              </Grid>

              <Grid item xs={12} md={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button 
                    variant="outlined" 
                    onClick={clearAllFilters}
                    startIcon={<ClearIcon />}
                  >
                    Clear All Filters
                  </Button>
                  
                  <Typography variant="body2" color="text.secondary">
                    Showing {transactions.length} of {pagination?.total || 0} transactions
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </SlideIn>

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={40} />
          </Box>
        )}

        {/* Transactions Display */}
        {!isLoading && (
          <SlideIn direction="up" delay={0.3}>
            {viewMode === 'table' ? (
               <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                 <Table sx={{ tableLayout: 'fixed', minWidth: '800px' }}>
                   <TableHead>
                     <TableRow sx={{ backgroundColor: 'primary.main' }}>
                       <TableCell>
                         Date & Time
                       </TableCell>
                       <TableCell>
                         Description
                       </TableCell>
                       <TableCell>
                         Category
                       </TableCell>
                       <TableCell>
                         Type
                       </TableCell>
                       <TableCell>
                         Amount
                       </TableCell>
                     </TableRow>
                   </TableHead>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {transactions.map((transaction, index) => (
                        <AnimatedListItem key={transaction._id}>
                          <TableRow 
                            hover 
                            sx={{ 
                              '&:hover': { 
                                backgroundColor: 'action.hover',
                                '& .MuiTableCell-root': {
                                  borderBottomColor: 'divider'
                                }
                              }
                            }}
                          >
                            {/* Date & Time Column */}
                            <TableCell sx={{
                              minWidth: '239px',
                              verticalAlign: 'top',
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                <CalendarToday sx={{ 
                                  mr: 1.5, 
                                  color: 'text.secondary', 
                                  fontSize: 18,
                                  mt: 0.5,
                                  flexShrink: 0
                                }} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
                                    {dayjs(transaction.date).format('MMM DD, YYYY')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                    {dayjs(transaction.date).format('hh:mm A')}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            
                            {/* Description Column */}
                            <TableCell sx={{ 
                              minWidth: '235px',
                              verticalAlign: 'top'
                            }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4, mb: 0.5 }}>
                                {transaction.description || 'No description'}
                              </Typography>
                              {transaction.merchant && (
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                  {transaction.merchant}
                                </Typography>
                              )}
                            </TableCell>
                            
                            {/* Category Column */}
                            <TableCell sx={{
                              minWidth: '220px',
                              verticalAlign: 'top'
                            }}>
                              <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                                {transaction.category}
                              </Typography>
                            </TableCell>
                            
                            {/* Type Column */}
                            <TableCell sx={{
                              minWidth: '215px',
                              verticalAlign: 'top'
                            }}>
                              <Chip
                                icon={getTypeIcon(transaction.type)}
                                label={transaction.type}
                                color={getTypeColor(transaction.type)}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  fontWeight: 500,
                                  '& .MuiChip-icon': {
                                    fontSize: 16
                                  }
                                }}
                              />
                            </TableCell>
                            
                            {/* Amount Column */}
                            <TableCell align="right" sx={{
                              minWidth: '120px',
                              verticalAlign: 'top'
                            }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: transaction.type === 'income' ? 'success.main' : 'error.main',
                                  fontWeight: 600,
                                  lineHeight: 1.4,
                                  fontSize: '0.95rem'
                                }}
                              >
                                {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                              </Typography>
                            </TableCell>
                            
                            {/* Actions Column */}
                            <TableCell align="center" sx={{
                              minWidth: '80px',
                              verticalAlign: 'top'
                            }}>
                              <IconButton 
                                size="small" 
                                onClick={(e) => handleActionMenuClick(e, transaction)}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'action.hover'
                                  }
                                }}
                              >
                                <MoreIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        </AnimatedListItem>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <StaggerContainer staggerDelay={0.1}>
                {transactions.map((transaction, index) => (
                  <TransactionCard 
                    key={transaction._id} 
                    transaction={transaction} 
                    index={index} 
                  />
                ))}
              </StaggerContainer>
            )}
          </SlideIn>
        )}

        {/* Empty State */}
        {!isLoading && transactions.length === 0 && (
          <SlideIn direction="up" delay={0.3}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Typography variant="h1" sx={{ fontSize: 64, mb: 2 }}>
                  📊
                </Typography>
              </motion.div>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No transactions found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Start by adding your first transaction or adjust your filters
              </Typography>
              <Button variant="contained" onClick={() => setOpenForm(true)}>
                Add Your First Transaction
              </Button>
            </Paper>
          </SlideIn>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Pagination 
              count={pagination.totalPages} 
              page={pagination.page}
              onChange={(event, value) => handleFilterChange('page', value)}
              color="primary" 
              size="large"
              showFirstButton
              showLastButton
            />
          </Box>
        )}

        {/* Floating Action Button for Mobile */}
        <Fab
          color="primary"
          aria-label="add transaction"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: { xs: 'flex', md: 'none' }
          }}
          onClick={() => setOpenForm(true)}
        >
          <AddIcon />
        </Fab>

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenu.anchorEl}
          open={Boolean(actionMenu.anchorEl)}
          onClose={handleCloseActionMenu}
          PaperProps={{
            sx: { borderRadius: 2 }
          }}
        >
          <MenuItem onClick={() => handleViewTransaction(actionMenu.transaction)}>
            <ListItemIcon>
              <ViewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleEditTransaction(actionMenu.transaction)}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Transaction</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem 
            onClick={() => handleDeleteClick(actionMenu.transaction)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete Transaction</ListItemText>
          </MenuItem>
        </Menu>

        {/* Transaction Form Dialog */}
        <TransactionForm
          open={openForm}
          onClose={handleCloseForm}
          editData={editTransaction}
          viewMode={!!viewTransaction}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, transaction: null })}
          onConfirm={handleDeleteConfirm}
          message={deleteDialog.transaction && 
            `Are you sure you want to delete the ${deleteDialog.transaction.type} transaction of ₹${deleteDialog.transaction.amount?.toLocaleString('en-IN')} for ${deleteDialog.transaction.category}?`
          }
          isLoading={isLoading}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Transactions;
