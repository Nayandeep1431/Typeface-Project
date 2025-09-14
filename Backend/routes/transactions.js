const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

// Apply authentication middleware to all routes
router.use(auth);

// POST /api/transactions - Create a new transaction
router.post('/', async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    console.log('📝 Creating transaction for user:', userId);
    console.log('📦 Request body:', req.body);

    // Extract and validate data from request body
    const { 
      amount, 
      category, 
      description, 
      date, 
      type,
      merchant // optional field
    } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be greater than 0'
      });
    }

    if (!category || category.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required'
      });
    }

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"'
      });
    }

    // Create transaction with properly parsed data
    const transactionData = {
      amount: parseFloat(amount),
      category: category.trim(),
      description: description ? description.trim() : '',
      date: new Date(date),
      type: type.toLowerCase(),
      user: userId,
      ...(merchant && { merchant: merchant.trim() })
    };

    console.log('💾 Creating transaction with data:', transactionData);

    const transaction = new Transaction(transactionData);
    await transaction.save();

    console.log('✅ Transaction created successfully:', transaction);

    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Transaction created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

// GET /api/transactions - Get all transactions for the user
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching transactions for user:', req.user._id || req.user.id);
    
    const transactions = await Transaction.find({
      user: req.user._id || req.user.id,
    }).sort({ date: -1 });

    console.log(`✅ Found ${transactions.length} transactions`);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
});

// PUT /api/transactions/:id - Update a transaction
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Parse amount if provided
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount);
    }

    // Parse date if provided
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    console.log('✏️ Updating transaction:', id, updateData);

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, user: req.user._id || req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
});

// DELETE /api/transactions/:id - Delete a transaction
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting transaction:', id);

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      user: req.user._id || req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
});

module.exports = router;
