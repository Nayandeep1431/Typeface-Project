import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Alert,
  InputAdornment,
  IconButton,
  Typography,
  Chip,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  CurrencyRupee as MoneyIcon, 
  Close as CloseIcon,
  Save as SaveIcon,
  Edit as EditIcon 
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { createTransaction, updateTransaction } from '../features/transactions/transactionSlice';

const categories = {
  income: [
    'Salary', 'Freelance', 'Investment', 'Rental Income', 'Business Income',
    'Gift Received', 'Bonus', 'Interest', 'Dividend', 'Other Income'
  ],
  expense: [
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities',
    'Healthcare', 'Education', 'Travel', 'Rent', 'Insurance', 'Groceries',
    'Fuel', 'Internet', 'Mobile', 'Clothing', 'Personal Care', 'Other Expense'
  ]
};

const TransactionForm = ({ open, onClose, editData = null, viewMode = false }) => {
  const dispatch = useDispatch();
  const { error, isLoading } = useSelector((state) => state.transactions);
  
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    description: '',
    date: dayjs(),
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (editData) {
      setFormData({
        amount: editData.amount?.toString() || '',
        type: editData.type || 'expense',
        category: editData.category || '',
        description: editData.description || '',
        date: editData.date ? dayjs(editData.date) : dayjs(),
      });
    } else {
      setFormData({
        amount: '',
        type: 'expense',
        category: '',
        description: '',
        date: dayjs(),
      });
    }
    setErrors({});
    setTouched({});
  }, [editData, open]);

  const validateField = (name, value) => {
    const newErrors = { ...errors };
    
    switch (name) {
      case 'amount':
        if (!value || parseFloat(value) <= 0) {
          newErrors.amount = 'Amount must be greater than 0';
        } else if (parseFloat(value) > 10000000) {
          newErrors.amount = 'Amount cannot exceed ₹1 crore';
        } else {
          delete newErrors.amount;
        }
        break;
      case 'type':
        if (!value) {
          newErrors.type = 'Please select transaction type';
        } else {
          delete newErrors.type;
        }
        break;
      case 'category':
        if (!value) {
          newErrors.category = 'Please select a category';
        } else {
          delete newErrors.category;
        }
        break;
      case 'description':
        if (value && value.length > 500) {
          newErrors.description = 'Description cannot exceed 500 characters';
        } else {
          delete newErrors.description;
        }
        break;
      default:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = () => {
    const fieldsToValidate = ['amount', 'type', 'category'];
    let isValid = true;
    
    fieldsToValidate.forEach(field => {
      const fieldValid = validateField(field, formData[field]);
      if (!fieldValid) isValid = false;
    });
    
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const transactionData = {
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.category,
      description: formData.description.trim(),
      date: formData.date.toISOString(),
    };

    try {
      if (editData) {
        await dispatch(updateTransaction({ id: editData._id, data: transactionData })).unwrap();
      } else {
        await dispatch(createTransaction(transactionData)).unwrap();
      }
      handleClose();
    } catch (error) {
      console.error('Transaction operation failed:', error);
    }
  };

  const handleClose = () => {
    setFormData({
      amount: '',
      type: 'expense',
      category: '',
      description: '',
      date: dayjs(),
    });
    setErrors({});
    setTouched({});
    onClose();
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'type') {
      setFormData(prev => ({ ...prev, category: '' }));
    }
    
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <DialogTitle sx={{ pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {editData ? <EditIcon sx={{ mr: 1, color: 'primary.main' }} /> : <MoneyIcon sx={{ mr: 1, color: 'primary.main' }} />}
              <Typography variant="h6">
                {viewMode ? 'Transaction Details' : editData ? 'Edit Transaction' : 'Add New Transaction'}
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleChange('amount')}
                    onBlur={handleBlur('amount')}
                    error={!!errors.amount}
                    helperText={errors.amount}
                    disabled={viewMode}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <MoneyIcon />
                        </InputAdornment>
                      ),
                      inputProps: { min: 0, step: 0.01, max: 10000000 }
                    }}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={!!errors.type}>
                    <InputLabel>Transaction Type *</InputLabel>
                    <Select
                      value={formData.type}
                      onChange={handleChange('type')}
                      onBlur={handleBlur('type')}
                      label="Transaction Type *"
                      disabled={viewMode}
                      required
                    >
                      <MenuItem value="income">
                        <Chip label="Income" color="success" size="small" sx={{ mr: 1 }} />
                        Income
                      </MenuItem>
                      <MenuItem value="expense">
                        <Chip label="Expense" color="error" size="small" sx={{ mr: 1 }} />
                        Expense
                      </MenuItem>
                    </Select>
                    {errors.type && (
                      <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5 }}>
                        {errors.type}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={!!errors.category}>
                    <InputLabel>Category *</InputLabel>
                    <Select
                      value={formData.category}
                      onChange={handleChange('category')}
                      onBlur={handleBlur('category')}
                      label="Category *"
                      disabled={!formData.type || viewMode}
                      required
                    >
                      {formData.type && categories[formData.type].map((category) => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.category && (
                      <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5 }}>
                        {errors.category}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <DateTimePicker
                    label="Date & Time"
                    value={formData.date}
                    onChange={(newValue) => setFormData(prev => ({ ...prev, date: newValue }))}
                    disabled={viewMode}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                    maxDateTime={dayjs()}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description (Optional)"
                    multiline
                    rows={3}
                    value={formData.description}
                    onChange={handleChange('description')}
                    onBlur={handleBlur('description')}
                    error={!!errors.description}
                    helperText={errors.description || `${formData.description.length}/500 characters`}
                    disabled={viewMode}
                    placeholder="Add a note about this transaction..."
                    inputProps={{ maxLength: 500 }}
                  />
                </Grid>
              </Grid>
            </DialogContent>

            {!viewMode && (
              <DialogActions sx={{ p: 3 }}>
                <Button 
                  onClick={handleClose} 
                  color="inherit"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary"
                    size="large"
                    disabled={isLoading || Object.keys(errors).length > 0}
                    startIcon={<SaveIcon />}
                  >
                    {isLoading ? 'Saving...' : editData ? 'Update Transaction' : 'Add Transaction'}
                  </Button>
                </motion.div>
              </DialogActions>
            )}
          </form>
        </motion.div>
      </Dialog>
    </LocalizationProvider>
  );
};

export default TransactionForm;
