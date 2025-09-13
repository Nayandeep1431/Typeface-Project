import React, { useState, useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Snackbar,
  Chip,
  Avatar,
  Fade,
  Collapse,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Receipt as ReceiptIcon,
  Description as PdfIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SmartToy as AIIcon,
  Refresh as RefreshIcon,
  BugReport as DebugIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadAPI, transactionAPI } from '../services/api';
import { fetchTransactions } from '../features/transactions/transactionSlice';
import { FadeIn, SlideIn, AnimatedCard } from '../components/Animations/AnimatedComponents';

const Upload = () => {
  const dispatch = useDispatch();
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [processingStage, setProcessingStage] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Expense table state
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [updateLoading, setUpdateLoading] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    needsReviewCount: 0,
    totalItems: 0
  });

  // Load expenses on component mount
  useEffect(() => {
    loadExpenses();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    applyFiltersAndSort();
  }, [expenses, filter, sortBy, sortOrder]);

  const loadExpenses = async () => {
    try {
      setTableLoading(true);
      console.log('🔄 Loading expenses from API...');
      
      const response = await transactionAPI.getAll();
      console.log('📥 API Response:', response.data);
      
      if (response.data.success) {
        const transactionData = response.data.data || response.data.transactions || [];
        console.log(`📊 Loaded ${transactionData.length} transactions`);
        
        // Enhanced validation for each transaction
        const validatedTransactions = transactionData.map(transaction => {
          const validatedTransaction = {
            ...transaction,
            date: transaction.date ? new Date(transaction.date) : new Date(),
            amount: transaction.amount ? parseFloat(transaction.amount) : null,
            category: transaction.category || 'Other Expense',
            description: transaction.description || 'No description',
            needsManualReview: transaction.needsManualReview || 
                              !transaction.amount || 
                              transaction.amount === 0 ||
                              !transaction.category ||
                              transaction.category === 'Unknown'
          };
          
          if (validatedTransaction.needsManualReview) {
            console.log('🚨 Transaction needs review:', {
              id: transaction._id,
              description: validatedTransaction.description,
              amount: validatedTransaction.amount,
              reason: !transaction.amount ? 'No amount' : 
                     transaction.amount === 0 ? 'Zero amount' :
                     !transaction.category ? 'No category' : 'Other validation issue'
            });
          }
          
          return validatedTransaction;
        });
        
        setExpenses(validatedTransactions);
        calculateStats(validatedTransactions);
      } else {
        console.warn('⚠️ API returned success: false');
        setExpenses([]);
      }
    } catch (error) {
      console.error('❌ Error loading expenses:', error);
      setNotification({
        open: true,
        message: 'Failed to load expenses: ' + (error.response?.data?.message || error.message),
        severity: 'error'
      });
      setExpenses([]);
    } finally {
      setTableLoading(false);
    }
  };

  const calculateStats = (transactionData) => {
    const totalIncome = transactionData
      .filter(exp => exp.type === 'income' && exp.amount > 0)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    const totalExpenses = transactionData
      .filter(exp => exp.type === 'expense' && exp.amount > 0)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    const needsReviewCount = transactionData
      .filter(exp => exp.needsManualReview || !exp.amount || exp.amount === 0)
      .length;

    setStats({
      totalIncome,
      totalExpenses,
      needsReviewCount,
      totalItems: transactionData.length
    });
  };

  const applyFiltersAndSort = () => {
    let filtered = [...expenses];

    // Apply filter
    if (filter === 'income') {
      filtered = filtered.filter(exp => exp.type === 'income');
    } else if (filter === 'expense') {
      filtered = filtered.filter(exp => exp.type === 'expense');
    } else if (filter === 'needs-fix') {
      filtered = filtered.filter(exp => exp.needsManualReview || !exp.amount || exp.amount === 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortBy === 'amount') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredExpenses(filtered);
  };

  // Enhanced file upload handler for receipts
  const handleReceiptUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📁 File selected:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type
    });

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setNotification({
        open: true,
        message: '❌ Please select a valid image file (JPG, PNG, GIF)',
        severity: 'error'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotification({
        open: true,
        message: '❌ File size must be less than 10MB',
        severity: 'error'
      });
      return;
    }

    setUploading(true);
    setProcessingStage('📤 Uploading image to server...');
    setProcessingProgress(10);
    setDebugInfo(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setProcessingStage('🔍 Enhanced OCR processing with multiple passes...');
      setProcessingProgress(30);

      console.log('📤 Starting enhanced upload for:', file.name);
      const response = await uploadAPI.uploadReceipt(formData);
      console.log('✅ Upload response:', response.data);

      setProcessingStage('🤖 AI parsing with Google Gemini 1.5 Flash...');
      setProcessingProgress(60);

      await new Promise(resolve => setTimeout(resolve, 1500));

      setProcessingStage('💾 Saving validated data to database...');
      setProcessingProgress(85);

      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingProgress(100);

      const result = response.data;
      if (result.success) {
        let processedCount = 0;
        let needsReviewCount = 0;
        
        if (result.expenses && result.expenses.length > 0) {
          processedCount = result.expenses.length;
          needsReviewCount = result.stats?.needsManualAmount || 0;
        }

        // Store debug information
        setDebugInfo({
          ocrMethod: result.stats?.ocrMethod || 'Unknown',
          parsingMethod: result.stats?.parsingMethod || 'Unknown',
          textLength: result.stats?.textLength || 0,
          processingTime: result.stats?.processingTime || 0,
          ocrPreview: result.ocrPreview || '',
          rawOcrText: result.rawOcrText || '',
          fileUrl: result.fileUrl
        });

        // Add to upload history
        setUploadResults(prev => [...prev, {
          id: Date.now(),
          type: 'receipt',
          filename: file.name,
          status: 'success',
          message: `Processed ${processedCount} expense(s)`,
          fileUrl: result.fileUrl,
          stats: result.stats,
          expenses: result.expenses,
          timestamp: new Date().toISOString()
        }]);

        // Refresh the expenses list
        await loadExpenses();
        dispatch(fetchTransactions());

        // Show detailed success message
        let message = `🎉 Receipt processed successfully!`;
        if (processedCount > 0) {
          message += ` Found ${processedCount} expense(s).`;
          if (needsReviewCount > 0) {
            message += ` ${needsReviewCount} need manual review.`;
          }
        }

        setNotification({
          open: true,
          message: message,
          severity: processedCount > 0 ? 'success' : 'warning'
        });

      } else {
        throw new Error(result.message || 'Processing failed');
      }

    } catch (error) {
      console.error('❌ Receipt upload error:', error);
      
      setUploadResults(prev => [...prev, {
        id: Date.now(),
        type: 'receipt',
        filename: file.name,
        status: 'error',
        message: error.response?.data?.error || error.message,
        timestamp: new Date().toISOString()
      }]);

      setNotification({
        open: true,
        message: `❌ Receipt upload failed: ${error.response?.data?.error || error.response?.data?.message || error.message}`,
        severity: 'error'
      });
    } finally {
      setUploading(false);
      setProcessingStage('');
      setProcessingProgress(0);
      event.target.value = '';
    }
  }, [dispatch]);

  // Enhanced file upload handler for bank statements
  const handleStatementUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setNotification({
        open: true,
        message: '❌ Please select a valid PDF file',
        severity: 'error'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotification({
        open: true,
        message: '❌ File size must be less than 10MB',
        severity: 'error'
      });
      return;
    }

    setUploading(true);
    setProcessingStage('📤 Uploading PDF to server...');
    setProcessingProgress(10);
    setDebugInfo(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setProcessingStage('📄 Enhanced PDF text extraction...');
      setProcessingProgress(40);

      const response = await uploadAPI.uploadBankStatement(formData);
      console.log('✅ Bank statement response:', response.data);

      setProcessingStage('🤖 AI parsing transactions...');
      setProcessingProgress(70);

      await new Promise(resolve => setTimeout(resolve, 1500));

      setProcessingStage('💾 Saving to database...');
      setProcessingProgress(90);

      await new Promise(resolve => setTimeout(resolve, 500));
      setProcessingProgress(100);

      const result = response.data;
      if (result.success) {
        const processedCount = result.transactions?.length || 0;
        const needsReviewCount = result.stats?.needsManualAmount || 0;

        // Store debug information
        setDebugInfo({
          extractionMethod: result.stats?.extractionMethod || 'Unknown',
          parsingMethod: result.stats?.parsingMethod || 'Unknown',
          textLength: result.rawOcrText?.length || 0,
          processingTime: result.stats?.processingTime || 0,
          ocrPreview: result.ocrPreview || '',
          rawOcrText: result.rawOcrText || '',
          fileUrl: result.fileUrl
        });

        // Add to upload history
        setUploadResults(prev => [...prev, {
          id: Date.now(),
          type: 'statement',
          filename: file.name,
          status: 'success',
          message: `Imported ${processedCount} transaction(s)`,
          fileUrl: result.fileUrl,
          stats: result.stats,
          transactions: result.transactions,
          timestamp: new Date().toISOString()
        }]);

        // Refresh the expenses list
        await loadExpenses();
        dispatch(fetchTransactions());

        setNotification({
          open: true,
          message: `🏦 Bank statement processed! Imported ${processedCount} transaction(s).${needsReviewCount > 0 ? ` ${needsReviewCount} need review.` : ''}`,
          severity: 'success'
        });
      }

    } catch (error) {
      console.error('❌ Statement upload error:', error);
      
      setUploadResults(prev => [...prev, {
        id: Date.now(),
        type: 'statement',
        filename: file.name,
        status: 'error',
        message: error.response?.data?.error || error.message,
        timestamp: new Date().toISOString()
      }]);

      setNotification({
        open: true,
        message: `❌ Bank statement upload failed: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setUploading(false);
      setProcessingStage('');
      setProcessingProgress(0);
      event.target.value = '';
    }
  }, [dispatch]);

  // Enhanced expense management functions
  const handleEdit = (expense) => {
    setEditingId(expense._id);
    setEditingValues({
      amount: expense.amount || '',
      category: expense.category,
      description: expense.description
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editingValues.amount || editingValues.amount <= 0) {
      setNotification({
        open: true,
        message: 'Please enter a valid amount greater than 0',
        severity: 'warning'
      });
      return;
    }

    setUpdateLoading(id);
    try {
      const response = await transactionAPI.update(id, {
        ...editingValues,
        amount: parseFloat(editingValues.amount),
        needsManualReview: false
      });
      
      if (response.data.success) {
        // Refresh the list
        await loadExpenses();
        setEditingId(null);
        setEditingValues({});
        
        // Success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed; top: 20px; right: 20px; background: #d4edda; 
          color: #155724; padding: 15px; border-radius: 8px; z-index: 1000;
          border: 1px solid #c3e6cb; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          font-family: system-ui, sans-serif;
        `;
        notification.innerHTML = `
          <strong>✅ Updated Successfully!</strong><br>
          ${editingValues.category} - ₹${editingValues.amount}
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 3000);

        dispatch(fetchTransactions());
      }
    } catch (error) {
      console.error('❌ Update failed:', error);
      setNotification({
        open: true,
        message: `Failed to update expense: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setUpdateLoading(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleDelete = async (expense) => {
    const confirmMessage = `Are you sure you want to delete this expense?\n\n` +
      `Date: ${new Date(expense.date).toLocaleDateString()}\n` +
      `Category: ${expense.category}\n` +
      `Amount: ₹${expense.amount || 'N/A'}`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteLoading(expense._id);
    
    try {
      await transactionAPI.delete(expense._id);
      await loadExpenses(); // Refresh the list
      dispatch(fetchTransactions());
      
      setNotification({
        open: true,
        message: 'Expense deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('❌ Delete failed:', error);
      setNotification({
        open: true,
        message: `Failed to delete expense: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const categories = [
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
    'Groceries', 'Other Expense', 'Income'
  ];

  return (
    <Box>
      <FadeIn>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          🚀 Intelligent File Upload
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Upload receipts and bank statements for automatic expense extraction using advanced OCR and AI technology.
        </Typography>
      </FadeIn>

      {/* Upload Cards - Side by Side */}
      <SlideIn direction="up" delay={0.1}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <AnimatedCard>
              <Card sx={{ 
                borderRadius: 3, 
                height: '100%',
                background: uploading ? 'linear-gradient(135deg, #e3f2fd, #bbdefb)' : 'linear-gradient(135deg, #f8f9ff, #ffffff)',
                transition: 'all 0.3s ease',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                '&:hover': {
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                  transform: 'translateY(-2px)',
                }
              }}>
                <CardContent sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <motion.div
                    animate={uploading ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 2, repeat: uploading ? Infinity : 0 }}
                    style={{ marginBottom: 16 }}
                  >
                    <ReceiptIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                  </motion.div>
                  
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    📱 Upload Receipt Images
                  </Typography>
                  
                  <Box sx={{ mb: 3, flexGrow: 1 }}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'primary.main', 
                      color: 'white',
                      borderRadius: 2,
                      mb: 2
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Supported File Formats
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        JPG • PNG • GIF
                      </Typography>
                    </Paper>
                    
                    <Typography variant="body2" color="text.secondary">
                      Advanced multi-pass OCR with Google Gemini AI parsing
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mt: 'auto' }}>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="receipt-upload"
                      type="file"
                      onChange={handleReceiptUpload}
                      disabled={uploading}
                    />
                    <label htmlFor="receipt-upload">
                      <Button
                        variant="contained"
                        component="span"
                        startIcon={<UploadIcon />}
                        size="large"
                        disabled={uploading}
                        sx={{ px: 3, py: 1.5, fontWeight: 600 }}
                      >
                        {uploading ? 'Processing...' : 'Select Receipt Image'}
                      </Button>
                    </label>

                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                      Maximum file size: 10MB
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </AnimatedCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <AnimatedCard>
              <Card sx={{ 
                borderRadius: 3, 
                height: '100%',
                background: uploading ? 'linear-gradient(135deg, #f3e5f5, #e1bee7)' : 'linear-gradient(135deg, #fff8e1, #ffffff)',
                transition: 'all 0.3s ease',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                '&:hover': {
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                  transform: 'translateY(-2px)',
                }
              }}>
                <CardContent sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <motion.div
                    animate={uploading ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                    transition={{ duration: 1.5, repeat: uploading ? Infinity : 0 }}
                    style={{ marginBottom: 16 }}
                  >
                    <PdfIcon sx={{ fontSize: 48, color: 'secondary.main' }} />
                  </motion.div>
                  
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    🏦 Upload PDF Statements
                  </Typography>
                  
                  <Box sx={{ mb: 3, flexGrow: 1 }}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'secondary.main', 
                      color: 'white',
                      borderRadius: 2,
                      mb: 2
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Supported File Format
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        PDF
                      </Typography>
                    </Paper>
                    
                    <Typography variant="body2" color="text.secondary">
                      Google Vision API with intelligent transaction parsing
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mt: 'auto' }}>
                    <input
                      accept=".pdf"
                      style={{ display: 'none' }}
                      id="statement-upload"
                      type="file"
                      onChange={handleStatementUpload}
                      disabled={uploading}
                    />
                    <label htmlFor="statement-upload">
                      <Button
                        variant="contained"
                        component="span"
                        startIcon={<UploadIcon />}
                        size="large"
                        disabled={uploading}
                        color="secondary"
                        sx={{ px: 3, py: 1.5, fontWeight: 600 }}
                      >
                        {uploading ? 'Processing...' : 'Select PDF Statement'}
                      </Button>
                    </label>

                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                      Maximum file size: 10MB
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </AnimatedCard>
          </Grid>
        </Grid>
      </SlideIn>

      {/* Processing Status */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Paper sx={{ p: 3, mb: 4, borderRadius: 3, background: 'linear-gradient(135deg, #e8f5e8, #c8e6c9)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <AIIcon />
                  </Avatar>
                </motion.div>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {processingStage}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Processing with advanced OCR and AI parsing...
                  </Typography>
                </Box>
                <Chip 
                  label={`${processingProgress}%`} 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
              
              <LinearProgress 
                variant="determinate" 
                value={processingProgress}
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                  }
                }}
              />
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Information Panel */}
      {debugInfo && (
        <SlideIn direction="up" delay={0.2}>
          <Paper sx={{ mb: 4, borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'info.main', 
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DebugIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Processing Information
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                {showDebugInfo ? 'Hide Details' : 'Show Details'}
              </Button>
            </Box>
            
            <Collapse in={showDebugInfo}>
              <Box sx={{ p: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      📊 Processing Stats
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      OCR Method: {debugInfo.ocrMethod || debugInfo.extractionMethod}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      Parsing Method: {debugInfo.parsingMethod || 'PDF Processing'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      Text Length: {debugInfo.textLength} characters
                    </Typography>
                    <Typography variant="body2">
                      Processing Time: {debugInfo.processingTime}ms
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      📄 Extracted Text Preview
                    </Typography>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'grey.100', 
                      maxHeight: 150, 
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      {debugInfo.ocrPreview || 'No preview available'}
                    </Paper>
                  </Grid>
                </Grid>
                
                {debugInfo.fileUrl && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      📎 Uploaded File
                    </Typography>
                    <a 
                      href={debugInfo.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <Chip 
                        icon={<ViewIcon />}
                        label="View Original File in Cloudinary"
                        clickable
                        color="primary"
                      />
                    </a>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Paper>
        </SlideIn>
      )}

      {/* Your Expenses Table - Vanilla Style */}
      <SlideIn direction="up" delay={0.3}>
        <div style={{ marginTop: '32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '24px', marginRight: '8px' }}>📊</span>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#333' }}>Your Expenses</h2>
            </div>
            <button
              onClick={loadExpenses}
              disabled={tableLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: tableLoading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: tableLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshIcon style={{ fontSize: '16px' }} />
              {tableLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Enhanced Manual Review Alert */}
          {stats.needsReviewCount > 0 && (
            <Fade in={true}>
              <div style={{
                marginBottom: '25px',
                padding: '20px',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                border: '3px solid #dc3545',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(220, 53, 69, 0.2)',
                animation: 'pulse 2s infinite'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '28px', marginRight: '12px' }}>🚨</span>
                  <strong style={{ fontSize: '20px' }}>PARSING INCOMPLETE - MANUAL REVIEW REQUIRED</strong>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                  <strong>{stats.needsReviewCount}</strong> transaction{stats.needsReviewCount > 1 ? 's' : ''} could not be fully processed from the uploaded document.
                </p>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
                  The OCR or AI parsing encountered issues with amount extraction or data recognition. 
                  Please review and manually enter the missing information using the 
                  <span style={{ 
                    backgroundColor: '#dc3545', 
                    color: 'white', 
                    padding: '3px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    margin: '0 4px',
                    fontWeight: 'bold'
                  }}>🚨 FIX</span>
                  buttons below.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}>
                    {stats.needsReviewCount} Need Review
                  </span>
                  <span style={{
                    backgroundColor: 'transparent',
                    color: '#721c24',
                    padding: '6px 12px',
                    border: '2px solid #dc3545',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}>
                    Look for red-bordered rows
                  </span>
                </div>
              </div>
            </Fade>
          )}

          {/* Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>
                  Filter:
                </label>
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '2px solid #ddd',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  <option value="all">All Expenses</option>
                  <option value="expense">Expenses Only</option>
                  <option value="income">Income Only</option>
                  {stats.needsReviewCount > 0 && (
                    <option value="needs-fix">🚨 Needs Fix ({stats.needsReviewCount})</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>
                  Sort:
                </label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '2px solid #ddd',
                    marginRight: '8px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="category">Category</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>

            {/* Enhanced Summary */}
            <div style={{ fontSize: '14px', color: '#666', textAlign: 'right' }}>
              <div style={{ marginBottom: '4px' }}>📊 Total: {filteredExpenses.length} items</div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span style={{ 
                  color: '#dc3545', 
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  💸 ₹{stats.totalExpenses.toLocaleString('en-IN')}
                </span>
                <span style={{ 
                  color: '#28a745',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  💰 ₹{stats.totalIncome.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Table or Empty State */}
          {tableLoading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 40px', 
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e3f2fd',
                  borderTop: '4px solid #1976d2',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}></div>
              </div>
              <h3>Loading expenses...</h3>
              <p>Please wait while we fetch your transaction data.</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 40px', 
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              border: '2px dashed #ddd'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '24px' }}>
                {expenses.length === 0 ? 'No expenses found' : 'No matching expenses'}
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '16px' }}>
                {expenses.length === 0 
                  ? 'Upload a receipt or bank statement to get started with tracking your expenses!'
                  : 'Try adjusting your filters to see more results.'
                }
              </p>
              {expenses.length === 0 && (
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="receipt-upload">
                    <button style={{
                      padding: '12px 24px',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      📱 Upload Receipt
                    </button>
                  </label>
                  <label htmlFor="statement-upload">
                    <button style={{
                      padding: '12px 24px',
                      backgroundColor: '#9c27b0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      🏦 Upload PDF
                    </button>
                  </label>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Enhanced Vanilla-Style Table */}
              <div style={{ 
                overflowX: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                borderRadius: '12px',
                border: '2px solid #e3f2fd',
                backgroundColor: 'white'
              }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: 'white',
                  fontSize: '14px'
                }}>
                  <thead style={{ 
                    background: 'linear-gradient(135deg, #1976d2, #1565c0)', 
                    color: 'white' 
                  }}>
                    <tr>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'left', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '120px'
                      }}>Date</th>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'left', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '150px'
                      }}>Category</th>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '100px'
                      }}>Type</th>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'right', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '120px'
                      }}>Amount</th>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'left', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '200px'
                      }}>Description</th>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '100px'
                      }}>File</th>
                      <th style={{ 
                        padding: '18px 15px', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        fontSize: '15px',
                        borderBottom: 'none',
                        minWidth: '140px'
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense, index) => {
                      const isEditing = editingId === expense._id;
                      const needsFix = expense.needsManualReview || !expense.amount || expense.amount === 0;
                      
                      return (
                        <tr 
                          key={expense._id || index} 
                          style={{ 
                            borderBottom: '1px solid #f0f0f0',
                            backgroundColor: needsFix ? '#ffebee' : (index % 2 === 0 ? '#fafafa' : 'white'),
                            borderLeft: needsFix ? '6px solid #d32f2f' : '6px solid transparent',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!needsFix) {
                              e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!needsFix) {
                              e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white';
                            }
                          }}
                        >
                          {/* Date Column */}
                          <td style={{ 
                            padding: '16px 15px', 
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#333'
                          }}>
                            {expense.date 
                              ? new Date(expense.date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'Invalid Date'
                            }
                            {needsFix && (
                              <div style={{ 
                                fontSize: '11px', 
                                color: '#d32f2f', 
                                fontWeight: '500',
                                marginTop: '2px'
                              }}>
                                ⚠️ Review Required
                              </div>
                            )}
                          </td>
                          
                          {/* Category Column */}
                          <td style={{ 
                            padding: '16px 15px', 
                            fontWeight: '600', 
                            fontSize: '14px'
                          }}>
                            {isEditing ? (
                              <select
                                value={editingValues.category}
                                onChange={(e) => setEditingValues({...editingValues, category: e.target.value})}
                                style={{ 
                                  width: '100%', 
                                  padding: '8px 10px', 
                                  fontSize: '14px',
                                  border: '3px solid #1976d2',
                                  borderRadius: '6px',
                                  fontWeight: '600'
                                }}
                              >
                                {categories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            ) : (
                              <div>
                                <div style={{ 
                                  color: '#333',
                                  fontWeight: '600'
                                }}>
                                  {expense.category || 'N/A'}
                                </div>
                                {expense.ocrMethod && (
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: '#666',
                                    marginTop: '2px'
                                  }}>
                                    {expense.ocrMethod}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          
                          {/* Type Column */}
                          <td style={{ padding: '16px 15px', textAlign: 'center' }}>
                            <span style={{ 
                              color: expense.type === 'income' ? '#2e7d32' : '#d32f2f',
                              fontWeight: '800',
                              padding: '8px 16px',
                              borderRadius: '25px',
                              backgroundColor: expense.type === 'income' ? '#e8f5e9' : '#ffebee',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              border: `2px solid ${expense.type === 'income' ? '#4caf50' : '#f44336'}`,
                              display: 'inline-block',
                              minWidth: '80px'
                            }}>
                              {expense.type === 'income' ? '💰 INCOME' : '💸 EXPENSE'}
                            </span>
                          </td>
                          
                          {/* Amount Column */}
                          <td style={{ 
                            padding: '16px 15px', 
                            textAlign: 'right', 
                            fontWeight: '700',
                            fontSize: '15px'
                          }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingValues.amount}
                                onChange={(e) => setEditingValues({...editingValues, amount: e.target.value})}
                                style={{ 
                                  width: '110px', 
                                  padding: '10px',
                                  textAlign: 'right',
                                  border: '3px solid #1976d2',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  color: '#1976d2'
                                }}
                                placeholder="0.00"
                                autoFocus
                              />
                            ) : needsFix ? (
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ 
                                  color: '#d32f2f', 
                                  fontStyle: 'italic',
                                  fontWeight: '800',
                                  fontSize: '14px',
                                  padding: '6px 12px',
                                  backgroundColor: '#ffcdd2',
                                  borderRadius: '6px',
                                  border: '2px solid #f44336',
                                  display: 'inline-block'
                                }}>
                                  ⚠️ Enter Amount
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ 
                                  color: expense.type === 'income' ? '#2e7d32' : '#d32f2f',
                                  fontSize: '16px',
                                  fontWeight: '800'
                                }}>
                                  ₹{Number(expense.amount || 0).toLocaleString('en-IN')}
                                </div>
                                {expense.aiParsed && (
                                  <div style={{ 
                                    fontSize: '10px', 
                                    color: '#666',
                                    marginTop: '2px'
                                  }}>
                                    🤖 AI Parsed
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          
                          {/* Description Column */}
                          <td style={{ 
                            padding: '16px 15px', 
                            maxWidth: '220px',
                            fontSize: '14px',
                            color: '#555'
                          }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingValues.description}
                                onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                                style={{ 
                                  width: '100%', 
                                  padding: '10px',
                                  border: '3px solid #1976d2',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                                placeholder="Enter description..."
                              />
                            ) : (
                              <div style={{ 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={expense.description}>
                                {expense.description || `${expense.category} ${expense.type}`}
                              </div>
                            )}
                          </td>
                          
                          {/* File Column - ENHANCED CLOUDINARY LINK */}
                          <td style={{ padding: '16px 15px', textAlign: 'center' }}>
                            {expense.fileUrl ? (
                              <a 
                                href={expense.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  // Enhanced URL validation for Cloudinary
                                  if (!expense.fileUrl.includes('cloudinary.com') && 
                                      !expense.fileUrl.includes('res.cloudinary.com')) {
                                    e.preventDefault();
                                    alert('Invalid file URL. Please contact support.');
                                    return;
                                  }
                                  console.log('🔗 Opening Cloudinary file:', expense.fileUrl);
                                }}
                                style={{ 
                                  color: '#1976d2', 
                                  textDecoration: 'none',
                                  padding: '8px 14px',
                                  border: '2px solid #1976d2',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  display: 'inline-block',
                                  transition: 'all 0.3s ease',
                                  fontWeight: '700',
                                  backgroundColor: '#e3f2fd'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#1976d2';
                                  e.target.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = '#e3f2fd';
                                  e.target.style.color = '#1976d2';
                                }}
                              >
                                📎 View File
                              </a>
                            ) : (
                              <div style={{ 
                                color: '#999', 
                                fontSize: '12px',
                                fontStyle: 'italic',
                                padding: '8px'
                              }}>
                                No file
                              </div>
                            )}
                          </td>
                          
                          {/* Actions Column */}
                          <td style={{ padding: '16px 15px', textAlign: 'center' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleSaveEdit(expense._id)}
                                  disabled={updateLoading === expense._id}
                                  style={{
                                    padding: '8px 14px',
                                    backgroundColor: '#2e7d32',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    minWidth: '70px',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {updateLoading === expense._id ? '⏳' : '✅'} Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  style={{
                                    padding: '8px 14px',
                                    backgroundColor: '#757575',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    minWidth: '70px'
                                  }}
                                >
                                  ❌ Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleEdit(expense)}
                                  style={{
                                    padding: '8px 14px',
                                    backgroundColor: needsFix ? '#d32f2f' : '#1976d2',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    boxShadow: needsFix ? '0 4px 12px rgba(211, 47, 47, 0.4)' : '0 2px 8px rgba(25, 118, 210, 0.3)',
                                    minWidth: '70px',
                                    animation: needsFix ? 'pulse 2s infinite' : 'none'
                                  }}
                                  title={needsFix ? 'Fix missing amount and details' : 'Edit expense'}
                                >
                                  {needsFix ? '🚨 FIX' : '✏️ Edit'}
                                </button>
                                <button
                                  onClick={() => handleDelete(expense)}
                                  disabled={deleteLoading === expense._id}
                                  style={{
                                    padding: '8px 14px',
                                    backgroundColor: deleteLoading === expense._id ? '#bdbdbd' : '#d32f2f',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: deleteLoading === expense._id ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    minWidth: '50px'
                                  }}
                                >
                                  {deleteLoading === expense._id ? '⏳' : '🗑️'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Net Balance Card */}
              <div style={{ 
                marginTop: '32px', 
                padding: '28px', 
                background: 'linear-gradient(135deg, #ffffff, #f8f9fa)',
                borderRadius: '16px',
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '2px solid #e3f2fd'
              }}>
                <div style={{ 
                  fontSize: '32px',
                  fontWeight: '800',
                  color: (stats.totalIncome - stats.totalExpenses) >= 0 ? '#2e7d32' : '#d32f2f',
                  marginBottom: '12px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  Net Balance: ₹{(stats.totalIncome - stats.totalExpenses).toLocaleString('en-IN')}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#2e7d32' }}>
                      ₹{stats.totalIncome.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>
                      💰 Total Income
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#d32f2f' }}>
                      ₹{stats.totalExpenses.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>
                      💸 Total Expenses
                    </div>
                  </div>
                </div>
                
                {stats.needsReviewCount > 0 && (
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#d32f2f', 
                    fontWeight: '700',
                    padding: '10px 20px',
                    backgroundColor: '#ffebee',
                    borderRadius: '10px',
                    border: '2px solid #ffcdd2',
                    display: 'inline-block',
                    animation: 'pulse 2s infinite'
                  }}>
                    ⚠️ Balance excludes {stats.needsReviewCount} transaction{stats.needsReviewCount > 1 ? 's' : ''} with missing amounts
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SlideIn>

      {/* Upload History */}
      {uploadResults.length > 0 && (
        <SlideIn direction="up" delay={0.4}>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', mt: 4 }}>
            <Box sx={{ p: 2, bgcolor: 'success.main', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                📂 Recent Uploads ({uploadResults.length})
              </Typography>
            </Box>
            
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {uploadResults.map((result, index) => (
                <Box 
                  key={result.id}
                  sx={{ 
                    p: 2, 
                    borderBottom: '1px solid #f0f0f0',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {result.filename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {result.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(result.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip 
                        label={result.type} 
                        size="small" 
                        color={result.type === 'receipt' ? 'primary' : 'secondary'}
                      />
                      <Chip 
                        icon={result.status === 'success' ? <SuccessIcon /> : <ErrorIcon />}
                        label={result.status} 
                        size="small" 
                        color={result.status === 'success' ? 'success' : 'error'}
                      />
                      {result.fileUrl && (
                        <a 
                          href={result.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'none' }}
                        >
                          <Chip 
                            icon={<ViewIcon />}
                            label="View" 
                            size="small" 
                            clickable
                            variant="outlined"
                            color="primary"
                          />
                        </a>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </SlideIn>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          variant="filled"
          sx={{ minWidth: 300 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default Upload;
