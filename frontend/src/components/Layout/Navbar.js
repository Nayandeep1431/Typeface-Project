import React from 'react';
import { useSelector } from 'react-redux';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

const Navbar = ({ handleDrawerToggle }) => {
  // ✅ Get user data from Redux auth state
  const { user } = useSelector((state) => state.auth);

  // ✅ Helper function to get user display name
  const getUserDisplayName = () => {
    if (!user) return 'Guest User';
    
    // Priority order: name -> username -> email name -> fallback
    if (user.name) return user.name;
    if (user.username) return user.username;
    if (user.email) {
      // Extract name from email (before @)
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'User';
  };

  // ✅ Helper function to get user avatar initials
  const getUserInitials = () => {
    const displayName = getUserDisplayName();
    if (displayName === 'Guest User' || displayName === 'User') return 'U';
    
    const nameParts = displayName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  };

  // ✅ Helper function to get personalized welcome message
  const getWelcomeMessage = () => {
    const displayName = getUserDisplayName();
    const firstName = displayName.split(' ')[0];
    
    const currentHour = new Date().getHours();
    let greeting = 'Hello';
    
    if (currentHour < 12) {
      greeting = 'Good morning';
    } else if (currentHour < 17) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }

    return `${greeting}, ${firstName}! 👋`;
  };

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        backgroundColor: 'background.paper',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary'
      }}
    >
      <Toolbar>
        {/* ✅ Mobile Menu Button */}
        <IconButton
          color="inherit"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { lg: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* ✅ Dynamic Welcome Message */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {getWelcomeMessage()}
          </Typography>
        </motion.div>

        {/* ✅ Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* ✅ Right Side Icons - Cleaned Up */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* ✅ Theme Toggle */}
            <ThemeToggle />

            {/* ✅ Dynamic User Avatar */}
            <Avatar 
              sx={{ 
                width: 36, 
                height: 36, 
                bgcolor: 'primary.main',
                fontSize: '0.875rem',
                fontWeight: 700,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }
              }}
              src={user?.avatar || user?.profilePicture} // Use avatar if available
              alt={getUserDisplayName()}
            >
              {/* ✅ Show initials only if no profile picture */}
              {user?.avatar || user?.profilePicture ? null : getUserInitials()}
            </Avatar>

            {/* ✅ Optional: User Name (Hidden on mobile) */}
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500,
                display: { xs: 'none', md: 'block' },
                color: 'text.secondary'
              }}
            >
              {getUserDisplayName().split(' ')[0]}
            </Typography>
          </Box>
        </motion.div>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
