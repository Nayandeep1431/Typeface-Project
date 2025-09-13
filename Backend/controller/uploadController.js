const multer = require('multer');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const Transaction = require('../models/Transaction');
const path = require('path');
const fs = require('fs');
const { uploadFile } = require('../utils/cloudinary');

// Multer setup for memory storage (files temporarily saved locally for upload)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only images and PDFs are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single('file');

exports.uploadReceipt = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) return next(err);

    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const ext = path.extname(req.file.filename).toLowerCase();

      // Upload file to Cloudinary
      const uploaded = await uploadFile(req.file.path);
      fs.unlinkSync(req.file.path); // Delete local file after upload

      if (ext === '.pdf') {
        // For receipt OCR, PDFs not supported - respond accordingly
        return res.status(400).json({ error: 'Receipt OCR expects image files, not PDFs' });
      } else {
        // OCR image Receipt using Tesseract
        const { data: { text } } = await Tesseract.recognize(uploaded.secure_url, 'eng', { logger: () => {} });

        // Extract total amount, date, merchant (simple heuristics)
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let totalAmount = null;
        let dateStr = null;
        let merchant = lines[0] || null;

        for (const line of lines) {
          const lower = line.toLowerCase();
          if (!totalAmount && lower.includes('total')) {
            const match = line.match(/(\d+[\.,]?\d{0,2})$/);
            if (match) totalAmount = parseFloat(match[1].replace(',', '.'));
          }
          if (!dateStr) {
            const dateMatch = line.match(/\b(\d{4}[-\/\.]\d{2}[-\/\.]\d{2}|\d{2}[-\/\.]\d{2}[-\/\.]\d{4})\b/);
            if (dateMatch) dateStr = dateMatch[0];
          }
        }

        if (!totalAmount) return res.status(422).json({ error: 'Could not extract total amount from receipt' });

        const date = dateStr ? new Date(dateStr) : new Date();

        const transaction = new Transaction({
          user: req.user.id,
          amount: totalAmount,
          type: 'expense',
          category: 'Uncategorized',
          date,
          description: 'Receipt OCR imported',
          merchant,
        });

        await transaction.save();
        res.status(201).json({ transaction });
      }
    } catch (error) {
      next(error);
    }
  });
};

exports.uploadBankStatement = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) return next(err);

    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      if (path.extname(req.file.filename).toLowerCase() !== '.pdf') {
        return res.status(400).json({ error: 'Bank statements must be PDF files' });
      }

      // Upload to Cloudinary
      const uploaded = await uploadFile(req.file.path);
      fs.unlinkSync(req.file.path); // Delete local after upload

      const dataBuffer = Buffer.from(await (await fetch(uploaded.secure_url)).arrayBuffer());
      const data = await pdfParse(dataBuffer);
      const text = data.text;

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);

      const transactionPromises = [];

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const possibleDate = parts[0];
          const possibleAmount = parts[parts.length - 1];
          if (!isNaN(Date.parse(possibleDate)) && !isNaN(parseFloat(possibleAmount))) {
            const amount = parseFloat(possibleAmount);
            const type = amount < 0 ? 'expense' : 'income';
            const category = 'Bank Statement';

            const transaction = new Transaction({
              user: req.user.id,
              amount: Math.abs(amount),
              type,
              category,
              date: new Date(possibleDate),
              description: parts.slice(1, parts.length - 1).join(' '),
            });
            transactionPromises.push(transaction.save());
          }
        }
      }

      await Promise.all(transactionPromises);

      res.status(201).json({ message: `${transactionPromises.length} transactions imported.` });
    } catch (error) {
      next(error);
    }
  });
};
