const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Food', 'Transportation', 'Medical', 'Project', 'Utilities', 'Shopping', 'Entertainment', 'Healthcare', 'Bills', 'Rent', 'Other']
  },
  type: {
    type: String,
    required: true,
    enum: ['Expense', 'Income']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    maxlength: 500
  },
  fileUrl: {
    type: String,
    required: true
  },
  needsManualAmount: {
    type: Boolean,
    default: false
  },
  ocrConfidence: {
    type: String,
    enum: ['high', 'medium', 'low', 'none'],
    default: 'medium'
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
