const express = require('express');
const router = express.Router();

router.post('/upload-receipt', (req, res) => {
  res.json({ success: true, message: 'File upload coming soon' });
});

module.exports = router;
