import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Badge,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

const Navbar = ({ handleDrawerToggle }) => {
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
        <IconButton
          color="inherit"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { lg: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Welcome back! 👋
          </Typography>
        </motion.div>

        <Box sx={{ flexGrow: 1 }} />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit">
              <SearchIcon />
            </IconButton>
            
            <IconButton color="inherit">
              <Badge badgeContent={3} color="error">
                <NotificationIcon />
              </Badge>
            </IconButton>

            <ThemeToggle />

            <Avatar 
              sx={{ 
                width: 32, 
                height: 32, 
                bgcolor: 'primary.main',
                ml: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                }
              }}
            >
              JD
            </Avatar>
          </Box>
        </motion.div>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
