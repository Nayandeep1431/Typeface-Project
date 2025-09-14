const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// -----------------------------------------------------------------------------
// Environment Setup and Validation
// -----------------------------------------------------------------------------

// Default to 'development' if NODE_ENV not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Check for required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

// Log essential environment details for verification
console.log('🔍 Environment Check:');
console.log('✅ NODE_ENV:', process.env.NODE_ENV);
console.log('✅ PORT:', process.env.PORT || 5000);
console.log('✅ MongoDB URI:', process.env.MONGODB_URI ? 'Connected' : '❌ Missing');
console.log('✅ JWT Secret:', process.env.JWT_SECRET ? 'Set' : '❌ Missing');
console.log('✅ Cloudinary:', process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : '❌ Missing');
console.log('✅ Gemini API:', process.env.GEMINI_API_KEY ? 'Set' : '❌ Missing');
console.log('---');

// -----------------------------------------------------------------------------
// Import Routes with Fallbacks
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Initialize Express Application
// -----------------------------------------------------------------------------

const app = express();

// -----------------------------------------------------------------------------
// Middleware Setup
// -----------------------------------------------------------------------------

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Response compression for better performance
app.use(compression());

// Rate limiting middleware for API routes excluding uploads POSTs
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // 200 requests max
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for POST requests to upload routes (file uploads)
    return req.path.includes('/upload') && req.method === 'POST';
  }
});
app.use('/api/', limiter);

// CORS configuration allowing origins based on environment
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] // Set to production frontend URL
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'], // Local dev URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// CRITICAL: Skip express.json and urlencoded for upload routes to avoid file parsing issues
app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) {
    return next(); // Multer will handle upload routes
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) {
    return next(); // Multer handles urlencoded too for upload routes
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// HTTP request logging in development only
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// -----------------------------------------------------------------------------
// Database Connection
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Cloudinary Configuration and Connectivity Check
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Request Logging for Uploads
// -----------------------------------------------------------------------------

app.use((req, res, next) => {
  if (req.path.includes('/upload')) {
    console.log(`📤 ${req.method} ${req.path}`);
    console.log(`   Content-Type: ${req.get('Content-Type')}`);
    console.log(`   Content-Length: ${req.get('Content-Length')} bytes`);
    console.log(`   User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
  }
  next();
});

// -----------------------------------------------------------------------------
// Routes - Order is important!
// -----------------------------------------------------------------------------

console.log('🔗 Setting up routes...');
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/upload', uploadRoutes); // Multer handles multipart uploads here
app.use('/api/expenses', expenseRoutes);

console.log('✅ Routes configured:');
console.log('   📍 /api/auth/* (Authentication)');
console.log('   📍 /api/transactions/* (Transactions CRUD)');
console.log('   📍 /api/upload/receipt (Receipt upload)');
console.log('   📍 /api/upload/bank-statement (Bank statement upload)');
console.log('   📍 /api/expenses/* (Expenses CRUD)');

// -----------------------------------------------------------------------------
// Health Check Endpoint
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// API Documentation Endpoint
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Upload Test Endpoint
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 404 Handler - Catch-all for undefined routes
// -----------------------------------------------------------------------------

app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: ['/api/auth', '/api/transactions', '/api/upload', '/api/expenses', '/api/health'],
    timestamp: new Date().toISOString()
  });
});

// -----------------------------------------------------------------------------
// Global Error Handler - Centralized error processing
// -----------------------------------------------------------------------------

app.use((error, req, res, next) => {
  console.error('🚨 Global Error:', error);

  // Specific multer errors handling
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

  // Busboy/multipart errors
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

  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.values(error.errors).map(e => e.message)
    });
  }

  // Cast errors for invalid IDs
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  // Duplicate key error (Mongo 11000)
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate entry'
    });
  }

  // JWT/authentication errors
  if (error.name === 'UnauthorizedError' || error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication required or token invalid'
    });
  }

  // Generic fallback error handler
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

// -----------------------------------------------------------------------------
// Server Startup and Graceful Shutdown
// -----------------------------------------------------------------------------

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

// Graceful shutdown handling for SIGTERM (e.g., Docker stop)
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

// Handle unhandled promise rejections to avoid silent crashes
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
