// frontend/src/components/UploadComponent.js
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload,
  Receipt,
  AccountBalance,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { fetchTransactions } from '../features/transactions/transactionSlice';

const UploadComponent = ({ onUploadComplete }) => {
  const dispatch = useDispatch();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const [uploadedTransactions, setUploadedTransactions] = useState([]);
  const [uploadStats, setUploadStats] = useState(null);

  // ✅ FORMAT CURRENCY
  const formatCurrency = (amount) => {
    return `₹${Math.abs(amount || 0).toLocaleString('en-IN')}`;
  };

  // ✅ FIXED: Handle file upload with PROPER response handling
  const handleFileUpload = async (file, uploadType) => {
    setIsUploading(true);
    setUploadStatus({ type: '', message: '' });
    setUploadedTransactions([]);
    setUploadStats(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = uploadType === 'receipt' ? '/api/upload/receipt' : '/api/upload/bank-statement';
      
      console.log(`📤 Frontend: Uploading ${uploadType}:`, file.name);
      
      const response = await axios.post(`{process.env.REACT_APP_API_URL}${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        timeout: 120000, // 2 minutes timeout
      });

      console.log('📥 Frontend: Full upload response:', response.data);

      if (response.data.success) {
        // ✅ CRITICAL FIX: Proper destructuring of response data
        const responseData = response.data.data;
        const { transactions = [], stats = {} } = responseData;
        
        console.log('✅ Frontend: Extracted data:', {
          transactionCount: transactions.length,
          statsTransactionCount: stats.transactionCount,
          totalIncome: stats.totalIncome,
          totalExpenses: stats.totalExpenses,
          message: response.data.message
        });
        
        // ✅ UPDATE LOCAL STATE WITH PARSED DATA
        setUploadedTransactions(transactions);
        setUploadStats(stats);
        
        // ✅ ENHANCED SUCCESS MESSAGE WITH DETAILED INFO
        const successMessage = `✅ ${response.data.message}
        
📊 Processing Summary:
• Transactions Found: ${stats.transactionCount || transactions.length}
• Income Entries: ${stats.incomeCount || 0}
• Expense Entries: ${stats.expenseCount || 0}
• Total Income: ${stats.totalIncome ? formatCurrency(stats.totalIncome) : '₹0'}
• Total Expenses: ${stats.totalExpenses ? formatCurrency(stats.totalExpenses) : '₹0'}
• Net Amount: ${stats.netAmount !== undefined ? formatCurrency(stats.netAmount) : 'N/A'}
• Processing Time: ${stats.processingTime || 'N/A'}ms
• Method: ${stats.parsingMethod || 'Unknown'}`;

        setUploadStatus({
          type: 'success',
          message: successMessage
        });

        // ✅ CRITICAL: REFRESH REDUX STORE WITH NEW TRANSACTIONS
        console.log('🔄 Frontend: Refreshing Redux store with new transactions...');
        try {
          await dispatch(fetchTransactions()).unwrap();
          console.log('✅ Frontend: Redux store refreshed successfully');
        } catch (reduxError) {
          console.error('❌ Frontend: Redux refresh failed:', reduxError);
        }
        
        // ✅ NOTIFY PARENT COMPONENT IF PROVIDED
        if (onUploadComplete) {
          onUploadComplete(transactions, stats);
        }
        
        // ✅ TRIGGER BROWSER EVENT FOR OTHER COMPONENTS
        window.dispatchEvent(new CustomEvent('transactionUpdated', {
          detail: {
            message: `🎉 ${stats.transactionCount || transactions.length} new transactions added from ${uploadType}!`,
            transactions: transactions,
            stats: stats
          }
        }));
        
        console.log(`✅ Frontend: Successfully processed and updated ${transactions.length} transactions`);
        
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }

    } catch (error) {
      console.error('❌ Frontend: Upload error:', error);
      
      let errorMessage = 'Upload failed';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUploadStatus({
        type: 'error',
        message: `❌ ${errorMessage}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ FILE INPUT HANDLERS
  const handleReceiptUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('📸 Receipt file selected:', file.name);
      handleFileUpload(file, 'receipt');
    }
    event.target.value = ''; // Reset input
  };

  const handleBankStatementUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('🏦 Bank statement file selected:', file.name);
      handleFileUpload(file, 'bank-statement');
    }
    event.target.value = ''; // Reset input
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* ✅ UPLOAD SECTION */}
      <Paper sx={{ p: 4, mb: 4, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          📤 Upload Financial Documents
        </Typography>

        <Grid container spacing={3}>
          {/* Receipt Upload */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              border: '2px dashed #1976d2', 
              backgroundColor: '#f8faff',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#f0f7ff' }
            }}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Receipt sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Upload Receipt
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Upload image files (JPG, PNG, GIF, WebP)
                </Typography>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="receipt-upload"
                  type="file"
                  onChange={handleReceiptUpload}
                  disabled={isUploading}
                />
                <label htmlFor="receipt-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<CloudUpload />}
                    disabled={isUploading}
                    sx={{ px: 4 }}
                  >
                    Choose Receipt
                  </Button>
                </label>
              </CardContent>
            </Card>
          </Grid>

          {/* Bank Statement Upload */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              border: '2px dashed #2e7d32', 
              backgroundColor: '#f8fff8',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#f0fff0' }
            }}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <AccountBalance sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Upload Bank Statement
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Upload PDF files only
                </Typography>
                <input
                  accept=".pdf"
                  style={{ display: 'none' }}
                  id="statement-upload"
                  type="file"
                  onChange={handleBankStatementUpload}
                  disabled={isUploading}
                />
                <label htmlFor="statement-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<CloudUpload />}
                    disabled={isUploading}
                    color="success"
                    sx={{ px: 4 }}
                  >
                    Choose PDF
                  </Button>
                </label>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* ✅ LOADING STATE */}
      {isUploading && (
        <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              🔄 Processing Document...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Extracting text and parsing transactions
            </Typography>
            <LinearProgress sx={{ borderRadius: 1 }} />
          </Box>
        </Paper>
      )}

      {/* ✅ UPLOAD STATUS - ENHANCED DISPLAY */}
      <AnimatePresence>
        {uploadStatus.message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert 
              severity={uploadStatus.type === 'success' ? 'success' : 'error'} 
              sx={{ mb: 4, borderRadius: 2 }}
              icon={uploadStatus.type === 'success' ? <CheckCircle /> : <Error />}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
                {uploadStatus.message}
              </Typography>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ UPLOAD STATISTICS - ENHANCED DISPLAY */}
      {uploadStats && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Paper sx={{ p: 4, mb: 4, borderRadius: 3, bgcolor: 'success.light' }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'success.contrastText' }}>
              📊 Processing Results Summary
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.contrastText' }}>
                    {uploadStats.transactionCount || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'success.contrastText' }}>
                    Total Transactions
                  </Typography>
                </Box>
              </Grid>
              
              {uploadStats.incomeCount !== undefined && (
                <Grid item xs={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {uploadStats.incomeCount}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'success.contrastText' }}>
                      Income Entries
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {uploadStats.expenseCount !== undefined && (
                <Grid item xs={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                      {uploadStats.expenseCount}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'success.contrastText' }}>
                      Expense Entries
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.contrastText' }}>
                    {uploadStats.processingTime}ms
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'success.contrastText' }}>
                    Processing Time
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Financial Summary */}
            {(uploadStats.totalIncome || uploadStats.totalExpenses || uploadStats.netAmount !== undefined) && (
              <Box sx={{ mt: 3, p: 3, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'success.contrastText' }}>
                  💰 Financial Summary
                </Typography>
                <Grid container spacing={2}>
                  {uploadStats.totalIncome !== undefined && (
                    <Grid item xs={4}>
                      <Typography variant="body2" sx={{ color: 'success.contrastText' }}>Income:</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 600 }}>
                        +{formatCurrency(uploadStats.totalIncome)}
                      </Typography>
                    </Grid>
                  )}
                  {uploadStats.totalExpenses !== undefined && (
                    <Grid item xs={4}>
                      <Typography variant="body2" sx={{ color: 'success.contrastText' }}>Expenses:</Typography>
                      <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 600 }}>
                        -{formatCurrency(uploadStats.totalExpenses)}
                      </Typography>
                    </Grid>
                  )}
                  {uploadStats.netAmount !== undefined && (
                    <Grid item xs={4}>
                      <Typography variant="body2" sx={{ color: 'success.contrastText' }}>Net:</Typography>
                      <Typography variant="h6" sx={{ 
                        color: uploadStats.netAmount >= 0 ? 'success.main' : 'error.main',
                        fontWeight: 600 
                      }}>
                        {uploadStats.netAmount >= 0 ? '+' : ''}{formatCurrency(uploadStats.netAmount)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}

            <Typography variant="body2" sx={{ mt: 2, opacity: 0.8, color: 'success.contrastText' }}>
              ⚡ Parsed using: {uploadStats.parsingMethod || 'AI Processing'}
            </Typography>
          </Paper>
        </motion.div>
      )}

      {/* ✅ PARSED TRANSACTIONS DISPLAY */}
      {uploadedTransactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              📋 Parsed Transactions ({uploadedTransactions.length})
            </Typography>
            
            <List>
              {uploadedTransactions.map((transaction, index) => (
                <motion.div
                  key={transaction._id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ListItem 
                    sx={{ 
                      border: '1px solid #e0e0e0',
                      borderRadius: 2,
                      mb: 2,
                      bgcolor: transaction.type === 'income' ? '#f1f8e9' : '#fce4ec'
                    }}
                  >
                    <ListItemIcon>
                      {transaction.type === 'income' ? 
                        <TrendingUp sx={{ color: 'success.main', fontSize: 32 }} /> :
                        <TrendingDown sx={{ color: 'error.main', fontSize: 32 }} />
                      }
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {transaction.description}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 700,
                              color: transaction.type === 'income' ? 'success.main' : 'error.main'
                            }}
                          >
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip 
                              label={transaction.category} 
                              size="small" 
                              color={transaction.type === 'income' ? 'success' : 'error'}
                              variant="outlined"
                            />
                            <Chip 
                              label={transaction.type.toUpperCase()} 
                              size="small" 
                              color={transaction.type === 'income' ? 'success' : 'error'}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(transaction.date).toLocaleDateString('en-IN')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </motion.div>
              ))}
            </List>
          </Paper>
        </motion.div>
      )}
    </Box>
  );
};

export default UploadComponent;
