import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import { DarkMode, LightMode } from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ size = 'medium' }) => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <Tooltip title={`Switch to ${darkMode ? 'Light' : 'Dark'} Mode`}>
      <IconButton 
        onClick={toggleDarkMode} 
        color="inherit" 
        size={size}
        sx={{ 
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: 'action.hover',
          }
        }}
      >
        <motion.div
          key={darkMode ? 'dark' : 'light'}
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 180, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {darkMode ? <LightMode /> : <DarkMode />}
        </motion.div>
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
