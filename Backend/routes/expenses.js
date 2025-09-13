const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const cloudinaryService = require('../services/cloudinaryService');
const { body, validationResult, query } = require('express-validator');

const router = express.Router();

/**
 * GET /api/expenses
 * Fetch all expenses for authenticated user with filtering and pagination
 */
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('category').optional().isString().trim(),
  query('needsManualAmount').optional().isBoolean().withMessage('needsManualAmount must be boolean'),
  query('isVerified').optional().isBoolean().withMessage('isVerified must be boolean')
], async (req, res) => {
  try {
    // Validation check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      category,
      type,
      needsManualAmount,
      isVerified,
      search
    } = req.query;

    // Build filter object
    const filters = {
      userId,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(category && { category }),
      ...(type && { type }),
      ...(needsManualAmount !== undefined && { needsManualAmount: needsManualAmount === 'true' }),
      ...(isVerified !== undefined && { isVerified: isVerified === 'true' })
    };

    // Add search functionality
    let query = Expense.getExpensesByUser(userId, filters);
    
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = query.find({
        $or: [
          { description: searchRegex },
          { merchant: searchRegex },
          { category: searchRegex }
        ]
      });
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const expenses = await query
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
      .exec();

    // Get total count for pagination
    const totalQuery = Expense.find({ userId, ...filters });
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      totalQuery.find({
        $or: [
          { description: searchRegex },
          { merchant: searchRegex },
          { category: searchRegex }
        ]
      });
    }
    
    const total = await totalQuery.countDocuments();

    // Calculate statistics
    const stats = await Expense.aggregate([
      { $match: { userId: req.user._id, ...filters } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalExpenses: { $sum: 1 },
          needsManualCount: {
            $sum: { $cond: ['$needsManualAmount', 1, 0] }
          },
          avgAmount: { $avg: '$amount' },
          categoryCounts: {
            $push: '$category'
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalAmount: 0,
      totalExpenses: 0,
      needsManualCount: 0,
      avgAmount: 0
    };

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + expenses.length < total,
        hasPrev: parseInt(page) > 1
      },
      statistics: {
        totalAmount: statistics.totalAmount || 0,
        totalExpenses: statistics.totalExpenses || 0,
        needsManualAmount: statistics.needsManualCount || 0,
        averageAmount: statistics.avgAmount || 0,
        completionRate: statistics.totalExpenses > 0 
          ? ((statistics.totalExpenses - statistics.needsManualCount) / statistics.totalExpenses * 100).toFixed(1)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
});

/**
 * GET /api/expenses/:id
 * Get specific expense by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense
    });

  } catch (error) {
    console.error('❌ Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense',
      error: error.message
    });
  }
});

/**
 * PUT /api/expenses/:id
 * Update expense (manual correction)
 */
router.put('/:id', auth, [
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Description must be 1-500 characters'),
  body('category').optional().isIn([
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 
    'Groceries', 'Other Expense'
  ]).withMessage('Invalid category'),
  body('type').optional().isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('merchant').optional().trim().isLength({ max: 200 }).withMessage('Merchant name too long'),
  body('isVerified').optional().isBoolean().withMessage('isVerified must be boolean')
], async (req, res) => {
  try {
    // Validation check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['amount', 'description', 'category', 'type', 'date', 'merchant', 'isVerified'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // If amount is being updated and is valid, clear the manual flag
    if (updates.amount && updates.amount > 0) {
      updates.needsManualAmount = false;
    }

    // Apply updates
    Object.assign(expense, updates);
    await expense.save();

    console.log(`✅ Updated expense ${expense._id} for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });

  } catch (error) {
    console.error('❌ Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error.message
    });
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete expense and associated file
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // Delete file from Cloudinary
    if (expense.cloudinaryPublicId) {
      try {
        await cloudinaryService.deleteFile(expense.cloudinaryPublicId);
        console.log(`🗑️ Deleted file ${expense.cloudinaryPublicId} from Cloudinary`);
      } catch (fileError) {
        console.warn('⚠️ Failed to delete file from Cloudinary:', fileError.message);
        // Continue with expense deletion even if file deletion fails
      }
    }

    // Delete expense from database
    await Expense.findByIdAndDelete(expense._id);

    console.log(`✅ Deleted expense ${expense._id} for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error.message
    });
  }
});

/**
 * POST /api/expenses/bulk-update
 * Bulk update multiple expenses
 */
router.post('/bulk-update', auth, [
  body('expenseIds').isArray().withMessage('expenseIds must be an array'),
  body('updates').isObject().withMessage('updates must be an object'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const { expenseIds, updates } = req.body;
    
    if (expenseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No expenses selected for update'
      });
    }

    // Filter allowed update fields
    const allowedFields = ['category', 'isVerified', 'merchant'];
    const filteredUpdates = {};
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Perform bulk update
    const result = await Expense.updateMany(
      { 
        _id: { $in: expenseIds },
        userId: req.user.id 
      },
      { $set: filteredUpdates }
    );

    console.log(`✅ Bulk updated ${result.modifiedCount} expenses for user ${req.user.id}`);

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} expense(s)`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expenses',
      error: error.message
    });
  }
});

/**
 * GET /api/expenses/stats/summary
 * Get comprehensive expense statistics
 */
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    // Build match criteria
    const matchCriteria = { userId };
    if (startDate || endDate) {
      matchCriteria.date = {};
      if (startDate) matchCriteria.date.$gte = new Date(startDate);
      if (endDate) matchCriteria.date.$lte = new Date(endDate);
    }

    const stats = await Expense.aggregate([
      { $match: matchCriteria },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                totalExpenses: { $sum: 1 },
                avgAmount: { $avg: '$amount' },
                needsManualCount: { $sum: { $cond: ['$needsManualAmount', 1, 0] } }
              }
            }
          ],
          categories: [
            {
              $group: {
                _id: '$category',
                amount: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            },
            { $sort: { amount: -1 } }
          ],
          monthly: [
            {
              $group: {
                _id: {
                  year: { $year: '$date' },
                  month: { $month: '$date' }
                },
                amount: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                description: 1,
                amount: 1,
                category: 1,
                date: 1,
                needsManualAmount: 1
              }
            }
          ]
        }
      }
    ]);

    const result = stats[0];
    
    res.json({
      success: true,
      data: {
        totals: result.totals[0] || {
          totalAmount: 0,
          totalExpenses: 0,
          avgAmount: 0,
          needsManualCount: 0
        },
        categories: result.categories || [],
        monthly: result.monthly || [],
        recentExpenses: result.recent || []
      }
    });

  } catch (error) {
    console.error('❌ Error fetching expense stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics',
      error: error.message
    });
  }
});

module.exports = router;
