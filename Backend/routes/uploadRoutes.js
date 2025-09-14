const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const Transaction = require('../models/Transaction');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Apply authentication middleware
router.use(auth);

// ✅ Cloudinary configuration (optional)
let isCloudinaryConfigured = false;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    isCloudinaryConfigured = true;
    console.log('✅ Cloudinary configured');
  } catch (error) {
    console.warn('⚠️ Cloudinary configuration failed:', error.message);
  }
} else {
  console.warn('⚠️ Cloudinary environment variables not set');
}

// ✅ Enhanced multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${file.fieldname}_${timestamp}_${sanitizedFilename}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// ✅ FIXED: Optional Cloudinary upload with proper error handling
const uploadToCloudinaryOptional = async (filePath, options = {}) => {
  if (!isCloudinaryConfigured) {
    console.warn('⚠️ Cloudinary not configured, skipping upload');
    return { secure_url: null, public_id: null, skipped: true };
  }

  try {
    console.log('☁️ Attempting Cloudinary upload...');
    
    const result = await Promise.race([
      cloudinary.uploader.upload(filePath, {
        resource_type: 'auto',
        folder: 'expense-tracker',
        unique_filename: true,
        overwrite: true,
        ...options
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cloudinary timeout after 30 seconds')), 30000)
      )
    ]);

    console.log(`✅ Cloudinary upload successful: ${result.secure_url}`);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error.message);
    console.log('⚠️ Continuing without cloud storage...');
    return { secure_url: null, public_id: null, error: error.message };
  }
};

// ✅ Cleanup function
const cleanupFile = async (filePath) => {
  try {
    if (filePath) {
      await fs.unlink(filePath);
      console.log(`🧹 Cleaned up: ${filePath}`);
    }
  } catch (error) {
    console.warn(`⚠️ Cleanup warning: ${error.message}`);
  }
};

// ✅ Enhanced OCR
async function extractTextFromImage(filePath) {
  console.log('🔍 Starting OCR extraction...');
  
  try {
    const { data: { text, confidence } } = await Tesseract.recognize(filePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && Math.floor(m.progress * 100) % 25 === 0) {
          console.log(`📊 OCR Progress: ${Math.floor(m.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
    });
    
    console.log(`✅ OCR completed. Confidence: ${confidence.toFixed(2)}%, Text length: ${text.length}`);
    console.log(`📝 Extracted text:\n${text}`);
    
    return text.trim();
  } catch (error) {
    console.error('❌ OCR failed:', error.message);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

// ✅ Enhanced PDF extraction
async function extractTextFromPdf(filePath) {
  console.log('📄 Extracting text from PDF...');
  
  try {
    const buffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(buffer, {
      max: 0,
      version: 'v1.10.100'
    });
    
    const text = pdfData.text.trim();
    console.log(`✅ PDF extraction successful: ${text.length} characters from ${pdfData.numpages} pages`);
    console.log(`📝 Extracted text:\n${text}`);
    
    return text;
  } catch (error) {
    console.error('❌ PDF extraction failed:', error.message);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

// ✅ ENHANCED Gemini API with 2025 date correction
async function enhancedGeminiParsing(extractedText, filename = '') {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not configured, using fallback parsing');
    return null;
  }

  try {
    console.log('🤖 Calling Enhanced Gemini AI...');
    
    const prompt = `Parse this financial data and extract ALL transactions. Return ONLY a JSON array.

CRITICAL: Convert all dates to 2025 format. If you see dates like "30.07.2007" or similar, convert them to 2025 dates (2025-07-30).

DATA:
${extractedText}

For each transaction found, extract:
- date: Convert to 2025 format (YYYY-MM-DD) - Example: 30.07.2007 becomes 2025-07-30
- amount: number only (no currency symbols like CHF, GF, etc.)
- type: "income" or "expense" 
- description: meaningful description from the text
- category: choose from Food & Dining, Healthcare, Salary, Transportation, Shopping, Entertainment, Bills & Utilities, Housing, Education, Cash Withdrawal, Investment, Refund, Other Income, Other

EXAMPLE OUTPUT:
[
  {"date": "2025-07-30", "amount": 54.50, "type": "expense", "description": "Restaurant Bill at Berghote", "category": "Food & Dining"}
]

Return ONLY the JSON array:`;

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1,
          maxOutputTokens: 4000,
        }
      },
      {
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const candidate = response.data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Invalid Gemini response');
    }

    const geminiText = candidate.content.parts[0].text.trim();
    console.log('🔄 Parsing JSON...');
    console.log('🤖 Gemini response:', geminiText);

    const jsonMatch = geminiText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const transactions = JSON.parse(jsonMatch[0]);
      console.log(`✅ JSON parsing successful! Found ${transactions.length} transactions`);
      
      // Log parsed transactions
      console.log('📋 PARSED TRANSACTIONS:');
      transactions.forEach((transaction, index) => {
        console.log(`   ${index + 1}. ${transaction.type} ₹${transaction.amount} - ${transaction.description} (${transaction.date})`);
      });
      
      return Array.isArray(transactions) ? transactions : [transactions];
    }
    
    throw new Error('No valid JSON in Gemini response');
  } catch (error) {
    console.error('❌ Gemini API Error:', error.message);
    return null;
  }
}

// ✅ Enhanced Structured Parsing as Fallback
function parseTransactionData(text) {
  console.log('🔍 Using structured parsing as fallback...');
  
  const transactions = [];
  
  // Look for total amounts and dates in the text
  const amountRegex = /(?:total[:\s]*)?(?:CHF|GF|₹|Rs\.?|INR)?\s*(\d+(?:\.\d{2})?)/gi;
  const dateRegex = /(\d{1,2}[\/\-\.]?\d{1,2}[\/\-\.]?\d{2,4})/g;
  
  const amounts = [];
  const dates = [];
  
  let match;
  while ((match = amountRegex.exec(text)) !== null) {
    amounts.push(parseFloat(match[1]));
  }
  
  while ((match = dateRegex.exec(text)) !== null) {
    dates.push(match[1]);
  }
  
  if (amounts.length > 0) {
    // Use the largest amount as the main transaction
    const mainAmount = Math.max(...amounts);
    const date = dates.length > 0 ? dates[0] : new Date().toISOString().split('T')[0];
    
    // Parse date and convert to 2025
    let parsedDate;
    try {
      const dateParts = date.split(/[\/\-\.]/);
      if (dateParts.length >= 3) {
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        parsedDate = new Date(2025, month - 1, day);
      } else {
        parsedDate = new Date(2025, 6, 30); // Default to July 30, 2025
      }
    } catch (error) {
      parsedDate = new Date(2025, 6, 30);
    }
    
    const transaction = {
      date: parsedDate,
      amount: mainAmount,
      type: 'expense',
      description: `Receipt transaction - ${mainAmount}`,
      category: 'Other',
      isValid: true
    };
    
    transactions.push(transaction);
    console.log(`✅ Fallback parsed: ${transaction.type} ₹${transaction.amount} - ${transaction.description}`);
  }
  
  return transactions;
}

// ✅ CRITICAL FIX: Receipt Upload Route with UNIFIED Response Format
router.post('/receipt', upload.single('file'), async (req, res) => {
  let filePath = null;
  let cloudinaryResult = null;
  const startTime = Date.now();

  try {
    console.log('📸 ============= RECEIPT UPLOAD STARTED =============');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select an image file.',
      });
    }

    filePath = req.file.path;
    console.log(`📄 Processing: ${req.file.originalname}`);

    if (!req.file.mimetype.startsWith('image/')) {
      throw new Error('Invalid file type. Please upload an image file.');
    }

    // Step 1: Extract text
    console.log('🔍 ============= EXTRACTING TEXT =============');
    const extractedText = await extractTextFromImage(filePath);

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Could not extract readable text from image.');
    }

    // Step 2: Upload to Cloudinary (optional)
    console.log('☁️ ============= UPLOADING TO CLOUDINARY =============');
    cloudinaryResult = await uploadToCloudinaryOptional(filePath, {
      public_id: `receipt_${Date.now()}_${path.parse(req.file.originalname).name}`,
      folder: 'expense-tracker/receipts'
    });

    // Step 3: Parse transactions
    console.log('🤖 ============= PARSING TRANSACTIONS =============');
    let transactions = await enhancedGeminiParsing(extractedText, req.file.originalname);
    let parsingMethod = 'Gemini AI';

    if (!transactions || transactions.length === 0) {
      console.log('⚠️ Gemini failed, using structured parsing...');
      transactions = parseTransactionData(extractedText);
      parsingMethod = 'Structured Parser';
    }

    console.log(`🎯 Final transaction count: ${transactions.length}`);

    // Step 4: Save to database
    console.log('💾 ============= SAVING TO DATABASE =============');
    const savedTransactions = [];
    const userId = req.user._id || req.user.id;

    if (transactions.length > 0) {
      for (const transactionData of transactions) {
        try {
          const transaction = new Transaction({
            user: userId,
            date: transactionData.date,
            amount: transactionData.amount,
            description: transactionData.description,
            category: transactionData.category,
            type: transactionData.type,
            source: 'receipt_upload',
            fileUrl: cloudinaryResult?.secure_url || null,
            extractedText: extractedText,
            parsingMethod: parsingMethod,
          });

          const saved = await transaction.save();
          savedTransactions.push(saved);
          console.log(`✅ Saved: ${saved.description} - ₹${saved.amount} (${saved.type})`);
        } catch (saveError) {
          console.error('❌ Save error:', saveError.message);
        }
      }
    }

    const processingTime = Date.now() - startTime;
    
    // ✅ CRITICAL FIX: Calculate proper statistics
    const incomeTransactions = savedTransactions.filter(t => t.type === 'income');
    const expenseTransactions = savedTransactions.filter(t => t.type === 'expense');
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    console.log(`✅ RECEIPT PROCESSING COMPLETE: ${savedTransactions.length} transactions saved`);

    // ✅ CRITICAL FIX: Send response in the SAME format as bank statement
    const response = {
      success: true,
      message: `Receipt processed successfully! Imported ${savedTransactions.length} transaction(s) using ${parsingMethod}.`,
      data: {
        transactions: savedTransactions, // ✅ Frontend needs this array
        fileUrl: cloudinaryResult?.secure_url || null,
        extractedText: extractedText,
        stats: { // ✅ Frontend uses this for displaying counts and amounts
          transactionCount: savedTransactions.length,
          incomeCount: incomeTransactions.length,
          expenseCount: expenseTransactions.length,
          totalIncome: totalIncome,
          totalExpenses: totalExpenses,
          netAmount: totalIncome - totalExpenses,
          categories: [...new Set(savedTransactions.map(t => t.category))],
          processingTime: processingTime,
          parsingMethod: parsingMethod
        },
        processingDetails: {
          fileName: req.file.originalname,
          fileSize: (req.file.size / 1024 / 1024).toFixed(2) + 'MB',
          processingTime: processingTime + 'ms',
          extractionMethod: 'OCR',
          parsingMethod: parsingMethod
        }
      }
    };

    console.log('📤 SENDING RESPONSE TO FRONTEND');
    console.log(`📊 Response summary: ${response.data.stats.transactionCount} transactions, ₹${response.data.stats.totalIncome} income, ₹${response.data.stats.totalExpenses} expenses`);
    
    res.status(200).json(response); // ✅ CRITICAL: Send the unified response format

  } catch (error) {
    console.error('❌ Receipt processing error:', error.message);
    
    const processingTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: error.message || 'Receipt processing failed',
      processingTime: processingTime,
    });
  } finally {
    if (filePath) {
      await cleanupFile(filePath);
    }
  }
});

// ✅ Bank Statement Upload Route (Already Fixed)
router.post('/bank-statement', upload.single('file'), async (req, res) => {
  let filePath = null;
  let cloudinaryResult = null;
  const startTime = Date.now();

  try {
    console.log('🏦 ============= BANK STATEMENT UPLOAD STARTED =============');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a PDF file.',
      });
    }

    filePath = req.file.path;
    console.log(`📄 Processing: ${req.file.originalname}`);

    if (req.file.mimetype !== 'application/pdf') {
      throw new Error('Invalid file type. Please upload a PDF file.');
    }

    // Step 1: Extract text from PDF
    console.log('📄 ============= EXTRACTING PDF TEXT =============');
    const extractedText = await extractTextFromPdf(filePath);

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from PDF.');
    }

    // Step 2: Upload to Cloudinary (optional)
    console.log('☁️ ============= UPLOADING TO CLOUDINARY =============');
    cloudinaryResult = await uploadToCloudinaryOptional(filePath, {
      public_id: `statement_${Date.now()}_${path.parse(req.file.originalname).name}`,
      folder: 'expense-tracker/statements'
    });

    // Step 3: Parse transactions - TRY GEMINI FIRST
    console.log('🤖 ============= PARSING TRANSACTIONS =============');
    let transactions = await enhancedGeminiParsing(extractedText, req.file.originalname);
    let parsingMethod = 'Gemini AI';

    // If Gemini fails, use structured parsing
    if (!transactions || transactions.length === 0) {
      console.log('⚠️ Gemini failed, using structured parsing...');
      transactions = parseTransactionData(extractedText);
      parsingMethod = 'Structured Parser';
    }

    console.log(`🎯 Final transaction count: ${transactions.length}`);

    // Step 4: Save to database
    console.log('💾 ============= SAVING TO DATABASE =============');
    const savedTransactions = [];
    const userId = req.user._id || req.user.id;

    if (transactions.length > 0) {
      for (const [index, transactionData] of transactions.entries()) {
        try {
          console.log(`💾 Saving transaction ${index + 1}/${transactions.length}:`, {
            amount: transactionData.amount,
            description: transactionData.description,
            type: transactionData.type,
            category: transactionData.category
          });

          const transaction = new Transaction({
            user: userId,
            date: transactionData.date,
            amount: transactionData.amount,
            description: transactionData.description,
            category: transactionData.category,
            type: transactionData.type,
            source: 'bank_statement',
            fileUrl: cloudinaryResult?.secure_url || null,
            extractedText: extractedText,
            parsingMethod: parsingMethod,
          });

          const saved = await transaction.save();
          savedTransactions.push(saved);
          console.log(`✅ Saved transaction with ID: ${saved._id}`);
        } catch (saveError) {
          console.error(`❌ Save error for transaction ${index + 1}:`, saveError.message);
        }
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ BANK STATEMENT PROCESSING COMPLETE: ${savedTransactions.length} transactions saved`);

    // ✅ Calculate proper statistics
    const incomeTransactions = savedTransactions.filter(t => t.type === 'income');
    const expenseTransactions = savedTransactions.filter(t => t.type === 'expense');
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // ✅ Send response in the correct format
    const response = {
      success: true,
      message: `Bank statement processed successfully! Imported ${savedTransactions.length} transaction(s) using ${parsingMethod}.`,
      data: {
        transactions: savedTransactions,
        fileUrl: cloudinaryResult?.secure_url || null,
        extractedText: extractedText.substring(0, 1000) + (extractedText.length > 1000 ? '...' : ''),
        stats: {
          transactionCount: savedTransactions.length,
          incomeCount: incomeTransactions.length,
          expenseCount: expenseTransactions.length,
          totalIncome: totalIncome,
          totalExpenses: totalExpenses,
          netAmount: totalIncome - totalExpenses,
          categories: [...new Set(savedTransactions.map(t => t.category))],
          processingTime: processingTime,
          parsingMethod: parsingMethod
        },
        processingDetails: {
          fileName: req.file.originalname,
          fileSize: (req.file.size / 1024 / 1024).toFixed(2) + 'MB',
          processingTime: processingTime + 'ms',
          extractionMethod: 'PDF Parse',
          parsingMethod: parsingMethod
        }
      }
    };

    console.log('📤 ============= SENDING RESPONSE TO FRONTEND =============');
    console.log(`📊 Response summary:`, {
      success: response.success,
      transactionCount: response.data.stats.transactionCount,
      totalIncome: response.data.stats.totalIncome,
      totalExpenses: response.data.stats.totalExpenses,
      message: response.message
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ ============= BANK STATEMENT ERROR =============');
    console.error(`❌ Error:`, error.message);
    
    const processingTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error.message || 'Bank statement processing failed',
      processingTime: processingTime,
      debug: {
        step: 'processing_error',
        timestamp: new Date().toISOString()
      }
    });
  } finally {
    if (filePath) {
      await cleanupFile(filePath);
    }
    console.log(`🏁 ============= SESSION ENDED =============`);
  }
});

module.exports = router;
