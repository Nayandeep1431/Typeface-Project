const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Environment variables validation and setup
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

console.log('🔍 Environment Check:');
console.log('✅ NODE_ENV:', process.env.NODE_ENV);
console.log('✅ PORT:', process.env.PORT || 5000);
console.log('✅ MongoDB URI:', process.env.MONGODB_URI ? 'Connected' : '❌ Missing');
console.log('✅ JWT Secret:', process.env.JWT_SECRET ? 'Set' : '❌ Missing');
console.log('✅ Cloudinary:', process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : '❌ Missing');
console.log('✅ Gemini API:', process.env.GEMINI_API_KEY ? 'Set' : '❌ Missing');
console.log('---');

// Import routes
let authRoutes, transactionRoutes, uploadRoutes, expenseRoutes;

try {
  authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
  process.exit(1);
}

try {
  transactionRoutes = require('./routes/transactions');
  console.log('✅ Transaction routes loaded');
} catch (error) {
  console.error('❌ Failed to load transaction routes. Creating minimal routes...');
  transactionRoutes = express.Router();
  transactionRoutes.get('/', (req, res) => {
    res.json({ success: true, data: [], message: 'Transaction routes not implemented yet' });
  });
}

try {
  uploadRoutes = require('./routes/uploadRoutes');
  console.log('✅ Upload routes loaded');
} catch (error) {
  console.error('❌ Failed to load upload routes:', error.message);
  console.error('Upload functionality will not work. Please check routes/uploadRoutes.js');
  uploadRoutes = express.Router();
  uploadRoutes.all('*', (req, res) => {
    res.status(500).json({ 
      success: false, 
      error: 'Upload routes not properly configured. Check server logs.' 
    });
  });
}

try {
  expenseRoutes = require('./routes/expenses');
  console.log('✅ Expense routes loaded');
} catch (error) {
  console.warn('⚠️ Expense routes not found, creating placeholder...');
  expenseRoutes = express.Router();
  expenseRoutes.get('/', (req, res) => {
    res.json({ success: true, data: [], message: 'Expense routes not implemented yet' });
  });
}

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.includes('/upload') && req.method === 'POST';
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// CRITICAL: Remove the problematic middleware that interferes with file uploads
// DO NOT USE express.raw for upload routes - let multer handle it
// app.use('/api/upload', express.raw({ type: 'multipart/form-data', limit: '10mb' }));

// Body parsing middleware - FIXED: Apply to non-upload routes only
app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) {
    // Skip JSON parsing for upload routes - let multer handle the raw data
    return next();
  }
  // Apply JSON parsing to all other routes
  express.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) {
    // Skip URL encoding for upload routes
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  console.log('📊 Database:', mongoose.connection.name);
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Cloudinary connection
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.api.ping()
    .then(() => {
      console.log("✅ Connected to Cloudinary");
      console.log("☁️ Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
    })
    .catch((err) => {
      console.error("❌ Cloudinary connection failed:", err.message);
      console.warn("Upload features will not work properly");
    });
} else {
  console.error("❌ Cloudinary credentials missing");
}

// Request logging for debugging uploads
app.use((req, res, next) => {
  if (req.path.includes('/upload')) {
    console.log(`📤 ${req.method} ${req.path}`);
    console.log(`   Content-Type: ${req.get('Content-Type')}`);
    console.log(`   Content-Length: ${req.get('Content-Length')} bytes`);
    console.log(`   User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
  }
  next();
});

// Routes - CRITICAL: Order matters
console.log('🔗 Setting up routes...');
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/upload', uploadRoutes); // Multer handles multipart data here
app.use('/api/expenses', expenseRoutes);

console.log('✅ Routes configured:');
console.log('   📍 /api/auth/* (Authentication)');
console.log('   📍 /api/transactions/* (Transactions CRUD)');
console.log('   📍 /api/upload/receipt (Receipt upload)');
console.log('   📍 /api/upload/bank-statement (Bank statement upload)');
console.log('   📍 /api/expenses/* (Expenses CRUD)');

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not configured'
    },
    memory: process.memoryUsage(),
    version: '1.0.0'
  };
  res.json(health);
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Finance Tracker API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth (POST /register, POST /login)',
      transactions: '/api/transactions (GET, POST, PUT, DELETE)',
      upload: '/api/upload (POST /receipt, POST /bank-statement)',
      expenses: '/api/expenses (GET, PUT, DELETE)',
      health: '/api/health (GET)'
    },
    documentation: 'Visit /api/health for system status',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for upload functionality
app.get('/api/upload/test', (req, res) => {
  res.json({
    message: 'Upload routes are working',
    endpoints: {
      receipt: 'POST /api/upload/receipt',
      bankStatement: 'POST /api/upload/bank-statement'
    },
    requirements: {
      authentication: 'Required (Bearer token)',
      fileTypes: {
        receipt: 'image/jpeg, image/png, image/gif',
        bankStatement: 'application/pdf'
      },
      maxFileSize: '10MB',
      middleware: 'Multer handles multipart/form-data'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: ['/api/auth', '/api/transactions', '/api/upload', '/api/expenses', '/api/health'],
    timestamp: new Date().toISOString()
  });
});

// Enhanced global error handler
app.use((error, req, res, next) => {
  console.error('🚨 Global Error:', error);
  
  // Handle multer errors specifically
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 10MB.'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field. Use "file" as the field name.'
    });
  }
  
  // Handle busboy/multipart errors
  if (error.message && error.message.includes('Unexpected end of form')) {
    return res.status(400).json({
      success: false,
      error: 'File upload incomplete. Please try again with a valid file.',
      details: 'The multipart form data was not properly received.'
    });
  }
  
  if (error.message && error.message.includes('Missing boundary')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file upload format. Please ensure you are sending a proper multipart form.',
      details: 'Content-Type boundary is missing or invalid.'
    });
  }
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.values(error.errors).map(e => e.message)
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate entry'
    });
  }

  // Handle authentication errors
  if (error.name === 'UnauthorizedError' || error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication required or token invalid'
    });
  }

  // Generic error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error 
    })
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('🎉 ===================================');
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  console.log(`📋 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API Info: http://localhost:${PORT}/api`);
  console.log(`🧪 Upload Test: http://localhost:${PORT}/api/upload/test`);
  console.log('🎉 ===================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
