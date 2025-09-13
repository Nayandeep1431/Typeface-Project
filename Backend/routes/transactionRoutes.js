const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createTransaction, listTransactions } = require('../controller/transactionController');

router.use(authMiddleware);

router.post('/', createTransaction);
router.get('/', listTransactions);

module.exports = router;
