const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const vision = require('@google-cloud/vision');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const Expense = require('../models/Expense');
const axios = require('axios');

// Initialize Vision API client for PDFs only
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_PROJECT_ID
});

// Helper: Extract text from image using multiple Tesseract.js passes
async function extractTextFromImageMultiPass(buffer) {
  const psmModes = [3, 6, 8]; // Different page segmentation modes
  let bestResult = { text: '', confidence: 0 };
  
  console.log('🔍 Running multi-pass Tesseract OCR...');
  
  for (let i = 0; i < psmModes.length; i++) {
    try {
      const psm = psmModes[i];
      console.log(`📝 Trying OCR pass ${i + 1}/3 with PSM ${psm}...`);
      
      const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`📝 OCR Pass ${i + 1} progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        },
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$/.,:|() -',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });
      
      if (text.length > bestResult.text.length) {
        bestResult = { text, confidence };
        console.log(`✅ New best result from pass ${i + 1}: ${text.length} chars`);
      }
      
    } catch (error) {
      console.warn(`⚠️ OCR pass ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('✅ Multi-pass OCR completed. Best text length:', bestResult.text.length);
  return bestResult.text;
}

// Helper: Extract text from PDF
async function extractTextFromPdf(buffer) {
  try {
    console.log('🔍 Using Google Cloud Vision API for PDF OCR...');
    
    const [result] = await visionClient.documentTextDetection({
      image: { content: buffer }
    });
    
    if (result.fullTextAnnotation) {
      const fullText = result.fullTextAnnotation.text;
      console.log('✅ Vision API extracted PDF text length:', fullText.length);
      return fullText;
    } else {
      console.log('⚠️ No text detected in PDF by Vision API, trying pdf-parse...');
      const data = await pdfParse(buffer);
      return data.text;
    }
  } catch (error) {
    console.error('❌ Google Vision API PDF Error:', error.message);
    console.log('📄 Falling back to pdf-parse...');
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (parseError) {
      console.error('❌ pdf-parse also failed:', parseError.message);
      throw new Error('All PDF text extraction methods failed');
    }
  }
}

// Helper: Upload buffer to Cloudinary
function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    try {
      if (!cloudinary || !cloudinary.uploader) {
        throw new Error('Cloudinary not properly initialized');
      }

      console.log('☁️ Starting Cloudinary upload...');
      
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'auto',
          folder: 'expenses',
          use_filename: true,
          unique_filename: true
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            console.log('✅ Cloudinary upload success:', result.secure_url);
            resolve(result);
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

// Helper: Smart expense data extraction from text
function extractExpenseDataFromText(extractedText) {
  console.log('🔧 Smart expense extraction from text...');
  
  const expenses = [];
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Extract numbers that could be amounts
  const allNumbers = extractedText.match(/\d+\.?\d*/g) || [];
  const amounts = allNumbers
    .map(n => parseFloat(n))
    .filter(n => n >= 1 && n <= 50000)
    .sort((a, b) => b - a)
    .slice(0, 20);

  console.log('💰 Potential amounts found:', amounts);

  // Look for receipt patterns
  const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 2);
  
  // Pattern: line ending with amount
  const itemPattern = /(.+?)\s+(\d+\.?\d*)$/;
  
  lines.forEach(line => {
    const match = line.match(itemPattern);
    if (match) {
      const description = match[1].trim();
      const amount = parseFloat(match[2]);
      
      if (amount >= 1 && amount <= 10000 && description.length > 1) {
        expenses.push({
          date: currentDate,
          category: getCategoryFromDescription(description),
          type: 'Expense',
          amount: amount,
          description: description,
          needsManualAmount: false,
          ocrConfidence: 'medium'
        });
      }
    }
  });

  // If no pattern matches, create from amounts
  if (expenses.length === 0 && amounts.length > 0) {
    amounts.slice(0, 5).forEach((amount, index) => {
      expenses.push({
        date: currentDate,
        category: 'Other',
        type: 'Expense',
        amount: amount,
        description: `Item ${index + 1}`,
        needsManualAmount: false,
        ocrConfidence: 'low'
      });
    });
  }

  // Create placeholder if nothing found
  if (expenses.length === 0) {
    expenses.push({
      date: currentDate,
      category: 'Other',
      type: 'Expense',
      amount: null,
      description: 'Unable to extract - please add manually',
      needsManualAmount: true,
      ocrConfidence: 'none'
    });
  }

  console.log(`🔧 Created ${expenses.length} expense entries`);
  return expenses;
}

// Helper: Get category from description
function getCategoryFromDescription(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('coffee') || desc.includes('food') || desc.includes('meal') || desc.includes('lunch')) return 'Food';
  if (desc.includes('gas') || desc.includes('fuel') || desc.includes('uber') || desc.includes('taxi')) return 'Transportation';
  if (desc.includes('medicine') || desc.includes('medical') || desc.includes('doctor')) return 'Medical';
  if (desc.includes('electric') || desc.includes('water') || desc.includes('internet')) return 'Utilities';
  
  return 'Other';
}

// Helper: Enhanced Gemini API call
async function callGeminiAPI(extractedText, retryCount = 0) {
  const maxRetries = 2;
  
  try {
    const prompt = `
Extract expense items from this POS receipt text. Return ONLY a JSON array with actual items and prices.

Receipt Text:
"${extractedText}"

Rules:
- Only extract actual expense items with prices
- Skip totals, tax, change, payment info
- Use format: [{"date":"2025-09-13","category":"Food","type":"Expense","amount":12.50,"description":"Coffee"}]
- Categories: Food, Transportation, Medical, Utilities, Shopping, Other

JSON Array:`;

    console.log('🤖 Calling Gemini 1.5 flash model...');
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.3,
          maxOutputTokens: 1500 
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
        timeout: 30000
      }
    );

    const candidate = response.data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Invalid Gemini response structure');
    }

    const geminiText = candidate.content.parts[0].text;
    console.log('🤖 Gemini response:', geminiText);

    let jsonMatch = geminiText.match(/``````/);
    if (!jsonMatch) {
      jsonMatch = geminiText.match(/\[[\s\S]*?\]/);
    }
    
    if (jsonMatch) {
      const jsonString = jsonMatch[1] || jsonMatch[0];
      const expenseArray = JSON.parse(jsonString);
      return Array.isArray(expenseArray) ? expenseArray : [expenseArray];
    } else {
      throw new Error('No valid JSON found in Gemini response');
    }

  } catch (error) {
    console.error('❌ Gemini API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 503 && retryCount < maxRetries) {
      const delay = (retryCount + 1) * 2;
      console.log(`⏳ Gemini overloaded, retrying in ${delay} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      return callGeminiAPI(extractedText, retryCount + 1);
    }
    
    throw error;
  }
}

// POST /upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    console.log('📄 File details:', {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: `${(req.file.size / 1024).toFixed(2)} KB`
    });

    // Upload to Cloudinary first
    console.log('☁️ Uploading to Cloudinary...');
    let cloudinaryResult;
    
    try {
      cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer);
    } catch (cloudinaryError) {
      console.error('❌ Cloudinary upload failed:', cloudinaryError);
      return res.status(500).json({ 
        error: 'File upload failed: ' + cloudinaryError.message 
      });
    }

    // Extract text based on file type
    let extractedText = '';
    let ocrMethod = '';
    
    try {
      if (req.file.mimetype.startsWith('image/')) {
        extractedText = await extractTextFromImageMultiPass(req.file.buffer);
        ocrMethod = 'Multi-pass Tesseract OCR';
      } else if (req.file.mimetype === 'application/pdf') {
        extractedText = await extractTextFromPdf(req.file.buffer);
        ocrMethod = 'Google Vision API / pdf-parse';
      } else {
        return res.status(400).json({ 
          error: 'Unsupported file type. Please upload an image or PDF.' 
        });
      }
      
      console.log(`✅ Text extraction succeeded using: ${ocrMethod}`);
      
    } catch (extractionError) {
      console.error('❌ Text extraction failed:', extractionError);
      return res.status(500).json({ 
        error: 'Text extraction failed: ' + extractionError.message 
      });
    }

    console.log('📝 Extracted text sample:', extractedText.substring(0, 300));
    console.log('📝 Total text length:', extractedText.length);

    // Parse expenses
    let expenseDataArray = [];
    let parsingMethod = '';
    
    try {
      console.log('🤖 Trying Gemini AI parsing...');
      expenseDataArray = await callGeminiAPI(extractedText);
      parsingMethod = 'Gemini 1.5 Flash AI';
      
      if (!expenseDataArray || expenseDataArray.length === 0) {
        throw new Error('Gemini returned empty array');
      }
      
    } catch (geminiError) {
      console.log('❌ Gemini failed, using smart text extraction...');
      expenseDataArray = extractExpenseDataFromText(extractedText);
      parsingMethod = 'Smart text extraction';
    }

    console.log(`📊 Parsing result: ${expenseDataArray.length} expenses using: ${parsingMethod}`);

    // Normalize and save expenses
    const savedExpenses = [];
    
    for (let expenseData of expenseDataArray) {
      try {
        expenseData.fileUrl = cloudinaryResult.secure_url;
        
        if (typeof expenseData.date === 'string') {
          expenseData.date = new Date(expenseData.date);
        }
        
        if (!expenseData.category) expenseData.category = 'Other';
        if (!expenseData.type) expenseData.type = 'Expense';
        
        if (expenseData.amount === null || expenseData.amount === undefined) {
          expenseData.amount = 0;
          expenseData.needsManualAmount = true;
        }
        
        if (!expenseData.description) {
          expenseData.description = `${expenseData.category} expense`;
        }
        
        const expense = new Expense(expenseData);
        const savedExpense = await expense.save();
        savedExpenses.push(savedExpense);
        
        const amountStatus = expenseData.needsManualAmount ? 'NEEDS MANUAL AMOUNT' : `$${savedExpense.amount}`;
        console.log(`✅ Saved: ${savedExpense.type} | ${savedExpense.category} - ${amountStatus}`);
        
      } catch (saveError) {
        console.error('❌ Failed to save expense:', expenseData, saveError.message);
      }
    }

    console.log(`✅ Processing completed: ${savedExpenses.length} expenses saved`);
    
    const manualAmountCount = savedExpenses.filter(e => e.needsManualAmount || e.amount === 0).length;
    
    res.json({
      success: true,
      message: savedExpenses.length > 0 
        ? `Successfully processed ${savedExpenses.length} expense(s) using ${ocrMethod}. ${manualAmountCount > 0 ? `${manualAmountCount} expense(s) need manual amount entry.` : ''}`
        : 'File processed. Please review the created expense entries.',
      expenses: savedExpenses,
      fileUrl: cloudinaryResult.secure_url,
      stats: {
        ocrMethod: ocrMethod,
        parsingMethod: parsingMethod,
        textLength: extractedText.length,
        expensesCreated: savedExpenses.length,
        needsManualAmount: manualAmountCount,
        extractedTextSample: extractedText.substring(0, 500) + '...'
      }
    });

  } catch (error) {
    console.error('❌ Upload processing error:', error);
    res.status(500).json({ 
      error: 'Server error: ' + error.message
    });
  }
});

// GET /expenses
router.get('/expenses', async (req, res) => {
  try {
    console.log('📋 Fetching all expenses...');
    const expenses = await Expense.find().sort({ date: -1 });
    console.log(`✅ Found ${expenses.length} expenses`);
    res.json(expenses);
  } catch (error) {
    console.error('❌ Error fetching expenses:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
