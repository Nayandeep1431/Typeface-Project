const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  alerts: {
    enabled: { type: Boolean, default: true },
    thresholds: {
      warning: { type: Number, default: 80 }, // percentage
      critical: { type: Number, default: 95 }
    }
  },
  rollover: {
    enabled: { type: Boolean, default: false },
    carryOverAmount: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
