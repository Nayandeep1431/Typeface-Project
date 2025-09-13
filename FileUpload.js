const mongoose = require('mongoose');

const fileUploadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['receipt', 'bank_statement', 'document', 'export'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingResult: {
    extractedText: String,
    detectedMerchant: String,
    detectedAmount: Number,
    detectedDate: Date,
    detectedCategory: String,
    confidence: Number,
    lineItems: [{
      description: String,
      amount: Number
    }]
  },
  transactionsCreated: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }]
}, {
  timestamps: true
});

fileUploadSchema.index({ userId: 1, createdAt: -1 });
fileUploadSchema.index({ status: 1 });

module.exports = mongoose.model('FileUpload', fileUploadSchema);
