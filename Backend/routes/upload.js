const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const ocrService = require('../services/ocrService');
const aiParsingService = require('../services/aiParsingService');
const cloudinaryService = require('../services/cloudinaryService');
const Expense = require('../models/Expense');

const router = express.Router();

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png', 
      'image/jpg',
      'image/gif',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF) and PDF files are allowed.'));
    }
  }
});

/**
 * POST /api/upload
 * Upload and process receipt file
 */
router.post('/', auth, upload.single('file'), async (req, res) => {
  const processingStartTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a file.',
        error: 'FILE_MISSING'
      });
    }

    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    
    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const userId = req.user.id;

    // Step 1: Upload to Cloudinary
    console.log('☁️ Uploading file to Cloudinary...');
    const uploadResult = await cloudinaryService.uploadFile(fileBuffer, {
      public_id: `receipt_${userId}_${Date.now()}`,
      tags: ['receipt', 'expense', userId]
    });

    // Step 2: Extract text using OCR
    console.log('🔍 Extracting text using OCR...');
    const ocrResult = await ocrService.extractText(fileBuffer, mimeType, (message, progress) => {
      console.log(`📊 OCR Progress: ${message} (${Math.round(progress)}%)`);
    });

    if (!ocrResult.text || ocrResult.text.trim().length < 10) {
      // Still save the file info even if OCR fails
      const emptyExpense = new Expense({
        userId,
        date: new Date(),
        amount: null,
        description: 'OCR processing failed - manual entry required',
        category: 'Other Expense',
        type: 'expense',
        fileUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        needsManualAmount: true,
        extractedText: ocrResult.text || '',
        ocrMethod: ocrResult.method,
        aiParsed: false,
        processingStats: {
          totalTextLength: 0,
          processingTime: Date.now() - processingStartTime,
          ocrConfidence: 0
        }
      });

      await emptyExpense.save();

      return res.json({
        success: true,
        message: 'File uploaded but OCR extraction failed. Please add expense details manually.',
        expenses: [emptyExpense],
        fileUrl: uploadResult.url,
        stats: {
          totalExpenses: 1,
          hasAmount: 0,
          needsManualAmount: 1,
          ocrMethod: ocrResult.method,
          processingTime: Date.now() - processingStartTime
        },
        ocrPreview: 'OCR text extraction failed'
      });
    }

    console.log(`📝 OCR extracted ${ocrResult.text.length} characters using ${ocrResult.method}`);

    // Step 3: Parse expenses using AI
    console.log('🤖 Parsing expenses with AI...');
    const parsedExpenses = await aiParsingService.parseExpenses(ocrResult.text);
    
    if (parsedExpenses.length === 0) {
      // Create a single expense entry for manual processing
      const manualExpense = new Expense({
        userId,
        date: new Date(),
        amount: null,
        description: 'Receipt processed - manual review needed',
        category: 'Other Expense',
        type: 'expense',
        fileUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        needsManualAmount: true,
        extractedText: ocrResult.text,
        ocrMethod: ocrResult.method,
        aiParsed: false,
        processingStats: {
          totalTextLength: ocrResult.text.length,
          processingTime: Date.now() - processingStartTime,
          ocrConfidence: ocrResult.confidence
        }
      });

      await manualExpense.save();

      return res.json({
        success: true,
        message: 'Receipt processed but no clear line items found. Please review and add expenses manually.',
        expenses: [manualExpense],
        fileUrl: uploadResult.url,
        stats: {
          totalExpenses: 1,
          hasAmount: 0,
          needsManualAmount: 1,
          ocrMethod: ocrResult.method,
          processingTime: Date.now() - processingStartTime
        },
        ocrPreview: ocrResult.text.substring(0, 500) + (ocrResult.text.length > 500 ? '...' : '')
      });
    }

    // Step 4: Save parsed expenses to database
    console.log(`💾 Saving ${parsedExpenses.length} expenses to database...`);
    const savedExpenses = [];
    
    for (const expenseData of parsedExpenses) {
      const expense = new Expense({
        userId,
        date: new Date(), // Use current date, could be enhanced to extract from receipt
        amount: expenseData.amount,
        description: expenseData.description,
        category: expenseData.category,
        type: expenseData.type,
        fileUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        needsManualAmount: expenseData.needsManualAmount,
        extractedText: ocrResult.text,
        ocrMethod: ocrResult.method,
        aiParsed: true,
        processingStats: {
          totalTextLength: ocrResult.text.length,
          processingTime: Date.now() - processingStartTime,
          ocrConfidence: ocrResult.confidence
        }
      });

      try {
        const savedExpense = await expense.save();
        savedExpenses.push(savedExpense);
        console.log(`✅ Saved expense: ${savedExpense.description} - ₹${savedExpense.amount || 'N/A'}`);
      } catch (saveError) {
        console.error('❌ Error saving expense:', saveError.message);
        // Continue with other expenses
      }
    }

    // Step 5: Generate response with statistics
    const stats = aiParsingService.getParsingStats(savedExpenses);
    const totalProcessingTime = Date.now() - processingStartTime;

    console.log(`🎉 Processing completed in ${totalProcessingTime}ms`);
    console.log(`📊 Results: ${stats.totalExpenses} expenses, ${stats.hasAmount} with amounts, ${stats.needsManualAmount} need manual review`);

    res.json({
      success: true,
      message: `Successfully processed receipt and extracted ${savedExpenses.length} expense(s).`,
      expenses: savedExpenses,
      fileUrl: uploadResult.url,
      stats: {
        ...stats,
        ocrMethod: ocrResult.method,
        ocrConfidence: ocrResult.confidence,
        processingTime: totalProcessingTime,
        textLength: ocrResult.text.length
      },
      ocrPreview: ocrResult.text.substring(0, 500) + (ocrResult.text.length > 500 ? '...' : '')
    });

  } catch (error) {
    console.error('❌ Upload processing error:', error);

    // Clean up uploaded file if processing fails
    if (req.uploadResult?.publicId) {
      try {
        await cloudinaryService.deleteFile(req.uploadResult.publicId);
      } catch (cleanupError) {
        console.error('❌ Cleanup error:', cleanupError.message);
      }
    }

    // Return appropriate error response
    const statusCode = error.message.includes('file type') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'File processing failed',
      error: error.name || 'PROCESSING_ERROR',
      processingTime: Date.now() - processingStartTime
    });
  }
});

/**
 * GET /api/upload/progress/:id
 * Get processing progress (placeholder for WebSocket implementation)
 */
router.get('/progress/:id', auth, (req, res) => {
  // This would be implemented with WebSockets for real-time progress
  res.json({
    success: true,
    progress: {
      stage: 'completed',
      percentage: 100,
      message: 'Processing completed'
    }
  });
});

module.exports = router;
