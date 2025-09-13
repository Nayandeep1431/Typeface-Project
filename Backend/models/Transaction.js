const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: function() {
      return !this.needsManualReview;
    },
    min: 0
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    default: 'expense',
    required: true
  },
  category: {
    type: String,
    required: true,
    default: 'Other Expense'
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  // File and processing metadata
  fileUrl: {
    type: String
  },
  extractedText: {
    type: String
  },
  ocrMethod: {
    type: String,
    enum: [
      'Enhanced Tesseract OCR',
      'Google Vision API',
      'PDF Processing',
      'Enhanced PDF Processing',
      'Multi-pass Tesseract',
      'pdf-parse',
      'Manual Entry',
      'Unknown'
    ],
    default: 'Unknown'
  },
  aiParsed: {
    type: Boolean,
    default: false
  },
  needsManualReview: {
    type: Boolean,
    default: false
  },
  // Processing statistics
  processingStats: {
    ocrConfidence: {
      type: Number,
      min: 0,
      max: 100
    },
    processingTime: {
      type: Number,
      min: 0
    },
    textLength: {
      type: Number,
      min: 0
    }
  },
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for better query performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, needsManualReview: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
