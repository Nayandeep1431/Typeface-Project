const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: false  // Can be null for manual entry needed
  },
  description: { 
    type: String, 
    required: true, 
    trim: true 
  },
  category: { 
    type: String, 
    required: true, 
    enum: [
      'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
      'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 
      'Groceries', 'Other Expense'
    ]
  },
  type: { 
    type: String, 
    enum: ['income', 'expense'], 
    default: 'expense' 
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  merchant: { 
    type: String, 
    trim: true 
  },
  fileUrl: { 
    type: String 
  },
  cloudinaryPublicId: { 
    type: String 
  },
  needsManualAmount: { 
    type: Boolean, 
    default: false 
  },
  extractedText: { 
    type: String 
  },
  ocrMethod: { 
    type: String, 
    enum: ['tesseract', 'google-vision', 'pdf-parse'] 
  },
  aiParsed: { 
    type: Boolean, 
    default: false 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  processingStats: {
    totalTextLength: { type: Number, default: 0 },
    processingTime: { type: Number, default: 0 },
    ocrConfidence: { type: Number, default: 0 }
  }
}, { 
  timestamps: true 
});

// Static method to get expenses by user
ExpenseSchema.statics.getExpensesByUser = function(userId, filters = {}) {
  const query = { userId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Expense', ExpenseSchema);
