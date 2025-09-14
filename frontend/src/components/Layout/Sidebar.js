import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Avatar,
  Skeleton,
} from '@mui/material';
// ✅ FIXED: Import icons from @mui/icons-material
import {
  Dashboard as DashboardIcon,
  AccountBalance as TransactionIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as UploadIcon,
  Logout as LogoutIcon,
  AccountCircle as ProfileIcon,
} from '@mui/icons-material';
import { logout } from '../../features/auth/authSlice';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Transactions', icon: <TransactionIcon />, path: '/transactions' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  { text: 'Upload', icon: <UploadIcon />, path: '/upload' },
];

const Sidebar = ({ mobileOpen, handleDrawerToggle, isMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  // ✅ Get user data from Redux auth state
  const { user, isLoading } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

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

  // ✅ Helper function to get user status/role
  const getUserStatus = () => {
    if (!user) return 'Guest';
    
    // Check for role/subscription status
    if (user.role === 'admin') return 'Admin User';
    if (user.subscription === 'premium') return 'Premium User';
    if (user.subscription === 'pro') return 'Pro User';
    if (user.isPremium) return 'Premium User';
    
    return 'Free User';
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
          💰 FinanceTracker
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Personal Finance Assistant
        </Typography>
      </Box>

      <Divider />

      {/* ✅ Dynamic Profile Section */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        {isLoading ? (
          // Loading state
          <>
            <Skeleton variant="circular" width={64} height={64} sx={{ mx: 'auto', mb: 2 }} />
            <Skeleton variant="text" width="60%" sx={{ mx: 'auto', mb: 0.5 }} />
            <Skeleton variant="text" width="40%" sx={{ mx: 'auto' }} />
          </>
        ) : (
          <>
            <Avatar 
              sx={{ 
                width: 64, 
                height: 64, 
                mx: 'auto', 
                mb: 2, 
                bgcolor: 'primary.main',
                fontSize: '1.5rem',
                fontWeight: 700
              }}
              src={user?.avatar || user?.profilePicture} // Use avatar if available
            >
              {user?.avatar || user?.profilePicture ? null : getUserInitials()}
            </Avatar>
            
            <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
              {getUserDisplayName()}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {getUserStatus()}
            </Typography>
            
            {/* ✅ Optional: Show user email */}
            {user?.email && (
              <Typography variant="caption" color="text.secondary" sx={{ 
                display: 'block',
                opacity: 0.7,
                fontSize: '0.7rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
                mx: 'auto'
              }}>
                {user.email}
              </Typography>
            )}
          </>
        )}
      </Box>

      <Divider />

      {/* Navigation */}
      <List sx={{ px: 2, py: 1, flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                // Close mobile drawer when item is clicked
                if (isMobile && mobileOpen) {
                  handleDrawerToggle();
                }
              }}
              sx={{
                borderRadius: 2,
                py: 1.5,
                backgroundColor: location.pathname === item.path ? 'primary.main' : 'transparent',
                color: location.pathname === item.path ? 'white' : 'text.primary',
                '&:hover': {
                  backgroundColor: location.pathname === item.path ? 'primary.dark' : 'action.hover',
                  transform: 'translateX(4px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <ListItemIcon sx={{ 
                color: location.pathname === item.path ? 'white' : 'text.secondary',
                minWidth: 40 
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontWeight: location.pathname === item.path ? 600 : 500 
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* ✅ Enhanced Logout Section */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            py: 1.5,
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'white',
              transform: 'translateX(4px)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText 
            primary="Logout" 
            primaryTypographyProps={{ fontWeight: 500 }}
          />
        </ListItemButton>
        
        {/* ✅ Optional: Show app version */}
        <Typography variant="caption" color="text.secondary" sx={{ 
          display: 'block', 
          textAlign: 'center', 
          mt: 2,
          opacity: 0.6,
          fontSize: '0.7rem'
        }}>
          v1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
    >
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))'
            },
          }}
        >
          {drawer}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02))',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      )}
    </Box>
  );
};

export default Sidebar;
