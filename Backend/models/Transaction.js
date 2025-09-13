const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true, trim: true },
  date: { type: Date, default: Date.now },
  description: { type: String, trim: true },
  merchant: { type: String, trim: true }, // For receipt OCR
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
