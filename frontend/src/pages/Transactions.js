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
  MenuItem,
  Grid,
  Card,
  CardContent,
  Pagination,
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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  AlertTitle,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp,
  TrendingDown,
  CalendarToday,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import {
  fetchTransactions,
  deleteTransaction,
  updateTransaction,
  setFilters,
  clearFilters,
  clearError,
} from '../features/transactions/transactionSlice';
import TransactionForm from '../components/TransactionForm';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import {
  FadeIn,
  SlideIn,
  StaggerContainer,
  StaggerItem,
  AnimatedCard,
  AnimatedListItem,
} from '../components/Animations/AnimatedComponents';

// Date range presets definition added to fix eslint error
const dateRangePresets = [
  { label: 'Today', getValue: () => ({ start: dayjs().startOf('day'), end: dayjs().endOf('day') }) },
  { label: 'This Week', getValue: () => ({ start: dayjs().startOf('week'), end: dayjs().endOf('week') }) },
  { label: 'This Month', getValue: () => ({ start: dayjs().startOf('month'), end: dayjs().endOf('month') }) },
  { label: 'Last Month', getValue: () => ({ start: dayjs().subtract(1, 'month').startOf('month'), end: dayjs().subtract(1, 'month').endOf('month') }) },
  { label: 'Last 3 Months', getValue: () => ({ start: dayjs().subtract(3, 'month').startOf('month'), end: dayjs().endOf('month') }) },
  { label: 'This Year', getValue: () => ({ start: dayjs().startOf('year'), end: dayjs().endOf('year') }) },
];

// Date validation helper
const isFutureDate = (date) => {
  const today = dayjs().startOf('day');
  const compareDate = dayjs(date).startOf('day');
  return compareDate.isAfter(today);
};

// DateFixDialog component
const DateFixDialog = ({ open, onClose, transaction, onSave, isLoading }) => {
  const [newDate, setNewDate] = useState(null);

  useEffect(() => {
    if (transaction && open) {
      setNewDate(dayjs(transaction.date));
    }
  }, [transaction, open]);

  const handleSave = async () => {
    if (newDate && transaction) {
      await onSave(transaction._id, newDate.toISOString());
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScheduleIcon color="warning" />
        <Typography variant="h6">Fix Transaction Date</Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>Future Date Detected</AlertTitle>
            This transaction has a future date which may indicate a parsing error. Please verify and correct the date below.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current Date: {transaction && dayjs(transaction.date).format('MMMM DD, YYYY hh:mm A')}
          </Typography>

          <DatePicker
            label="Corrected Date"
            value={newDate}
            onChange={setNewDate}
            maxDate={dayjs()}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: "Select a date not later than today"
              }
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!newDate || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {isLoading ? 'Saving...' : 'Save Date'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// EnhancedPagination component
const EnhancedPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage = 10,
  totalItems = 0,
  showInfo = true,
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        mt: 4,
        py: 3,
        px: 2,
        borderRadius: 3,
        backgroundColor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Pagination Info */}
      {showInfo && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontWeight: 500,
            order: { xs: 2, sm: 1 },
          }}
        >
          Showing{' '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {startItem}
          </Box>{' '}
          -{' '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {endItem}
          </Box>{' '}
          of{' '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {totalItems}
          </Box>{' '}
          transactions
        </Typography>
      )}

      {/* Enhanced Material-UI Pagination */}
      <Pagination
        count={totalPages}
        page={currentPage}
        onChange={(e, value) => onPageChange(value)}
        color="primary"
        size="large"
        showFirstButton
        showLastButton
        siblingCount={1}
        boundaryCount={1}
        sx={{
          order: { xs: 1, sm: 2 },
          '& .MuiPaginationItem-root': {
            fontSize: '0.95rem',
            fontWeight: 500,
            minWidth: 40,
            height: 40,
            margin: '0 2px',
            borderRadius: 2,
            border: '2px solid transparent',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',

            color: 'text.primary',
            backgroundColor: 'transparent',

            '&:hover': {
              backgroundColor: 'transparent',
              borderColor: 'primary.main',
              transform: 'translateY(-1px)',
              boxShadow:
                '0 4px 12px rgba(25, 118, 210, 0.15)',
            },

            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              borderColor: 'primary.main',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(25, 118, 210, 0.25)',

              '&:hover': {
                backgroundColor: 'primary.dark',
                borderColor: 'primary.dark',
                transform: 'translateY(-1px)',
              },
            },

            '&.Mui-disabled': {
              opacity: 0.4,
              color: 'text.disabled',
              backgroundColor: 'transparent',
              borderColor: 'transparent',

              '&:hover': {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                transform: 'none',
                boxShadow: 'none',
              },
            },
          },

          '& .MuiPaginationItem-ellipsis': {
            color: 'text.secondary',
            fontSize: '1.1rem',
          },

          '& .MuiPaginationItem-icon': {
            fontSize: '1.2rem',
          },

          '& .MuiPaginationItem-previousNext': {
            '&:hover': {
              borderColor: 'secondary.main',
              boxShadow: '0 4px 12px rgba(156, 39, 176, 0.15)',
            },
          },

          '& .MuiPaginationItem-firstLast': {
            '&:hover': {
              borderColor: 'secondary.main',
              boxShadow: '0 4px 12px rgba(156, 39, 176, 0.15)',
            },
          },
        }}
      />
    </Box>
  );
};

const Transactions = () => {
  const dispatch = useDispatch();
  const { data: transactions, pagination, isLoading, error, filters } = useSelector(
    (state) => state.transactions
  );

  const [openForm, setOpenForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, transaction: null });
  const [actionMenu, setActionMenu] = useState({ anchorEl: null, transaction: null });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  const [localFilters, setLocalFilters] = useState(filters);

  const [dateFixDialog, setDateFixDialog] = useState({ open: false, transaction: null });
  const [dateFixLoading, setDateFixLoading] = useState(false);
  const [showFutureDateAlert, setShowFutureDateAlert] = useState(true);

  const futureDateTransactions = transactions.filter((transaction) => isFutureDate(transaction.date));

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
      const range = dateRangePresets.find((p) => p.label === preset).getValue();
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
      handlePageChange(1);
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

  const handleDateFixClick = (transaction) => {
    setDateFixDialog({ open: true, transaction });
    handleCloseActionMenu();
  };

  const handleDateFixSave = async (transactionId, newDate) => {
    try {
      setDateFixLoading(true);
      await dispatch(
        updateTransaction({
          id: transactionId,
          data: { date: newDate },
        })
      ).unwrap();

      applyFilters();
      setDateFixDialog({ open: false, transaction: null });
    } catch (error) {
      console.error('Date fix failed:', error);
    } finally {
      setDateFixLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleFilterChange('page', newPage);
  };

  const getTypeColor = (type) => (type === 'income' ? 'success' : 'error');
  const getTypeIcon = (type) => (type === 'income' ? <TrendingUp /> : <TrendingDown />);

  const summary = transactions.reduce(
    (acc, transaction) => {
      const amount = typeof transaction.amount === 'number' ? transaction.amount : 0;
      if (transaction.type === 'income') {
        acc.totalIncome += amount;
      } else {
        acc.totalExpenses += amount;
      }
      return acc;
    },
    { totalIncome: 0, totalExpenses: 0 }
  );

  const netBalance = summary.totalIncome - summary.totalExpenses;

  const TransactionCard = ({ transaction, index }) => {
    const hasFutureDate = isFutureDate(transaction.date);

    return (
      <StaggerItem index={index}>
        <AnimatedCard>
          <Card
            sx={{
              borderRadius: 3,
              mb: 2,
              border: hasFutureDate ? '2px solid #f44336' : '1px solid rgba(0,0,0,0.12)',
              position: 'relative',
              ...(hasFutureDate && {
                boxShadow: '0 0 0 1px rgba(244, 67, 54, 0.2), 0 1px 3px rgba(0,0,0,0.12)',
              }),
            }}
          >
            {hasFutureDate && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 1,
                }}
              >
                <Tooltip title="Future date detected - Click to fix">
                  <IconButton
                    size="small"
                    onClick={() => handleDateFixClick(transaction)}
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      color: 'error.main',
                      '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.2)' },
                    }}
                  >
                    <WarningIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
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
                    ₹{(transaction.amount ?? 0).toLocaleString('en-IN')}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={(e) => handleActionMenuClick(e, transaction)}>
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
                  <CalendarToday
                    sx={{
                      mr: 1,
                      color: hasFutureDate ? 'error.main' : 'text.secondary',
                      fontSize: 16,
                    }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="caption"
                      color={hasFutureDate ? 'error.main' : 'text.secondary'}
                      sx={{ fontWeight: hasFutureDate ? 600 : 400 }}
                    >
                      {dayjs(transaction.date).format('MMM DD, YYYY hh:mm A')}
                    </Typography>
                    {hasFutureDate && (
                      <Chip
                        label="Future"
                        size="small"
                        variant="outlined"
                        color="error"
                        sx={{
                          height: '18px',
                          fontSize: '0.65rem',
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                    )}
                  </Box>
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
  };

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
        {futureDateTransactions.length > 0 && showFutureDateAlert && (
          <Collapse in={showFutureDateAlert}>
            <Alert
              severity="warning"
              sx={{ mb: 3, borderRadius: 2 }}
              action={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      if (futureDateTransactions[0]) {
                        handleDateFixClick(futureDateTransactions[0]);
                      }
                    }}
                  >
                    Fix Dates
                  </Button>
                  <IconButton size="small" onClick={() => setShowFutureDateAlert(false)}>
                    <CloseIcon />
                  </IconButton>
                </Box>
              }
            >
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon />
                Unable to Parse Data Perfectly
              </AlertTitle>
              {futureDateTransactions.length} transaction(s) have future dates which may indicate parsing errors. Please
              review and fix the dates manually. Transactions with future dates are highlighted with red borders.
            </Alert>
          </Collapse>
        )}

        <FadeIn>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Transaction Management
            </Typography>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                <Card
                  sx={{
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${
                      netBalance >= 0 ? '#2563eb, #3b82f6' : '#f59e0b, #fbbf24'
                    })`,
                  }}
                >
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

        {/* Filters UI: (your existing UI can be placed here) */}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={48} />
            <Typography variant="body1" sx={{ ml: 2 }} color="text.secondary">
              Loading transactions...
            </Typography>
          </Box>
        )}

        {!isLoading && (
          <SlideIn direction="up" delay={0.3}>
            {viewMode === 'table' ? (
              <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Table sx={{ tableLayout: 'fixed', minWidth: '800px' }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date & Time</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Category</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Amount</TableCell>
                      <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {transactions.map((transaction) => {
                        const hasFutureDate = isFutureDate(transaction.date);

                        return (
                          <AnimatedListItem key={transaction._id}>
                            <TableRow
                              hover
                              sx={{
                                borderLeft: hasFutureDate ? '4px solid #f44336' : '4px solid transparent',
                                '&:hover': {
                                  backgroundColor: 'action.hover',
                                  '& .MuiTableCell-root': { borderBottomColor: 'divider' },
                                },
                                ...(hasFutureDate && {
                                  boxShadow: 'inset 0 0 0 1px rgba(244, 67, 54, 0.2)',
                                }),
                              }}
                            >
                              <TableCell sx={{ minWidth: '239px', verticalAlign: 'top' }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                  <CalendarToday
                                    sx={{
                                      mr: 1.5,
                                      color: hasFutureDate ? 'error.main' : 'text.secondary',
                                      fontSize: 18,
                                      mt: 0.5,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Box>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                        color: hasFutureDate ? 'error.main' : 'text.primary',
                                      }}
                                    >
                                      {dayjs(transaction.date).format('MMM DD, YYYY')}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                      <Typography
                                        variant="caption"
                                        color={hasFutureDate ? 'error.main' : 'text.secondary'}
                                        sx={{ lineHeight: 1.2 }}
                                      >
                                        {dayjs(transaction.date).format('hh:mm A')}
                                      </Typography>
                                      {hasFutureDate && (
                                        <Chip
                                          label="Future"
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          sx={{
                                            height: '16px',
                                            fontSize: '0.6rem',
                                            '& .MuiChip-label': { px: 0.5 },
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                </Box>
                              </TableCell>

                              <TableCell sx={{ minWidth: '235px', verticalAlign: 'top' }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4, mb: 0.5 }}>
                                  {transaction.description || 'No description'}
                                </Typography>
                                {transaction.merchant && (
                                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                    {transaction.merchant}
                                  </Typography>
                                )}
                              </TableCell>

                              <TableCell sx={{ minWidth: '220px', verticalAlign: 'top' }}>
                                <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                                  {transaction.category}
                                </Typography>
                              </TableCell>

                              <TableCell sx={{ minWidth: '215px', verticalAlign: 'top' }}>
                                <Chip
                                  icon={getTypeIcon(transaction.type)}
                                  label={transaction.type}
                                  color={getTypeColor(transaction.type)}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontWeight: 500,
                                    '& .MuiChip-icon': { fontSize: 16 },
                                  }}
                                />
                              </TableCell>

                              <TableCell align="right" sx={{ minWidth: '120px', verticalAlign: 'top' }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: transaction.type === 'income' ? 'success.main' : 'error.main',
                                    fontWeight: 600,
                                    lineHeight: 1.4,
                                    fontSize: '0.95rem',
                                  }}
                                >
                                  {transaction.type === 'income' ? '+' : '-'}₹
                                  {(transaction.amount ?? 0).toLocaleString('en-IN')}
                                </Typography>
                              </TableCell>

                              <TableCell align="center" sx={{ minWidth: '80px', verticalAlign: 'top' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                  {hasFutureDate && (
                                    <Tooltip title="Fix future date">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDateFixClick(transaction)}
                                        sx={{
                                          color: 'error.main',
                                          backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                          '&:hover': {
                                            backgroundColor: 'rgba(244, 67, 54, 0.2)',
                                          },
                                        }}
                                      >
                                        <WarningIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleActionMenuClick(e, transaction)}
                                    sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                                  >
                                    <MoreIcon />
                                  </IconButton>
                                </Box>
                              </TableCell>
                            </TableRow>
                          </AnimatedListItem>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <StaggerContainer staggerDelay={0.1}>
                {transactions.map((transaction, index) => (
                  <TransactionCard key={transaction._id} transaction={transaction} index={index} />
                ))}
              </StaggerContainer>
            )}
          </SlideIn>
        )}

        {!isLoading && transactions.length === 0 && (
          <SlideIn direction="up" delay={0.3}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
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

        {pagination && pagination.totalPages > 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <EnhancedPagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={pagination.limit || 10}
              totalItems={pagination.total || 0}
              showInfo={true}
            />
          </motion.div>
        )}

        <Fab color="primary" aria-label="add transaction" sx={{ position: 'fixed', bottom: 24, right: 24, display: { xs: 'flex', md: 'none' } }} onClick={() => setOpenForm(true)}>
          <AddIcon />
        </Fab>

        <Menu anchorEl={actionMenu.anchorEl} open={Boolean(actionMenu.anchorEl)} onClose={handleCloseActionMenu} PaperProps={{ sx: { borderRadius: 2 } }}>
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
          {actionMenu.transaction && isFutureDate(actionMenu.transaction.date) && (
            <>
              <Divider />
              <MenuItem onClick={() => handleDateFixClick(actionMenu.transaction)} sx={{ color: 'warning.main' }}>
                <ListItemIcon>
                  <ScheduleIcon fontSize="small" color="warning" />
                </ListItemIcon>
                <ListItemText>Fix Date</ListItemText>
              </MenuItem>
            </>
          )}
          <Divider />
          <MenuItem onClick={() => handleDeleteClick(actionMenu.transaction)} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete Transaction</ListItemText>
          </MenuItem>
        </Menu>

        <DateFixDialog open={dateFixDialog.open} onClose={() => setDateFixDialog({ open: false, transaction: null })} transaction={dateFixDialog.transaction} onSave={handleDateFixSave} isLoading={dateFixLoading} />

        <TransactionForm open={openForm} onClose={handleCloseForm} editData={editTransaction} viewMode={!!viewTransaction} />

        <DeleteConfirmDialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, transaction: null })}
          onConfirm={handleDeleteConfirm}
          message={
            deleteDialog.transaction &&
            `Are you sure you want to delete the ${deleteDialog.transaction.type} transaction of ₹${(deleteDialog.transaction.amount ?? 0).toLocaleString('en-IN')} for ${deleteDialog.transaction.category}?`
          }
          isLoading={isLoading}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Transactions;
