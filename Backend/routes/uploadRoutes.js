const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { uploadReceipt, uploadBankStatement } = require('../controller/uploadController');

router.use(authMiddleware);

router.post('/receipt', uploadReceipt);
router.post('/bank-statement', uploadBankStatement);

module.exports = router;
