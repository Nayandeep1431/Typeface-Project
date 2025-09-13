const expenseService = require('../services/expenseService');

exports.uploadExpense = async (req, res) => {
  try {
    const expense = await expenseService.processAndSaveExpense(req.file);
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await expenseService.getAllExpenses();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
