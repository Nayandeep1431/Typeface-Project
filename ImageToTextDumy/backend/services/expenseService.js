const cloudinaryUtils = require('../utils/cloudinaryUtils');
const ocrUtils = require('../utils/ocrUtils');
const Expense = require('../models/Expense');
const axios = require('axios');

exports.processAndSaveExpense = async (file) => {
  if (!file) throw new Error('File is required');

  // Upload file to Cloudinary
  const cloudinaryResult = await cloudinaryUtils.uploadBuffer(file.buffer);

  // Extract text from file using OCR utils
  let extractedText = '';
  if (file.mimetype === 'application/pdf') {
    extractedText = await ocrUtils.extractTextFromPdf(file.buffer);
  } else {
    extractedText = await ocrUtils.extractTextFromImage(file.buffer);
  }

  // Call Gemini API to parse extracted text
  const geminiResponse = await axios.post(process.env.GEMINI_API_URL, {
    text: extractedText
  }, {
    headers: { 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` }
  });

  const expenseData = geminiResponse.data;
  expenseData.fileUrl = cloudinaryResult.secure_url;

  // Save to MongoDB
  const expense = new Expense(expenseData);
  return expense.save();
};

exports.getAllExpenses = async () => {
  return Expense.find().sort({ date: -1 });
};
