import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { DeleteForever as DeleteIcon, Warning as WarningIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

const DeleteConfirmDialog = ({ 
  open, 
  onClose, 
  onConfirm, 
  title = 'Delete Transaction', 
  message, 
  isLoading = false 
}) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 1 }}
            >
              <WarningIcon sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
            </motion.div>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              This action cannot be undone.
            </Typography>
          </Alert>
          
          <Typography variant="body1" sx={{ textAlign: 'center' }}>
            {message || 'Are you sure you want to delete this transaction?'}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
          <Button 
            onClick={onClose}
            variant="outlined"
            disabled={isLoading}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={onConfirm}
              variant="contained"
              color="error"
              disabled={isLoading}
              startIcon={<DeleteIcon />}
              sx={{ minWidth: 120 }}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </motion.div>
        </DialogActions>
      </motion.div>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
