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
      merchant, // optional field
      source, // optional field to track origin (upload, manual, etc.)
      extractedText, // optional field for OCR/parsed content
      parsingMethod, // optional field to track how data was parsed
      needsManualReview, // optional field for flagging uncertain data
      fileUrl // optional field for uploaded file reference
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
      ...(merchant && { merchant: merchant.trim() }),
      ...(source && { source: source.trim() }),
      ...(extractedText && { extractedText: extractedText.trim() }),
      ...(parsingMethod && { parsingMethod: parsingMethod.trim() }),
      ...(needsManualReview !== undefined && { needsManualReview: Boolean(needsManualReview) }),
      ...(fileUrl && { fileUrl: fileUrl.trim() }),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('💾 Creating transaction with data:', transactionData);

    const transaction = new Transaction(transactionData);
    await transaction.save();

    console.log('✅ Transaction created successfully:', transaction._id);

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

// GET /api/transactions - Get all transactions for the user with enhanced filtering
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching transactions for user:', req.user._id || req.user.id);
    
    // Enhanced query parameters
    const {
      page = 1,
      limit = 100,
      sort = 'date',
      order = 'desc',
      type,
      category,
      source,
      startDate,
      endDate,
      search,
      needsReview
    } = req.query;

    // Build query
    let query = {
      user: req.user._id || req.user.id,
    };

    // Apply filters
    if (type && ['income', 'expense'].includes(type)) {
      query.type = type;
    }

    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    if (source) {
      query.source = source;
    }

    if (needsReview === 'true') {
      query.needsManualReview = true;
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { merchant: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('🔍 Query filters:', query);

    // Build sort object
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObject = { [sort]: sortOrder };

    // Execute query with pagination
    const transactions = await Transaction.find(query)
      .sort(sortObject)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean(); // Use lean() for better performance

    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / parseInt(limit));

    console.log(`✅ Found ${transactions.length} transactions (${totalTransactions} total)`);

    // Calculate summary stats
    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
          },
          totalExpenses: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
          },
          transactionCount: { $sum: 1 },
          incomeCount: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, 1, 0] }
          },
          expenseCount: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, 1, 0] }
          }
        }
      }
    ]);

    const summary = stats[0] || {
      totalIncome: 0,
      totalExpenses: 0,
      transactionCount: 0,
      incomeCount: 0,
      expenseCount: 0
    };

    summary.netBalance = summary.totalIncome - summary.totalExpenses;

    res.json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalTransactions,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      summary,
      filters: {
        type,
        category,
        source,
        startDate,
        endDate,
        search,
        needsReview
      }
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
});

// GET /api/transactions/stats - Get transaction statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching transaction stats for user:', req.user._id || req.user.id);
    
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    // Build base query
    let matchQuery = {
      user: req.user._id || req.user.id,
    };

    // Apply date range
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    // Aggregation pipeline for time series data
    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
              date: '$date'
            }
          },
          income: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
          },
          expenses: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ];

    const timeSeriesData = await Transaction.aggregate(pipeline);

    // Category breakdown
    const categoryPipeline = [
      { $match: { ...matchQuery, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { amount: -1 } }
    ];

    const categoryBreakdown = await Transaction.aggregate(categoryPipeline);

    console.log('✅ Stats calculated successfully');

    res.json({
      success: true,
      data: {
        timeSeries: timeSeriesData,
        categoryBreakdown,
        groupBy,
        dateRange: { startDate, endDate }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
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
    if (updateData.amount !== undefined) {
      updateData.amount = parseFloat(updateData.amount);
      if (isNaN(updateData.amount) || updateData.amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a valid number greater than 0'
        });
      }
    }

    // Parse date if provided
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
      if (isNaN(updateData.date.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
    }

    // Validate type if provided
    if (updateData.type && !['income', 'expense'].includes(updateData.type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"'
      });
    }

    // Add update timestamp
    updateData.updatedAt = new Date();

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

    console.log('✅ Transaction updated successfully:', transaction._id);

    res.json({
      success: true,
      data: transaction,
      message: 'Transaction updated successfully'
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

    console.log('✅ Transaction deleted successfully:', transaction._id);

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: { deletedId: id }
    });
  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
});

// POST /api/transactions/bulk - Create multiple transactions (for upload functionality)
router.post('/bulk', async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    console.log('📦 Creating bulk transactions for user:', userId);
    
    const { transactions, source = 'bulk_upload' } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transactions array is required and must not be empty'
      });
    }

    // Validate and prepare transactions
    const preparedTransactions = transactions.map((transaction, index) => {
      // Validate required fields
      if (!transaction.amount || transaction.amount <= 0) {
        throw new Error(`Transaction ${index + 1}: Amount is required and must be greater than 0`);
      }

      if (!transaction.category || transaction.category.trim() === '') {
        throw new Error(`Transaction ${index + 1}: Category is required`);
      }

      if (!transaction.date) {
        throw new Error(`Transaction ${index + 1}: Date is required`);
      }

      if (!transaction.type || !['income', 'expense'].includes(transaction.type)) {
        throw new Error(`Transaction ${index + 1}: Type must be either "income" or "expense"`);
      }

      return {
        amount: parseFloat(transaction.amount),
        category: transaction.category.trim(),
        description: transaction.description ? transaction.description.trim() : '',
        date: new Date(transaction.date),
        type: transaction.type.toLowerCase(),
        user: userId,
        source: transaction.source || source,
        ...(transaction.merchant && { merchant: transaction.merchant.trim() }),
        ...(transaction.extractedText && { extractedText: transaction.extractedText.trim() }),
        ...(transaction.parsingMethod && { parsingMethod: transaction.parsingMethod.trim() }),
        ...(transaction.needsManualReview !== undefined && { needsManualReview: Boolean(transaction.needsManualReview) }),
        ...(transaction.fileUrl && { fileUrl: transaction.fileUrl.trim() }),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    console.log(`💾 Creating ${preparedTransactions.length} transactions in bulk`);

    // Insert all transactions
    const savedTransactions = await Transaction.insertMany(preparedTransactions);

    console.log(`✅ Bulk transactions created successfully: ${savedTransactions.length} items`);

    // Calculate summary
    const summary = savedTransactions.reduce((acc, t) => {
      if (t.type === 'income') {
        acc.totalIncome += t.amount;
        acc.incomeCount++;
      } else {
        acc.totalExpenses += t.amount;
        acc.expenseCount++;
      }
      acc.transactionCount++;
      return acc;
    }, {
      totalIncome: 0,
      totalExpenses: 0,
      incomeCount: 0,
      expenseCount: 0,
      transactionCount: 0
    });

    summary.netAmount = summary.totalIncome - summary.totalExpenses;

    res.status(201).json({
      success: true,
      data: savedTransactions,
      summary,
      message: `Successfully created ${savedTransactions.length} transactions`
    });

  } catch (error) {
    console.error('❌ Error creating bulk transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

module.exports = router;
