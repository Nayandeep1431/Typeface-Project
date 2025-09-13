const multer = require('multer');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const Transaction = require('../models/Transaction');
const path = require('path');
const fs = require('fs');
const { uploadFile } = require('../utils/cloudinary');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Multer configuration
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, uniqueSuffix + extension);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only images (PNG, JPG, JPEG) and PDFs are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single('file');

// Advanced OCR function with multiple PSM modes
async function performAdvancedOCR(filePath) {
  console.log('🔍 Starting advanced OCR processing...');
  
  const psmModes = [6, 7, 8, 4, 3]; // Different page segmentation modes
  const results = [];

  for (let i = 0; i < psmModes.length; i++) {
    const psm = psmModes[i];
    try {
      console.log(`📊 OCR Pass ${i + 1}/${psmModes.length} (PSM: ${psm})`);
      
      const result = await Tesseract.recognize(filePath, 'eng', {
        psm,
        oem: 1,
        whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/-:$ ₹',
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Pass ${i + 1}: ${Math.round(m.progress)}%`);
          }
        }
      });

      if (result.data.text && result.data.text.trim().length > 10) {
        results.push({
          text: result.data.text.trim(),
          confidence: result.data.confidence,
          psm: psm
        });
        console.log(`✅ PSM ${psm} completed - Confidence: ${result.data.confidence}%`);
      }
    } catch (psmError) {
      console.warn(`⚠️ PSM ${psm} failed:`, psmError.message);
    }
  }

  if (results.length === 0) {
    throw new Error('All OCR attempts failed to extract readable text');
  }

  // Select best result based on confidence and text length
  const bestResult = results.reduce((best, current) => {
    const currentScore = current.confidence * (current.text.length / 100);
    const bestScore = best.confidence * (best.text.length / 100);
    return currentScore > bestScore ? current : best;
  });

  console.log(`🎯 Best OCR result: PSM ${bestResult.psm}, Confidence: ${bestResult.confidence}%`);
  
  return {
    text: bestResult.text,
    confidence: bestResult.confidence,
    method: 'tesseract-multi-pass'
  };
}

// PDF text extraction with Google Vision API fallback
async function extractTextFromPDF(filePath) {
  console.log('📄 Starting PDF text extraction...');
  
  try {
    // Primary: Use pdf-parse
    console.log('📋 Using pdf-parse...');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    if (pdfData.text && pdfData.text.trim().length > 0) {
      console.log('✅ PDF-parse successful');
      return {
        text: pdfData.text.trim(),
        confidence: 85,
        method: 'pdf-parse'
      };
    }
    
    throw new Error('No text found in PDF');
  } catch (parseError) {
    console.warn('⚠️ PDF-parse failed:', parseError.message);
    throw new Error(`PDF extraction failed: ${parseError.message}`);
  }
}

// Gemini AI expense extraction and categorization
async function extractExpensesWithGemini(ocrText) {
  console.log('🤖 Starting Gemini AI expense extraction...');
  
  const prompt = `
You are an expert expense data extraction AI. Extract expense line items from this receipt/document OCR text.

CRITICAL RULES:
1. ONLY extract actual line items (products/services purchased)
2. EXCLUDE: taxes, totals, subtotals, discounts, payment methods, store info, headers, footers
3. EXCLUDE: any line that says "TOTAL", "TAX", "SUBTOTAL", "CHANGE", "PAYMENT", "CASH", "CARD"
4. Each item MUST have a description and try to extract amount
5. If no valid line items found, return empty array
6. Categorize items intelligently based on description

OUTPUT FORMAT: Clean JSON array only, no extra text:
[
  {
    "description": "item name/description",
    "amount": numeric_value_only_or_null,
    "category": "Food & Dining|Transportation|Shopping|Entertainment|Bills & Utilities|Healthcare|Education|Travel|Groceries|Other Expense",
    "type": "expense",
    "needsManualAmount": boolean_true_if_amount_is_null
  }
]

CATEGORY MAPPING RULES:
- Food items, restaurants, cafes, meals → "Food & Dining"
- Groceries, supermarkets, food items → "Groceries" 
- Gas stations, parking, transport, uber, taxi → "Transportation"
- Retail stores, clothing, electronics → "Shopping"
- Movies, games, entertainment venues → "Entertainment"
- Utilities, phone bills, internet → "Bills & Utilities"
- Medical, pharmacy, healthcare → "Healthcare"
- Books, courses, education → "Education"
- Hotels, flights, travel → "Travel"
- Everything else → "Other Expense"

AMOUNT EXTRACTION:
- Look for numbers with currency symbols (₹, $, Rs.)
- Look for decimal numbers (10.50, 25.00)
- If amount unclear, set to null and needsManualAmount: true

OCR TEXT TO PARSE:
${ocrText}

Return ONLY the JSON array:`;

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Gemini AI attempt ${attempt}/${maxRetries}`);
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      console.log('📝 Raw Gemini response received');
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in Gemini response');
      }

      const jsonText = jsonMatch[0];
      const rawExpenses = JSON.parse(jsonText);

      if (!Array.isArray(rawExpenses)) {
        throw new Error('Gemini response is not an array');
      }

      // Validate and clean expenses
      const validatedExpenses = rawExpenses
        .map(expense => validateAndCleanExpense(expense))
        .filter(expense => expense !== null);

      console.log(`✅ Gemini AI successfully parsed ${validatedExpenses.length} expenses`);
      return validatedExpenses;

    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Gemini AI attempt ${attempt} failed:`, error.message);
      
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        console.log(`⏳ Server overloaded, waiting ${1000 * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      if (attempt === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('🔄 Gemini AI failed, falling back to regex parsing...');
  return fallbackRegexParsing(ocrText);
}

// Validate and clean expense data
function validateAndCleanExpense(expense) {
  if (!expense || typeof expense !== 'object') {
    return null;
  }

  // Extract and validate amount
  let amount = null;
  let needsManualAmount = true;

  if (expense.amount !== undefined && expense.amount !== null) {
    const numAmount = parseFloat(String(expense.amount).replace(/[^\d.-]/g, ''));
    if (!isNaN(numAmount) && numAmount > 0) {
      amount = numAmount;
      needsManualAmount = false;
    }
  }

  // Validate description
  const description = String(expense.description || '').trim();
  if (!description || description.length === 0) {
    return null;
  }

  // Validate and normalize category
  const validCategories = [
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 
    'Groceries', 'Other Expense'
  ];
  
  let category = String(expense.category || 'Other Expense').trim();
  if (!validCategories.includes(category)) {
    category = 'Other Expense';
  }

  return {
    description,
    amount,
    category,
    type: 'expense',
    needsManualAmount,
    date: new Date()
  };
}

// Fallback regex parsing
function fallbackRegexParsing(ocrText) {
  console.log('🔧 Starting fallback regex parsing...');
  
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const expenses = [];
  
  const amountRegex = /(?:₹|Rs\.?|\$)?(\d+(?:[.,]\d{2})?)\s*$/;
  const excludeKeywords = [
    'total', 'subtotal', 'tax', 'gst', 'vat', 'discount', 'change', 
    'payment', 'cash', 'card', 'balance', 'amount due', 'grand total'
  ];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (excludeKeywords.some(keyword => lowerLine.includes(keyword))) {
      continue;
    }

    const amountMatch = line.match(amountRegex);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      
      if (amount > 0) {
        const description = line.replace(amountRegex, '').trim();
        
        if (description.length > 0) {
          expenses.push({
            description,
            amount,
            category: 'Other Expense',
            type: 'expense',
            needsManualAmount: false,
            date: new Date()
          });
        }
      }
    }
  }

  console.log(`🔧 Regex parsing found ${expenses.length} potential expenses`);
  return expenses.slice(0, 20); // Limit to prevent spam
}

// Main receipt upload handler
exports.uploadReceipt = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer upload error:', err);
      return res.status(400).json({ 
        success: false,
        error: err.message 
      });
    }

    let uploadedFilePath = null;
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        });
      }

      uploadedFilePath = req.file.path;
      console.log('📁 Processing file:', req.file.originalname);

      const ext = path.extname(req.file.filename).toLowerCase();
      if (ext === '.pdf') {
        return res.status(400).json({ 
          success: false,
          error: 'Receipt processing expects image files. Use bank statement upload for PDFs.' 
        });
      }

      // Step 1: Upload to Cloudinary
      console.log('☁️ Uploading to Cloudinary...');
      const cloudinaryResult = await uploadFile(uploadedFilePath);

      // Step 2: Perform advanced OCR
      const ocrResult = await performAdvancedOCR(uploadedFilePath);
      
      if (!ocrResult.text || ocrResult.text.trim().length < 10) {
        return res.status(422).json({
          success: false,
          error: 'Could not extract readable text from image. Please ensure the image is clear and contains text.',
          fileUrl: cloudinaryResult.secure_url
        });
      }

      // Step 3: Extract expenses using Gemini AI
      const extractedExpenses = await extractExpensesWithGemini(ocrResult.text);
      
      if (extractedExpenses.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'Image processed but no expenses found. Please add manually.',
          expenses: [],
          fileUrl: cloudinaryResult.secure_url,
          ocrPreview: ocrResult.text.substring(0, 500),
          stats: {
            totalExpenses: 0,
            hasAmount: 0,
            needsManualAmount: 0,
            ocrMethod: ocrResult.method,
            processingTime: Date.now() - startTime
          }
        });
      }

      // Step 4: Save expenses to database
      console.log(`💾 Saving ${extractedExpenses.length} expenses to database...`);
      const savedExpenses = [];
      
      for (const expenseData of extractedExpenses) {
        const transaction = new Transaction({
          user: req.user._id,
          amount: expenseData.amount,
          type: expenseData.type,
          category: expenseData.category,
          description: expenseData.description,
          date: expenseData.date,
          // Additional metadata
          fileUrl: cloudinaryResult.secure_url,
          extractedText: ocrResult.text,
          ocrMethod: ocrResult.method,
          aiParsed: true,
          needsManualReview: expenseData.needsManualAmount
        });

        try {
          const savedTransaction = await transaction.save();
          savedExpenses.push(savedTransaction);
          console.log(`✅ Saved: ${savedTransaction.description} - ₹${savedTransaction.amount || 'Manual Review'}`);
        } catch (saveError) {
          console.error('❌ Error saving transaction:', saveError.message);
        }
      }

      // Step 5: Generate response statistics
      const stats = {
        totalExpenses: savedExpenses.length,
        hasAmount: savedExpenses.filter(e => e.amount && e.amount > 0).length,
        needsManualAmount: savedExpenses.filter(e => !e.amount || e.needsManualReview).length,
        ocrMethod: ocrResult.method,
        ocrConfidence: ocrResult.confidence,
        processingTime: Date.now() - startTime,
        textLength: ocrResult.text.length
      };

      console.log(`🎉 Processing completed in ${stats.processingTime}ms`);

      res.status(201).json({
        success: true,
        message: `Successfully processed receipt and extracted ${savedExpenses.length} expense(s).`,
        expenses: savedExpenses,
        fileUrl: cloudinaryResult.secure_url,
        ocrPreview: ocrResult.text.substring(0, 500) + (ocrResult.text.length > 500 ? '...' : ''),
        stats
      });

    } catch (error) {
      console.error('❌ Receipt processing error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Receipt processing failed',
        processingTime: Date.now() - startTime
      });
    } finally {
      // Clean up local file
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
          console.log('🗑️ Cleaned up local file');
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup local file:', cleanupError.message);
        }
      }
    }
  });
};

// Bank statement upload handler
exports.uploadBankStatement = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer upload error:', err);
      return res.status(400).json({ 
        success: false,
        error: err.message 
      });
    }

    let uploadedFilePath = null;
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        });
      }

      uploadedFilePath = req.file.path;
      console.log('📁 Processing bank statement:', req.file.originalname);

      if (path.extname(req.file.filename).toLowerCase() !== '.pdf') {
        return res.status(400).json({ 
          success: false,
          error: 'Bank statements must be PDF files' 
        });
      }

      // Step 1: Upload to Cloudinary
      console.log('☁️ Uploading to Cloudinary...');
      const cloudinaryResult = await uploadFile(uploadedFilePath);

      // Step 2: Extract text from PDF
      const textResult = await extractTextFromPDF(uploadedFilePath);
      
      if (!textResult.text || textResult.text.trim().length < 20) {
        return res.status(422).json({
          success: false,
          error: 'Could not extract readable text from PDF. Please ensure the PDF contains transaction data.',
          fileUrl: cloudinaryResult.secure_url
        });
      }

      // Step 3: Extract transactions using Gemini AI
      const extractedTransactions = await extractExpensesWithGemini(textResult.text);
      
      if (extractedTransactions.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'PDF processed but no transactions found.',
          transactions: [],
          fileUrl: cloudinaryResult.secure_url,
          textPreview: textResult.text.substring(0, 500)
        });
      }

      // Step 4: Save transactions to database
      console.log(`💾 Saving ${extractedTransactions.length} transactions to database...`);
      const savedTransactions = [];
      
      for (const transactionData of extractedTransactions) {
        const transaction = new Transaction({
          user: req.user._id,
          amount: transactionData.amount,
          type: transactionData.type,
          category: transactionData.category,
          description: transactionData.description,
          date: transactionData.date,
          // Additional metadata
          fileUrl: cloudinaryResult.secure_url,
          extractedText: textResult.text,
          ocrMethod: textResult.method,
          aiParsed: true,
          needsManualReview: transactionData.needsManualAmount
        });

        try {
          const savedTransaction = await transaction.save();
          savedTransactions.push(savedTransaction);
        } catch (saveError) {
          console.error('❌ Error saving transaction:', saveError.message);
        }
      }

      console.log(`🎉 Bank statement processed in ${Date.now() - startTime}ms`);

      res.status(201).json({
        success: true,
        message: `Successfully imported ${savedTransactions.length} transaction(s) from bank statement.`,
        transactions: savedTransactions,
        fileUrl: cloudinaryResult.secure_url,
        stats: {
          totalTransactions: savedTransactions.length,
          processingTime: Date.now() - startTime,
          extractionMethod: textResult.method
        }
      });

    } catch (error) {
      console.error('❌ Bank statement processing error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Bank statement processing failed',
        processingTime: Date.now() - startTime
      });
    } finally {
      // Clean up local file
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
          console.log('🗑️ Cleaned up local file');
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup local file:', cleanupError.message);
        }
      }
    }
  });
};
