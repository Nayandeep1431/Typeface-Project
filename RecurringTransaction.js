const mongoose = require('mongoose');

const recurringTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  type: {
    type: String,
    required: true,
    enum: ['income', 'expense']
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  frequency: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  nextDue: {
    type: Date,
    required: true
  },
  lastProcessed: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  processedCount: {
    type: Number,
    default: 0
  },
  merchant: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

recurringTransactionSchema.index({ userId: 1, nextDue: 1 });
recurringTransactionSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('RecurringTransaction', recurringTransactionSchema);
