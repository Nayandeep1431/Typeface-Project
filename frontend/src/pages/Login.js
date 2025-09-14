import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
} from '@mui/material';
import { AccountBalance as LogoIcon } from '@mui/icons-material';
import { loginUser, registerUser, clearError } from '../features/auth/authSlice';

const Login = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { isLoading, error } = useSelector((state) => state.auth);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Clear error when switching between login/register
  useEffect(() => {
    dispatch(clearError());
    setValidationErrors({});
  }, [isLogin, dispatch]);

  const validateForm = () => {
    const errors = {};
    
    if (!isLogin && (!formData.username || formData.username.length < 3)) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (isLogin) {
      dispatch(loginUser({ email: formData.email, password: formData.password }));
    } else {
      dispatch(registerUser(formData));
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      email: '',
      password: '',
    });
    setValidationErrors({});
    dispatch(clearError());
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            backgroundColor: theme.palette.mode === 'light' 
              ? 'rgba(255, 255, 255, 0.95)' 
              : 'rgba(18, 18, 18, 0.95)',
            color: theme.palette.text.primary,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <LogoIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              mb: 1,
              color: theme.palette.text.primary 
            }}>
              FinanceTracker
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isLogin ? 'Welcome back!' : 'Create your account'}
            </Typography>
          </Box>

          {/* Global error alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                margin="normal"
                variant="outlined"
                required
                error={!!validationErrors.username}
                helperText={validationErrors.username}
                inputProps={{ minLength: 3, maxLength: 30 }}
                sx={{
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: theme.palette.mode === 'light' 
                        ? 'rgba(0, 0, 0, 0.23)' 
                        : 'rgba(255, 255, 255, 0.23)',
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.mode === 'light' 
                        ? 'rgba(0, 0, 0, 0.87)' 
                        : 'rgba(255, 255, 255, 0.87)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                }}
              />
            )}
            
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              variant="outlined"
              required
              error={!!validationErrors.email}
              helperText={validationErrors.email}
              sx={{
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: theme.palette.mode === 'light' 
                      ? 'rgba(0, 0, 0, 0.23)' 
                      : 'rgba(255, 255, 255, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.mode === 'light' 
                      ? 'rgba(0, 0, 0, 0.87)' 
                      : 'rgba(255, 255, 255, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            />
            
            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              variant="outlined"
              required
              error={!!validationErrors.password}
              helperText={validationErrors.password || 'Minimum 6 characters'}
              inputProps={{ minLength: 6 }}
              sx={{
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: theme.palette.mode === 'light' 
                      ? 'rgba(0, 0, 0, 0.23)' 
                      : 'rgba(255, 255, 255, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.mode === 'light' 
                      ? 'rgba(0, 0, 0, 0.87)' 
                      : 'rgba(255, 255, 255, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                isLogin ? 'Sign In' : 'Sign Up'
              )}
            </Button>
          </form>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Link
                component="button"
                variant="body2"
                onClick={(e) => {
                  e.preventDefault();
                  toggleMode();
                }}
                sx={{ 
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
