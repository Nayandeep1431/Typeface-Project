const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const vision = require('@google-cloud/vision');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const Transaction = require('../models/Transaction');
const axios = require('axios');

// Apply authentication middleware
router.use(auth);

// Initialize Vision API client (optional, with error handling)
let visionClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_PROJECT_ID) {
  try {
    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_PROJECT_ID
    });
    console.log('✅ Google Vision API client initialized');
  } catch (error) {
    console.warn('⚠️ Google Vision API initialization failed:', error.message);
  }
} else {
  console.warn('⚠️ Google Vision API credentials not configured');
}

// Configure multer properly
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 Multer processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      console.log('✅ File type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ File type rejected:', file.mimetype);
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF) and PDF files are allowed.`));
    }
  }
});

// Helper function: Enhanced OCR with multiple passes
async function extractTextFromImageMultiPass(buffer) {
  const psmModes = [3, 6, 8, 4, 7];
  let bestResult = { text: '', confidence: 0 };
  
  console.log('🔍 Running enhanced multi-pass Tesseract OCR...');
  
  for (let i = 0; i < psmModes.length; i++) {
    try {
      const psm = psmModes[i];
      console.log(`📝 OCR pass ${i + 1}/${psmModes.length} with PSM ${psm}...`);
      
      const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && Math.floor(m.progress * 100) % 20 === 0) {
            console.log(`📊 Pass ${i + 1} progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        },
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$/.,:|()- \n\t',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        tessedit_ocr_engine_mode: 2
      });
      
      const score = confidence * (text.length / 100);
      const prevScore = bestResult.confidence * (bestResult.text.length / 100);
      
      if (score > prevScore && text.trim().length > 10) {
        bestResult = { text: text.trim(), confidence };
        console.log(`✅ New best result from pass ${i + 1}: confidence ${confidence}%, ${text.length} chars`);
      }
      
    } catch (error) {
      console.warn(`⚠️ OCR pass ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('✅ Enhanced OCR completed. Best confidence:', bestResult.confidence, '% Text length:', bestResult.text.length);
  return bestResult.text;
}

// Helper function: Enhanced PDF text extraction
async function extractTextFromPdf(buffer) {
  console.log('📄 Starting enhanced PDF text extraction...');
  
  // Try Google Vision API first if available
  if (visionClient) {
    try {
      console.log('🔍 Using Google Vision API for PDF OCR...');
      
      const [result] = await visionClient.documentTextDetection({
        image: { content: buffer }
      });
      
      if (result.fullTextAnnotation && result.fullTextAnnotation.text.trim().length > 20) {
        const visionText = result.fullTextAnnotation.text.trim();
        console.log('✅ Vision API extracted text:', visionText.length, 'characters');
        console.log('📝 Vision API preview:', visionText.substring(0, 200));
        return visionText;
      }
    } catch (visionError) {
      console.warn('⚠️ Google Vision API failed:', visionError.message);
    }
  }
  
  // Fallback to pdf-parse
  try {
    console.log('📄 Using pdf-parse for text extraction...');
    const pdfData = await pdfParse(buffer, {
      max: 0,
      version: 'v1.10.100'
    });
    
    if (pdfData.text && pdfData.text.trim().length > 0) {
      console.log('✅ pdf-parse extracted text:', pdfData.text.length, 'characters');
      console.log('📄 Number of pages:', pdfData.numpages);
      console.log('📝 pdf-parse preview:', pdfData.text.substring(0, 200));
      return pdfData.text.trim();
    }
    
    throw new Error('No text found in PDF');
  } catch (parseError) {
    console.error('❌ pdf-parse failed:', parseError.message);
    throw new Error(`PDF text extraction failed: ${parseError.message}`);
  }
}

// Helper function: Enhanced Cloudinary upload with proper URL handling
function uploadBufferToCloudinary(buffer, filename, fileType = 'auto') {
  return new Promise((resolve, reject) => {
    try {
      console.log('☁️ Starting enhanced Cloudinary upload...');
      
      // Generate a clean filename
      const timestamp = Date.now();
      const cleanFilename = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, '_') : 'upload';
      const publicId = `expense_${timestamp}_${cleanFilename}`;
      
      const uploadOptions = {
        resource_type: fileType === 'pdf' ? 'raw' : 'image',
        folder: 'expense-tracker',
        public_id: publicId,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        // Optimization for images
        ...(fileType !== 'pdf' && {
          format: 'jpg',
          quality: 'auto:good',
          fetch_format: 'auto'
        })
      };
      
      console.log('📤 Upload options:', uploadOptions);
      
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            console.log('✅ Cloudinary upload successful:');
            console.log('   📎 URL:', result.secure_url);
            console.log('   🆔 Public ID:', result.public_id);
            console.log('   📏 Size:', result.bytes, 'bytes');
            console.log('   📋 Format:', result.format);
            
            // Ensure we return a proper Cloudinary URL
            const finalUrl = result.secure_url.startsWith('https://res.cloudinary.com/') 
              ? result.secure_url 
              : `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/${result.resource_type}/upload/${result.public_id}.${result.format}`;
            
            resolve({
              url: finalUrl,
              publicId: result.public_id,
              size: result.bytes,
              format: result.format,
              resourceType: result.resource_type
            });
          }
        }
      );

      uploadStream.end(buffer);
      
    } catch (error) {
      console.error('❌ Cloudinary setup error:', error);
      reject(new Error(`Cloudinary initialization failed: ${error.message}`));
    }
  });
}

// Helper function: Enhanced Gemini API
async function callEnhancedGeminiAPI(extractedText, filename = '', retryCount = 0) {
  const maxRetries = 3;
  
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not configured, skipping AI parsing');
    throw new Error('Gemini API key not configured');
  }
  
  try {
    console.log('🤖 Calling Enhanced Gemini AI for expense parsing...');
    console.log('📝 Input text length:', extractedText.length);
    console.log('📄 Processing file:', filename);
    
    const prompt = `
You are an expert financial data parser. Parse this text EXACTLY as written and extract financial transactions.

ORIGINAL TEXT:
"""
${extractedText}
"""

CRITICAL RULES:
1. Extract ONLY the data that is clearly visible in the text
2. Preserve EXACT dates, amounts, and descriptions as written
3. If a table structure is present, parse each row as a separate transaction
4. Do not invent or assume data that isn't clearly present
5. For dates: keep the original format but ensure it's valid
6. For amounts: extract exact numbers as written
7. For categories: use exact category names if present, otherwise categorize logically

EXPECTED OUTPUT FORMAT (JSON Array):
[
  {
    "date": "2025-09-14",
    "amount": 500.00,
    "type": "expense",
    "category": "Food & Dining",
    "description": "exact description from text",
    "needsManualReview": false
  }
]

CATEGORY MAPPING:
- Food items, meals, restaurants → "Food & Dining"
- Medical, healthcare, medicine → "Healthcare" 
- Transport, fuel, taxi → "Transportation"
- Salary, income, project → "Income"
- Shopping, retail → "Shopping"
- Bills, utilities → "Bills & Utilities"
- Other cases → "Other Expense"

TYPE RULES:
- Use "income" for salaries, payments received, refunds
- Use "expense" for purchases, bills, payments made

Parse the text now and return ONLY a valid JSON array:`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1,
          maxOutputTokens: 2000,
          topP: 0.8
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      },
      {
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    const candidate = response.data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Invalid Gemini response structure');
    }

    const geminiText = candidate.content.parts[0].text;
    console.log('🤖 Gemini raw response:', geminiText);

    // Enhanced JSON extraction
    let jsonMatch = geminiText.match(/\[[\s\S]*?\]/);
    
    if (!jsonMatch) {
      jsonMatch = geminiText.match(/``````/);
      if (jsonMatch) jsonMatch[0] = jsonMatch[1];
    }
    
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      console.log('📊 Extracted JSON:', jsonString);
      
      const expenseArray = JSON.parse(jsonString);
      const validatedArray = Array.isArray(expenseArray) ? expenseArray : [expenseArray];
      
      console.log(`✅ Gemini parsed ${validatedArray.length} transactions`);
      return validatedArray.map(validateAndEnhanceTransaction);
    } else {
      throw new Error('No valid JSON found in Gemini response');
    }

  } catch (error) {
    console.error('❌ Enhanced Gemini API Error:', error.response?.data || error.message);
    
    if ((error.response?.status === 503 || error.message.includes('overloaded')) && retryCount < maxRetries) {
      const delay = (retryCount + 1) * 3;
      console.log(`⏳ Gemini overloaded, retrying in ${delay} seconds... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      return callEnhancedGeminiAPI(extractedText, filename, retryCount + 1);
    }
    
    throw error;
  }
}

// Helper function: Enhanced transaction validation
function validateAndEnhanceTransaction(transaction) {
  console.log('🔍 Validating transaction:', transaction);
  
  // Clean description
  let description = String(transaction.description || '').trim();
  if (!description || description.length === 0) {
    description = `${transaction.category || 'Other'} transaction`;
  }

  // Enhanced date parsing
  let date = new Date();
  if (transaction.date) {
    const dateStr = String(transaction.date).trim();
    
    // Try parsing the date
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
      console.log(`📅 Parsed date: ${dateStr} → ${date.toDateString()}`);
    } else {
      // Try manual parsing for different formats
      const dateFormats = [
        /^(\d{2})-(\d{2})-(\d{2,4})$/, // DD-MM-YY or DD-MM-YYYY
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
        /^(\d{2})\/(\d{2})\/(\d{2,4})$/, // DD/MM/YY or MM/DD/YYYY
      ];
      
      for (const format of dateFormats) {
        const match = dateStr.match(format);
        if (match) {
          let day, month, year;
          
          if (format.source.includes('(\\d{4})')) {
            // YYYY-MM-DD format
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          } else {
            // DD-MM-YY or DD/MM/YY format
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            year = parseInt(match[3]);
            
            // Handle 2-digit years
            if (year < 50) {
              year += 2000;
            } else if (year < 100) {
              year += 1900;
            }
          }
          
          date = new Date(year, month, day);
          console.log(`📅 Manual parsed date: ${dateStr} → ${date.toDateString()}`);
          break;
        }
      }
    }
  }

  // Enhanced amount validation
  let amount = null;
  let needsManualReview = false;
  
  if (transaction.amount !== undefined && transaction.amount !== null) {
    const numAmount = parseFloat(String(transaction.amount).replace(/[^\d.-]/g, ''));
    if (!isNaN(numAmount) && numAmount > 0) {
      amount = Math.round(numAmount * 100) / 100; // Round to 2 decimal places
    } else {
      needsManualReview = true;
    }
  } else {
    needsManualReview = true;
  }

  // Enhanced category validation
  const validCategories = [
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 
    'Groceries', 'Other Expense', 'Income'
  ];
  
  let category = String(transaction.category || 'Other Expense').trim();
  
  // Category mapping
  const categoryMap = {
    'Food': 'Food & Dining',
    'Medical': 'Healthcare',
    'Transport': 'Transportation',
    'Project': 'Income',
    'Work': 'Income',
    'Salary': 'Income'
  };
  
  if (categoryMap[category]) {
    category = categoryMap[category];
  } else if (!validCategories.includes(category)) {
    category = 'Other Expense';
  }

  // Type validation
  let type = String(transaction.type || 'expense').toLowerCase();
  if (!['income', 'expense'].includes(type)) {
    type = 'expense';
  }

  const result = {
    description,
    amount,
    category,
    type,
    date,
    needsManualReview,
    extractedData: {
      original: transaction,
      parsed: { description, amount, category, type, date: date.toISOString() }
    }
  };
  
  console.log('✅ Validated transaction:', {
    description: result.description,
    amount: result.amount,
    category: result.category,
    type: result.type,
    needsReview: result.needsManualReview
  });
  
  return result;
}

// Helper function: Fallback parsing for when Gemini fails
function fallbackSmartParsing(extractedText) {
  console.log('🔧 Starting enhanced fallback parsing...');
  
  const transactions = [];
  const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 3);
  
  console.log(`📝 Processing ${lines.length} lines for fallback parsing`);
  
  // Enhanced patterns for better parsing
  const tablePattern = /(\d{2}[-\/]\d{2}[-\/]\d{2,4})\s+(\d+(?:\.\d{2})?)\s+(\w+)\s+([\w\s]+)/;
  const amountPattern = /\b(\d+(?:\.\d{2})?)\b/g;
  const datePattern = /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try to match table structure first
    const tableMatch = line.match(tablePattern);
    if (tableMatch) {
      transactions.push({
        date: tableMatch[1],
        amount: parseFloat(tableMatch[2]),
        type: tableMatch[3].toLowerCase().includes('income') ? 'income' : 'expense',
        category: tableMatch[4].trim() || 'Other Expense',
        description: `${tableMatch[4].trim()} transaction`,
        needsManualReview: false
      });
      continue;
    }
    
    // Look for amounts in the line
    const amounts = [...line.matchAll(amountPattern)];
    const dateMatch = line.match(datePattern);
    
    if (amounts.length > 0) {
      for (const amountMatch of amounts) {
        const amount = parseFloat(amountMatch[1]);
        if (amount >= 1 && amount <= 50000) {
          const description = line.replace(amountMatch[0], '').trim() || 'Extracted item';
          transactions.push({
            date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
            amount: amount,
            type: 'expense',
            category: 'Other Expense',
            description: description.substring(0, 100), // Limit description length
            needsManualReview: false
          });
        }
      }
    }
  }
  
  // If no transactions found, create a manual entry placeholder
  if (transactions.length === 0) {
    transactions.push({
      date: new Date().toISOString().split('T')[0],
      amount: null,
      type: 'expense',
      category: 'Other Expense',
      description: 'Unable to parse - manual entry required',
      needsManualReview: true
    });
  }
  
  console.log(`🔧 Fallback parsing found ${transactions.length} transactions`);
  return transactions.map(validateAndEnhanceTransaction);
}

// Enhanced error handling middleware for multer
const handleMulterErrors = (error, req, res, next) => {
  console.error('📤 Multer Error:', error);
  
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 10MB.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field. Use "file" as the field name.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files. Upload one file at a time.'
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Upload error: ${error.message}`
        });
    }
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next(error);
};

// Receipt upload endpoint
router.post('/receipt', (req, res, next) => {
  console.log('📸 Receipt upload request started');
  console.log('   Content-Type:', req.get('Content-Type'));
  console.log('   Content-Length:', req.get('Content-Length'));
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error during receipt upload:', err);
      return handleMulterErrors(err, req, res, next);
    }
    
    handleReceiptUpload(req, res, next);
  });
});

// Receipt processing function
const handleReceiptUpload = async (req, res, next) => {
  const processingStartTime = Date.now();
  let uploadResult = null;
  
  try {
    console.log('📸 Processing receipt upload...');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select an image file.',
        error: 'FILE_MISSING'
      });
    }

    console.log('✅ File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fieldname: req.file.fieldname
    });

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Receipt upload expects image files only. Use bank statement upload for PDFs.',
        error: 'INVALID_FILE_TYPE',
        received: req.file.mimetype
      });
    }

    const fileBuffer = req.file.buffer;
    const userId = req.user._id || req.user.id;
    const filename = req.file.originalname;

    console.log('👤 User ID:', userId);
    console.log('📄 Processing image:', filename);

    // Step 1: Upload to Cloudinary
    console.log('☁️ Uploading image to Cloudinary...');
    uploadResult = await uploadBufferToCloudinary(fileBuffer, filename, 'image');

    // Step 2: Extract text using enhanced OCR
    console.log('🔍 Extracting text using enhanced OCR...');
    const extractedText = await extractTextFromImageMultiPass(fileBuffer);

    if (!extractedText || extractedText.trim().length < 10) {
      console.log('⚠️ OCR extraction failed or returned minimal text');
      
      // Create a transaction that needs manual review
      const emptyTransaction = new Transaction({
        user: userId,
        date: new Date(),
        amount: null,
        description: 'OCR processing failed - manual entry required',
        category: 'Other Expense',
        type: 'expense',
        fileUrl: uploadResult.url,
        needsManualReview: true,
        extractedText: extractedText || '',
        ocrMethod: 'Multi-pass Tesseract',
        aiParsed: false,
        processingStats: {
          ocrConfidence: 0,
          processingTime: Date.now() - processingStartTime,
          textLength: extractedText?.length || 0
        }
      });

      await emptyTransaction.save();

      return res.json({
        success: true,
        message: 'Image uploaded but text extraction failed. Please add expense details manually.',
        expenses: [emptyTransaction],
        transactions: [emptyTransaction],
        fileUrl: uploadResult.url,
        stats: {
          totalExpenses: 1,
          hasAmount: 0,
          needsManualAmount: 1,
          ocrMethod: 'Multi-pass Tesseract',
          processingTime: Date.now() - processingStartTime,
          textLength: extractedText?.length || 0
        },
        ocrPreview: extractedText || 'OCR text extraction failed'
      });
    }

    console.log('📝 OCR Success! Extracted text:');
    console.log('   📏 Length:', extractedText.length, 'characters');
    console.log('   📄 Preview:', extractedText.substring(0, 300));

    // Step 3: Parse expenses using enhanced AI
    let parsedTransactions = [];
    let parsingMethod = '';
    
    try {
      console.log('🤖 Trying Enhanced Gemini AI parsing...');
      parsedTransactions = await callEnhancedGeminiAPI(extractedText, filename);
      parsingMethod = 'Enhanced Gemini 1.5 Flash AI';
      
      if (!parsedTransactions || parsedTransactions.length === 0) {
        throw new Error('Gemini returned empty result');
      }
      
      console.log(`✅ Gemini successfully parsed ${parsedTransactions.length} transactions`);
      
    } catch (geminiError) {
      console.log('⚠️ Gemini AI failed, using enhanced fallback parsing...');
      console.log('❌ Gemini error:', geminiError.message);
      parsedTransactions = fallbackSmartParsing(extractedText);
      parsingMethod = 'Enhanced Fallback Parsing';
    }

    // Step 4: Save transactions to database
    console.log(`💾 Saving ${parsedTransactions.length} transactions to database...`);
    const savedTransactions = [];
    
    for (const transactionData of parsedTransactions) {
      try {
        const transaction = new Transaction({
          user: userId,
          date: transactionData.date,
          amount: transactionData.amount,
          description: transactionData.description,
          category: transactionData.category,
          type: transactionData.type,
          fileUrl: uploadResult.url,
          needsManualReview: transactionData.needsManualReview,
          extractedText: extractedText,
          ocrMethod: 'Multi-pass Tesseract',
          aiParsed: parsingMethod.includes('Gemini'),
          processingStats: {
            ocrConfidence: 85,
            processingTime: Date.now() - processingStartTime,
            textLength: extractedText.length
          }
        });

        const savedTransaction = await transaction.save();
        savedTransactions.push(savedTransaction);
        
        const status = savedTransaction.needsManualReview ? '🚨 NEEDS REVIEW' : `✅ ₹${savedTransaction.amount}`;
        console.log(`💾 Saved: ${savedTransaction.description} - ${status}`);
        
      } catch (saveError) {
        console.error('❌ Error saving transaction:', saveError.message);
      }
    }

    // Step 5: Generate comprehensive response
    const stats = {
      totalExpenses: savedTransactions.length,
      hasAmount: savedTransactions.filter(t => t.amount && t.amount > 0).length,
      needsManualAmount: savedTransactions.filter(t => t.needsManualReview).length,
      ocrMethod: 'Multi-pass Tesseract',
      parsingMethod: parsingMethod,
      ocrConfidence: 85,
      processingTime: Date.now() - processingStartTime,
      textLength: extractedText.length
    };

    console.log(`🎉 Receipt processing completed in ${stats.processingTime}ms`);
    console.log(`📊 Results: ${stats.totalExpenses} expenses, ${stats.hasAmount} with amounts, ${stats.needsManualAmount} need review`);

    res.json({
      success: true,
      message: `Successfully processed receipt and extracted ${savedTransactions.length} expense(s). ${stats.needsManualAmount > 0 ? `${stats.needsManualAmount} expense(s) need manual review.` : ''}`,
      expenses: savedTransactions,
      transactions: savedTransactions,
      fileUrl: uploadResult.url,
      stats,
      ocrPreview: extractedText.substring(0, 1000) + (extractedText.length > 1000 ? '...' : ''),
      rawOcrText: extractedText
    });

  } catch (error) {
    console.error('❌ Receipt processing error:', error);

    // Cleanup on failure
    if (uploadResult?.publicId) {
      try {
        await cloudinary.uploader.destroy(uploadResult.publicId);
        console.log('🧹 Cleaned up failed upload');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup upload:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Receipt processing failed',
      error: error.name || 'PROCESSING_ERROR',
      processingTime: Date.now() - processingStartTime
    });
  }
};

// Bank statement upload endpoint
router.post('/bank-statement', (req, res, next) => {
  console.log('🏦 Bank statement upload request started');
  console.log('   Content-Type:', req.get('Content-Type'));
  console.log('   Content-Length:', req.get('Content-Length'));
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error during bank statement upload:', err);
      return handleMulterErrors(err, req, res, next);
    }
    
    handleBankStatementUpload(req, res, next);
  });
});

// Bank statement processing function
const handleBankStatementUpload = async (req, res, next) => {
  const processingStartTime = Date.now();
  let uploadResult = null;
  
  try {
    console.log('🏦 Processing bank statement upload...');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a PDF file.',
        error: 'FILE_MISSING'
      });
    }

    console.log('✅ File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fieldname: req.file.fieldname
    });

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Bank statements must be PDF files',
        error: 'INVALID_FILE_TYPE',
        received: req.file.mimetype,
        expected: 'application/pdf'
      });
    }

    const fileBuffer = req.file.buffer;
    const userId = req.user._id || req.user.id;
    const filename = req.file.originalname;

    console.log('👤 User ID:', userId);
    console.log('📄 Processing PDF:', filename);

    // Step 1: Upload to Cloudinary
    console.log('☁️ Uploading PDF to Cloudinary...');
    uploadResult = await uploadBufferToCloudinary(fileBuffer, filename, 'pdf');

    // Step 2: Extract text from PDF
    console.log('📄 Extracting text from PDF...');
    const extractedText = await extractTextFromPdf(fileBuffer);
    
    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('PDF text extraction failed or returned empty content');
    }

    console.log('📄 PDF text extraction completed:');
    console.log('   📏 Length:', extractedText.length, 'characters');
    console.log('   📄 Preview:', extractedText.substring(0, 200));

    // Step 3: Parse using enhanced AI
    let parsedTransactions = [];
    let parsingMethod = '';
    
    try {
      console.log('🤖 Parsing with enhanced Gemini AI...');
      parsedTransactions = await callEnhancedGeminiAPI(extractedText, filename);
      parsingMethod = 'Enhanced Gemini 1.5 Flash AI';
    } catch (geminiError) {
      console.log('⚠️ Gemini failed for PDF, using fallback...');
      parsedTransactions = fallbackSmartParsing(extractedText);
      parsingMethod = 'Enhanced Fallback Parsing';
    }

    console.log(`📊 Parsed ${parsedTransactions.length} transactions using ${parsingMethod}`);

    // Step 4: Save transactions
    const savedTransactions = [];
    for (const transactionData of parsedTransactions) {
      try {
        const transaction = new Transaction({
          user: userId,
          date: transactionData.date,
          amount: transactionData.amount,
          description: transactionData.description || 'Bank statement import',
          category: transactionData.category || 'Bank Transaction',
          type: transactionData.type || 'expense',
          fileUrl: uploadResult.url,
          needsManualReview: transactionData.needsManualReview,
          extractedText: extractedText,
          ocrMethod: 'PDF Processing',
          aiParsed: parsingMethod.includes('Gemini'),
          processingStats: {
            ocrConfidence: 90,
            processingTime: Date.now() - processingStartTime,
            textLength: extractedText.length
          }
        });

        const saved = await transaction.save();
        savedTransactions.push(saved);
        
        const status = saved.needsManualReview ? '🚨 NEEDS REVIEW' : `✅ ₹${saved.amount}`;
        console.log(`💾 Saved: ${saved.description} - ${status}`);
        
      } catch (saveError) {
        console.error('❌ Error saving transaction:', saveError.message);
      }
    }

    // Step 5: Generate response
    const stats = {
      totalTransactions: savedTransactions.length,
      hasAmount: savedTransactions.filter(t => t.amount && t.amount > 0).length,
      needsManualAmount: savedTransactions.filter(t => t.needsManualReview).length,
      processingTime: Date.now() - processingStartTime,
      extractionMethod: 'PDF Processing',
      parsingMethod: parsingMethod
    };

    console.log(`🎉 Bank statement processing completed in ${stats.processingTime}ms`);

    res.json({
      success: true,
      message: `Successfully imported ${savedTransactions.length} transaction(s) from bank statement.${stats.needsManualAmount > 0 ? ` ${stats.needsManualAmount} transaction(s) need manual review.` : ''}`,
      transactions: savedTransactions,
      expenses: savedTransactions, // Also provide for frontend compatibility
      fileUrl: uploadResult.url,
      stats,
      ocrPreview: extractedText.substring(0, 1000) + (extractedText.length > 1000 ? '...' : ''),
      rawOcrText: extractedText
    });

  } catch (error) {
    console.error('❌ Bank statement processing error:', error);
    
    // Cleanup on failure
    if (uploadResult?.publicId) {
      try {
        await cloudinary.uploader.destroy(uploadResult.publicId);
        console.log('🧹 Cleaned up failed upload');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup upload:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Bank statement processing failed',
      processingTime: Date.now() - processingStartTime,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Apply error handling middleware
router.use(handleMulterErrors);

module.exports = router;
