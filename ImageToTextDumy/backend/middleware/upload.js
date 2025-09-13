const multer = require('multer');

// Use memory storage so file buffer can be accessed directly
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('Uploaded file mimetype:', file.mimetype);
  
  // Accept common image formats and PDF
  if (file.mimetype === 'image/jpeg' || 
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/gif' ||
      file.mimetype === 'image/webp' ||
      file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${file.mimetype}`), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;
