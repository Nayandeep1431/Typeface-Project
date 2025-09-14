import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  alpha,
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
  Link as LinkIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadAPI, transactionAPI } from '../services/api';
import { fetchTransactions } from '../features/transactions/transactionSlice';
import { FadeIn, SlideIn, AnimatedCard } from '../components/Animations/AnimatedComponents';

const Upload = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [processingStage, setProcessingStage] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Upload management state
  const [uploads, setUploads] = useState([]);
  const [filteredUploads, setFilteredUploads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState(false);

  // ✅ NEW: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Statistics
  const [stats, setStats] = useState({
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalProcessed: 0
  });

  // ✅ NEW: Paginated uploads calculation
  const paginatedUploads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUploads.slice(startIndex, endIndex);
  }, [filteredUploads, currentPage, itemsPerPage]);

  // ✅ NEW: Calculate total pages
  const totalPages = Math.ceil(filteredUploads.length / itemsPerPage);

  // Load uploads on component mount
  useEffect(() => {
    loadUploads();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    applyFiltersAndSort();
    setCurrentPage(1); // Reset to first page when filters change
  }, [uploads, filter, sortBy, sortOrder]);

  const loadUploads = async () => {
    try {
      setTableLoading(true);
      console.log('🔄 Loading uploads from localStorage...');
      
      // Load from localStorage for now - you can replace with API call
      const savedUploads = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
      console.log(`📊 Loaded ${savedUploads.length} uploads`);
      
      setUploads(savedUploads);
      calculateStats(savedUploads);
    } catch (error) {
      console.error('❌ Error loading uploads:', error);
      setNotification({
        open: true,
        message: 'Failed to load upload history',
        severity: 'error'
      });
      setUploads([]);
    } finally {
      setTableLoading(false);
    }
  };

  const saveUploads = (uploadsData) => {
    try {
      localStorage.setItem('uploadHistory', JSON.stringify(uploadsData));
      console.log('✅ Upload history saved to localStorage');
    } catch (error) {
      console.error('❌ Error saving uploads:', error);
    }
  };

  const calculateStats = (uploadsData) => {
    const totalUploads = uploadsData.length;
    const successfulUploads = uploadsData.filter(upload => upload.status === 'success').length;
    const failedUploads = uploadsData.filter(upload => upload.status === 'error').length;
    const totalProcessed = uploadsData.reduce((sum, upload) => {
      return sum + (upload.extractedCount || 0);
    }, 0);

    setStats({
      totalUploads,
      successfulUploads,
      failedUploads,
      totalProcessed
    });
  };

  const applyFiltersAndSort = () => {
    let filtered = [...uploads];

    // Apply filter
    if (filter === 'success') {
      filtered = filtered.filter(upload => upload.status === 'success');
    } else if (filter === 'error') {
      filtered = filtered.filter(upload => upload.status === 'error');
    } else if (filter === 'receipt') {
      filtered = filtered.filter(upload => upload.type === 'receipt');
    } else if (filter === 'statement') {
      filtered = filtered.filter(upload => upload.type === 'statement');
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'timestamp') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredUploads(filtered);
  };

  // ✅ NEW: Pagination handlers
  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (event) => {
    setItemsPerPage(event.target.value);
    setCurrentPage(1); // Reset to first page when changing items per page
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

        // Create upload record
        const uploadRecord = {
          id: Date.now(),
          type: 'receipt',
          filename: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'success',
          message: `Processed ${processedCount} expense(s)`,
          cloudinaryUrl: result.fileUrl,
          extractedCount: processedCount,
          needsReview: needsReviewCount,
          timestamp: new Date().toISOString(),
          processingStats: {
            ocrMethod: result.stats?.ocrMethod,
            parsingMethod: result.stats?.parsingMethod,
            textLength: result.stats?.textLength,
            processingTime: result.stats?.processingTime
          },
          extractedData: result.expenses || [],
          ocrPreview: result.ocrPreview
        };

        // Update uploads state and save to localStorage
        const updatedUploads = [uploadRecord, ...uploads];
        setUploads(updatedUploads);
        saveUploads(updatedUploads);

        // Add to upload results for immediate display
        setUploadResults(prev => [uploadRecord, ...prev]);

        // Refresh the transactions list
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
      
      const errorRecord = {
        id: Date.now(),
        type: 'receipt',
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'error',
        message: error.response?.data?.error || error.message,
        timestamp: new Date().toISOString(),
        cloudinaryUrl: null,
        extractedCount: 0
      };

      const updatedUploads = [errorRecord, ...uploads];
      setUploads(updatedUploads);
      saveUploads(updatedUploads);
      setUploadResults(prev => [errorRecord, ...prev]);

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
  }, [dispatch, uploads]);

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

        // Create upload record
        const uploadRecord = {
          id: Date.now(),
          type: 'statement',
          filename: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'success',
          message: `Imported ${processedCount} transaction(s)`,
          cloudinaryUrl: result.fileUrl,
          extractedCount: processedCount,
          needsReview: needsReviewCount,
          timestamp: new Date().toISOString(),
          processingStats: {
            extractionMethod: result.stats?.extractionMethod,
            parsingMethod: result.stats?.parsingMethod,
            textLength: result.rawOcrText?.length,
            processingTime: result.stats?.processingTime
          },
          extractedData: result.transactions || [],
          ocrPreview: result.ocrPreview
        };

        // Update uploads state and save to localStorage
        const updatedUploads = [uploadRecord, ...uploads];
        setUploads(updatedUploads);
        saveUploads(updatedUploads);
        setUploadResults(prev => [uploadRecord, ...prev]);

        // Refresh the transactions list
        dispatch(fetchTransactions());

        setNotification({
          open: true,
          message: `🏦 Bank statement processed! Imported ${processedCount} transaction(s).${needsReviewCount > 0 ? ` ${needsReviewCount} need review.` : ''}`,
          severity: 'success'
        });
      }

    } catch (error) {
      console.error('❌ Statement upload error:', error);
      
      const errorRecord = {
        id: Date.now(),
        type: 'statement',
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'error',
        message: error.response?.data?.error || error.message,
        timestamp: new Date().toISOString(),
        cloudinaryUrl: null,
        extractedCount: 0
      };

      const updatedUploads = [errorRecord, ...uploads];
      setUploads(updatedUploads);
      saveUploads(updatedUploads);
      setUploadResults(prev => [errorRecord, ...prev]);

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
  }, [dispatch, uploads]);

  // Upload management functions
  const handleDeleteUpload = async (uploadId) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (!upload) return;

    const confirmMessage = `Are you sure you want to delete this upload?\n\n` +
      `File: ${upload.filename}\n` +
      `Uploaded: ${new Date(upload.timestamp).toLocaleString()}`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteLoading(uploadId);
    
    try {
      const updatedUploads = uploads.filter(u => u.id !== uploadId);
      setUploads(updatedUploads);
      saveUploads(updatedUploads);
      
      setNotification({
        open: true,
        message: 'Upload record deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('❌ Delete failed:', error);
      setNotification({
        open: true,
        message: `Failed to delete upload: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleViewDetails = (upload) => {
    setSelectedUpload(upload);
    setDetailsDialog(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setNotification({
        open: true,
        message: 'Cloudinary URL copied to clipboard!',
        severity: 'success'
      });
    }).catch(() => {
      setNotification({
        open: true,
        message: 'Failed to copy URL',
        severity: 'error'
      });
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
                background: uploading 
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.15)}, ${alpha(theme.palette.primary.main, 0.1)})` 
                  : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)}, ${alpha(theme.palette.background.paper, 0.8)})`,
                transition: 'all 0.3s ease',
                border: '2px solid',
                borderColor: 'divider',
                boxShadow: theme.shadows[4],
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: theme.shadows[8],
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
                      color: 'primary.contrastText',
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
                        sx={{ 
                          px: 3, 
                          py: 1.5, 
                          fontWeight: 600,
                          borderRadius: 2,
                        }}
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
                background: uploading 
                  ? `linear-gradient(135deg, ${alpha(theme.palette.secondary.light, 0.15)}, ${alpha(theme.palette.secondary.main, 0.1)})` 
                  : `linear-gradient(135deg, ${alpha(theme.palette.secondary.light, 0.05)}, ${alpha(theme.palette.background.paper, 0.8)})`,
                transition: 'all 0.3s ease',
                border: '2px solid',
                borderColor: 'divider',
                boxShadow: theme.shadows[4],
                '&:hover': {
                  borderColor: 'secondary.main',
                  boxShadow: theme.shadows[8],
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
                      color: 'secondary.contrastText',
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
                        sx={{ 
                          px: 3, 
                          py: 1.5, 
                          fontWeight: 600,
                          borderRadius: 2,
                        }}
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
            <Paper sx={{ 
              p: 3, 
              mb: 4, 
              borderRadius: 3, 
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.light, 0.1)}, ${alpha(theme.palette.success.main, 0.05)})`,
              border: '2px solid',
              borderColor: alpha(theme.palette.success.main, 0.3),
            }}>
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
          <Paper sx={{ 
            mb: 4, 
            borderRadius: 3, 
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'info.main', 
              color: 'info.contrastText',
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
                sx={{ 
                  color: 'info.contrastText', 
                  borderColor: 'info.contrastText',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.info.contrastText, 0.1),
                  }
                }}
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
                      bgcolor: alpha(theme.palette.text.secondary, 0.05),
                      maxHeight: 150, 
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
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
                        sx={{
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          }
                        }}
                      />
                    </a>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Paper>
        </SlideIn>
      )}

      {/* ✅ ENHANCED: Your Uploads Table with Pagination */}
      <SlideIn direction="up" delay={0.3}>
        <Paper sx={{ 
          borderRadius: 3, 
          overflow: 'hidden', 
          mt: 4,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: theme.shadows[2],
        }}>
          {/* Header */}
          <Box sx={{ 
            p: 3, 
            bgcolor: 'primary.main', 
            color: 'primary.contrastText',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                📁 Your Uploads ({stats.totalUploads})
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Manage your uploaded files and Cloudinary URLs
              </Typography>
            </Box>
            <Button
              onClick={loadUploads}
              disabled={tableLoading}
              variant="outlined"
              sx={{ 
                color: 'primary.contrastText', 
                borderColor: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.contrastText, 0.1),
                  borderColor: 'primary.contrastText'
                }
              }}
              startIcon={<RefreshIcon />}
            >
              {tableLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </Box>

          {/* Statistics */}
          <Box sx={{ 
            p: 3, 
            bgcolor: alpha(theme.palette.text.secondary, 0.03), 
            borderBottom: '1px solid', 
            borderColor: 'divider' 
          }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {stats.totalUploads}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Uploads
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {stats.successfulUploads}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successful
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {stats.failedUploads}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Failed
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                    {stats.totalProcessed}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Items Extracted
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* ✅ ENHANCED: Controls with Items Per Page */}
          <Box sx={{ 
            p: 2, 
            bgcolor: alpha(theme.palette.text.secondary, 0.02), 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center', 
            flexWrap: 'wrap',
            gap: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ mr: 1, fontWeight: 600 }}>Filter:</Typography>
              <Chip
                label="All"
                size="small"
                color={filter === 'all' ? 'primary' : 'default'}
                onClick={() => setFilter('all')}
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) }
                }}
              />
              <Chip
                label="Success"
                size="small"
                color={filter === 'success' ? 'success' : 'default'}
                onClick={() => setFilter('success')}
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: alpha(theme.palette.success.main, 0.1) }
                }}
              />
              <Chip
                label="Error"
                size="small"
                color={filter === 'error' ? 'error' : 'default'}
                onClick={() => setFilter('error')}
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.1) }
                }}
              />
              <Chip
                label="Receipts"
                size="small"
                color={filter === 'receipt' ? 'primary' : 'default'}
                onClick={() => setFilter('receipt')}
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) }
                }}
              />
              <Chip
                label="Statements"
                size="small"
                color={filter === 'statement' ? 'secondary' : 'default'}
                onClick={() => setFilter('statement')}
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: alpha(theme.palette.secondary.main, 0.1) }
                }}
              />
            </Box>

            {/* ✅ NEW: Items per page selector */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Items per page</InputLabel>
              <Select
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                label="Items per page"
                sx={{ 
                  '& .MuiSelect-select': { 
                    py: 1,
                    fontWeight: 600,
                  }
                }}
              >
                <MenuItem value={5}>5 per page</MenuItem>
                <MenuItem value={10}>10 per page</MenuItem>
                <MenuItem value={15}>15 per page</MenuItem>
                <MenuItem value={20}>20 per page</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* ✅ ENHANCED: Table with Professional Styling */}
          {tableLoading ? (
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', marginBottom: 16 }}
              >
                <RefreshIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              </motion.div>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Loading uploads...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait while we fetch your upload history
              </Typography>
            </Box>
          ) : filteredUploads.length === 0 ? (
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <Typography variant="h1" sx={{ fontSize: 72, mb: 3 }}>📁</Typography>
              <Typography variant="h5" color="text.primary" sx={{ fontWeight: 600, mb: 2 }}>
                {uploads.length === 0 ? 'No uploads found' : 'No matching uploads'}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                {uploads.length === 0 
                  ? 'Upload your first receipt or bank statement to get started!'
                  : 'Try adjusting your filters to see more results.'
                }
              </Typography>
              {uploads.length === 0 && (
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="receipt-upload">
                    <Button 
                      variant="contained" 
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    >
                      📱 Upload Receipt
                    </Button>
                  </label>
                  <label htmlFor="statement-upload">
                    <Button 
                      variant="contained" 
                      color="secondary"
                      sx={{ fontWeight: 600 }}
                    >
                      🏦 Upload PDF
                    </Button>
                  </label>
                </Box>
              )}
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ 
                      '& .MuiTableCell-head': { 
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        py: 2,
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                      }
                    }}>
                      <TableCell>File</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Extracted</TableCell>
                      <TableCell>Upload Date</TableCell>
                      <TableCell>Cloudinary URL</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* ✅ NEW: Use paginatedUploads instead of filteredUploads */}
                    {paginatedUploads.map((upload, index) => (
                      <TableRow 
                        key={upload.id}
                        sx={{ 
                          transition: 'all 0.3s ease',
                          borderLeft: '4px solid transparent',
                          '&:hover': { 
                            borderLeftColor: upload.status === 'success' ? 'success.main' : 'error.main',
                            backgroundColor: alpha(
                              upload.status === 'success' ? theme.palette.success.main : theme.palette.error.main, 
                              0.05
                            ),
                          },
                          backgroundColor: upload.status === 'error' 
                            ? alpha(theme.palette.error.main, 0.02) 
                            : 'inherit',
                          '& .MuiTableCell-root': {
                            py: 2,
                            borderBottom: '1px solid',
                            borderColor: alpha(theme.palette.divider, 0.5),
                          }
                        }}
                      >
                        {/* File Column */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ 
                              width: 40, 
                              height: 40,
                              bgcolor: upload.type === 'receipt' 
                                ? alpha(theme.palette.primary.main, 0.1) 
                                : alpha(theme.palette.secondary.main, 0.1),
                            }}>
                              {upload.type === 'receipt' ? (
                                <ImageIcon sx={{ color: 'primary.main' }} />
                              ) : (
                                <PdfIcon sx={{ color: 'secondary.main' }} />
                              )}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {upload.filename}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {upload.fileType}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Type Column */}
                        <TableCell>
                          <Chip
                            label={upload.type}
                            size="small"
                            color={upload.type === 'receipt' ? 'primary' : 'secondary'}
                            variant="outlined"
                            sx={{ 
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          />
                        </TableCell>

                        {/* Size Column */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {formatFileSize(upload.fileSize)}
                          </Typography>
                        </TableCell>

                        {/* Status Column */}
                        <TableCell>
                          <Chip
                            icon={upload.status === 'success' ? <SuccessIcon /> : <ErrorIcon />}
                            label={upload.status}
                            size="small"
                            color={upload.status === 'success' ? 'success' : 'error'}
                            sx={{ 
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          />
                        </TableCell>

                        {/* Extracted Column */}
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {upload.extractedCount || 0}
                            </Typography>
                            {upload.needsReview > 0 && (
                              <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                                ({upload.needsReview} need review)
                              </Typography>
                            )}
                          </Box>
                        </TableCell>

                        {/* Upload Date Column */}
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {new Date(upload.timestamp).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(upload.timestamp).toLocaleTimeString()}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* ✅ ENHANCED: Cloudinary URL Column */}
                        <TableCell>
                          {upload.cloudinaryUrl ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Tooltip title="Open in Cloudinary">
                                <IconButton
                                  size="small"
                                  onClick={() => window.open(upload.cloudinaryUrl, '_blank')}
                                  sx={{ 
                                    color: 'primary.main',
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.primary.main, 0.3),
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                      borderColor: 'primary.main',
                                    }
                                  }}
                                >
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Copy URL">
                                <IconButton
                                  size="small"
                                  onClick={() => copyToClipboard(upload.cloudinaryUrl)}
                                  sx={{ 
                                    color: 'success.main',
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.success.main, 0.3),
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.success.main, 0.1),
                                      borderColor: 'success.main',
                                    }
                                  }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ 
                                  maxWidth: 120, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  fontFamily: 'monospace',
                                  backgroundColor: alpha(theme.palette.text.secondary, 0.05),
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                }}
                              >
                                {upload.cloudinaryUrl.split('/').pop()}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              No URL available
                            </Typography>
                          )}
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(upload)}
                                sx={{ 
                                  color: 'info.main',
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                                  }
                                }}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Upload">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteUpload(upload.id)}
                                disabled={deleteLoading === upload.id}
                                sx={{ 
                                  color: 'error.main',
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.error.main, 0.1),
                                  },
                                  '&:disabled': {
                                    color: 'text.disabled',
                                  }
                                }}
                              >
                                {deleteLoading === upload.id ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                                    <RefreshIcon fontSize="small" />
                                  </motion.div>
                                ) : (
                                  <DeleteIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* ✅ NEW: Pagination Controls */}
              {totalPages > 1 && (
                <Box sx={{ 
                  p: 3, 
                  borderTop: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: alpha(theme.palette.text.secondary, 0.02),
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                    {Math.min(currentPage * itemsPerPage, filteredUploads.length)} of{' '}
                    {filteredUploads.length} uploads
                  </Typography>
                  
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Pagination
                      count={totalPages}
                      page={currentPage}
                      onChange={handlePageChange}
                      color="primary"
                      size="medium"
                      showFirstButton
                      showLastButton
                      siblingCount={1}
                      boundaryCount={1}
                      sx={{
                        '& .MuiPaginationItem-root': {
                          fontWeight: 600,
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          },
                        },
                        '& .Mui-selected': {
                          backgroundColor: `${theme.palette.primary.main} !important`,
                          color: theme.palette.primary.contrastText,
                        }
                      }}
                    />
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Paper>
      </SlideIn>

      {/* ✅ ENHANCED: Upload Details Dialog */}
      <Dialog 
        open={detailsDialog} 
        onClose={() => setDetailsDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: theme.shadows[8],
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}>
          <InfoIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Upload Details
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedUpload && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ 
                    p: 2, 
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.1),
                  }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                      📁 File Information
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Name:</strong> {selectedUpload.filename}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Type:</strong> {selectedUpload.type} ({selectedUpload.fileType})
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Size:</strong> {formatFileSize(selectedUpload.fileSize)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Status:</strong> {selectedUpload.status}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Uploaded:</strong> {new Date(selectedUpload.timestamp).toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ 
                    p: 2, 
                    bgcolor: alpha(theme.palette.success.main, 0.05),
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.success.main, 0.1),
                  }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'success.main' }}>
                      📊 Extraction Results
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Items Extracted:</strong> {selectedUpload.extractedCount || 0}
                    </Typography>
                    {selectedUpload.needsReview > 0 && (
                      <Typography variant="body2" sx={{ mb: 1, color: 'warning.main', fontWeight: 600 }}>
                        <strong>Needs Review:</strong> {selectedUpload.needsReview}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Message:</strong> {selectedUpload.message}
                    </Typography>
                  </Paper>
                </Grid>

                {selectedUpload.cloudinaryUrl && (
                  <Grid item xs={12}>
                    <Paper sx={{ 
                      p: 3, 
                      bgcolor: alpha(theme.palette.info.main, 0.05),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.info.main, 0.1),
                    }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'info.main' }}>
                        🔗 Cloudinary URL
                      </Typography>
                      <Paper sx={{ 
                        p: 2, 
                        bgcolor: alpha(theme.palette.text.secondary, 0.05), 
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: alpha(theme.palette.text.secondary, 0.1),
                      }}>
                        <Typography variant="body2" sx={{ 
                          fontFamily: 'monospace', 
                          wordBreak: 'break-all',
                          mb: 2,
                          backgroundColor: alpha(theme.palette.text.secondary, 0.05),
                          p: 1,
                          borderRadius: 1,
                        }}>
                          {selectedUpload.cloudinaryUrl}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => window.open(selectedUpload.cloudinaryUrl, '_blank')}
                            startIcon={<ViewIcon />}
                            sx={{ fontWeight: 600 }}
                          >
                            Open File
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => copyToClipboard(selectedUpload.cloudinaryUrl)}
                            startIcon={<DownloadIcon />}
                            sx={{ fontWeight: 600 }}
                          >
                            Copy URL
                          </Button>
                        </Box>
                      </Paper>
                    </Paper>
                  </Grid>
                )}

                {selectedUpload.processingStats && (
                  <Grid item xs={12}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: alpha(theme.palette.warning.main, 0.05),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.warning.main, 0.1),
                    }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'warning.main' }}>
                        ⚙️ Processing Statistics
                      </Typography>
                      <Grid container spacing={2}>
                        {Object.entries(selectedUpload.processingStats).map(([key, value]) => (
                          <Grid item xs={6} sm={4} key={key}>
                            <Box sx={{ 
                              p: 1, 
                              bgcolor: alpha(theme.palette.text.secondary, 0.03),
                              borderRadius: 1,
                              textAlign: 'center',
                            }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                                {value || 'N/A'}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={() => setDetailsDialog(false)}
            variant="contained"
            sx={{ fontWeight: 600 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recent Upload Results (for immediate feedback) */}
      {uploadResults.length > 0 && (
        <SlideIn direction="up" delay={0.4}>
          <Paper sx={{ 
            borderRadius: 3, 
            overflow: 'hidden', 
            mt: 4,
            border: '1px solid',
            borderColor: 'divider',
          }}>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'success.main', 
              color: 'success.contrastText',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                📂 Recent Upload Activity ({uploadResults.slice(0, 5).length})
              </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Latest uploads
              </Typography>
            </Box>
            
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {uploadResults.slice(0, 5).map((result, index) => (
                <Box 
                  key={result.id}
                  sx={{ 
                    p: 2, 
                    borderBottom: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.5),
                    '&:last-child': { borderBottom: 'none' },
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.text.secondary, 0.02),
                      borderLeftColor: result.status === 'success' ? 'success.main' : 'error.main',
                      borderLeft: '4px solid',
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {result.filename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {result.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(result.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, ml: 2 }}>
                      <Chip 
                        label={result.type} 
                        size="small" 
                        color={result.type === 'receipt' ? 'primary' : 'secondary'}
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip 
                        icon={result.status === 'success' ? <SuccessIcon /> : <ErrorIcon />}
                        label={result.status} 
                        size="small" 
                        color={result.status === 'success' ? 'success' : 'error'}
                        sx={{ fontWeight: 600 }}
                      />
                      {result.cloudinaryUrl && (
                        <a 
                          href={result.cloudinaryUrl} 
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
                            sx={{
                              fontWeight: 600,
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              }
                            }}
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
          sx={{ 
            minWidth: 300,
            fontWeight: 600,
            '& .MuiAlert-icon': {
              fontSize: 20
            }
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* ✅ ENHANCED: Custom Styles for Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.02);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-pulse {
          animation: pulse 2s infinite;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }

        /* Professional scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
          border-radius: 4px;
          transition: background 0.3s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
        }

        /* Enhanced focus states for accessibility */
        .MuiButton-root:focus-visible,
        .MuiIconButton-root:focus-visible,
        .MuiChip-root:focus-visible {
          outline: 2px solid ${theme.palette.primary.main};
          outline-offset: 2px;
        }

        /* Smooth transitions for all interactive elements */
        .MuiButton-root,
        .MuiIconButton-root,
        .MuiChip-root,
        .MuiTableRow-root {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Enhanced loading animation */
        .loading-shimmer {
          background: linear-gradient(
            90deg,
            ${alpha(theme.palette.text.secondary, 0.1)} 25%,
            ${alpha(theme.palette.text.secondary, 0.2)} 50%,
            ${alpha(theme.palette.text.secondary, 0.1)} 75%
          );
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Professional hover effects */
        .hover-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px ${alpha(theme.palette.common.black, 0.15)};
        }

        /* Enhanced border animations */
        .border-animate {
          position: relative;
          overflow: hidden;
        }

        .border-animate::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            ${alpha(theme.palette.primary.main, 0.3)},
            transparent
          );
          transition: left 0.5s ease;
        }

        .border-animate:hover::before {
          left: 100%;
        }

        /* Professional card shadows */
        .card-elevated {
          box-shadow: 
            0 1px 3px ${alpha(theme.palette.common.black, 0.12)},
            0 1px 2px ${alpha(theme.palette.common.black, 0.24)};
        }

        .card-elevated:hover {
          box-shadow: 
            0 14px 28px ${alpha(theme.palette.common.black, 0.25)},
            0 10px 10px ${alpha(theme.palette.common.black, 0.22)};
        }

        /* Typography enhancements */
        .typography-gradient {
          background: linear-gradient(
            135deg, 
            ${theme.palette.primary.main}, 
            ${theme.palette.secondary.main}
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Enhanced status indicators */
        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-success {
          background: ${alpha(theme.palette.success.main, 0.1)};
          color: ${theme.palette.success.main};
          border: 1px solid ${alpha(theme.palette.success.main, 0.3)};
        }

        .status-error {
          background: ${alpha(theme.palette.error.main, 0.1)};
          color: ${theme.palette.error.main};
          border: 1px solid ${alpha(theme.palette.error.main, 0.3)};
        }

        .status-processing {
          background: ${alpha(theme.palette.warning.main, 0.1)};
          color: ${theme.palette.warning.main};
          border: 1px solid ${alpha(theme.palette.warning.main, 0.3)};
        }

        /* Professional loading states */
        .skeleton {
          background: ${alpha(theme.palette.text.secondary, 0.11)};
          border-radius: 4px;
          animation: skeleton-loading 1.2s ease-in-out infinite;
        }

        @keyframes skeleton-loading {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }

        /* Enhanced table styling */
        .table-professional .MuiTableHead-root {
          background: ${alpha(theme.palette.primary.main, 0.08)};
        }

        .table-professional .MuiTableRow-root:nth-child(even) {
          background: ${alpha(theme.palette.text.secondary, 0.02)};
        }

        .table-professional .MuiTableRow-root:hover {
          background: ${alpha(theme.palette.primary.main, 0.05)} !important;
          transform: scale(1.001);
        }

        /* Enhanced form elements */
        .form-elegant .MuiOutlinedInput-root {
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .form-elegant .MuiOutlinedInput-root:hover {
          box-shadow: 0 2px 8px ${alpha(theme.palette.primary.main, 0.15)};
        }

        .form-elegant .MuiOutlinedInput-root.Mui-focused {
          box-shadow: 0 4px 16px ${alpha(theme.palette.primary.main, 0.25)};
          transform: translateY(-1px);
        }

        /* Accessibility improvements */
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .MuiButton-root,
          .MuiIconButton-root,
          .MuiChip-root {
            border: 2px solid currentColor !important;
          }
        }

        /* Print styles */
        @media print {
          .no-print {
            display: none !important;
          }
          
          .print-friendly {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default Upload;

