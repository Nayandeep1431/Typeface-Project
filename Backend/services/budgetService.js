const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { sendBudgetExceededEmail } = require('../utils/email');

async function checkAndNotifyBudgetExceeded(userId, budgetAmount, month, year) {
  // Calculate total expenses for the user in given month/year
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const expenses = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: { _id: null, totalSpent: { $sum: '$amount' } },
    },
  ]);

  const totalSpent = expenses.length ? expenses[0].totalSpent : 0;

  if (totalSpent > budgetAmount) {
    const user = await User.findById(userId);
    if (user && user.email) {
      await sendBudgetExceededEmail(user.email, `${month}/${year}`, budgetAmount, totalSpent);
    }
  }
}

module.exports = { checkAndNotifyBudgetExceeded };
