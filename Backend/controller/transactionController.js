const Transaction = require('../models/Transaction');
const { checkAndNotifyBudgetExceeded } = require('../services/budgetService');

exports.createTransaction = async (req, res, next) => {
  try {
    const { amount, type, category, date, description, merchant } = req.body;
    if (!amount || !type || !category) return res.status(400).json({ error: 'Amount, type, and category are required' });

    if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Type must be income or expense' });

    const transaction = new Transaction({
      user: req.user.id,
      amount,
      type,
      category,
      date: date ? new Date(date) : new Date(),
      description,
      merchant,
    });

    await transaction.save();

    // Notify if monthly expense exceeds budget (example budget: $2000)
    if (type === 'expense') {
      const budgetAmount = 2000; // Example static budget, replace with dynamic user-config if needed
      const dateObj = transaction.date || new Date();
      await checkAndNotifyBudgetExceeded(req.user.id, budgetAmount, dateObj.getMonth() + 1, dateObj.getFullYear());
    }

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

exports.listTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, type, page = 1 } = req.query;

    const filter = { user: userId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (type && ['income', 'expense'].includes(type)) {
      filter.type = type;
    }

    const perPage = 20;
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage);

    const total = await Transaction.countDocuments(filter);

    res.json({
      data: transactions,
      pagination: {
        total,
        page: Number(page),
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    next(err);
  }
};
