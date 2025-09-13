const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail', // or other mail provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendBudgetExceededEmail(toEmail, month, budgetAmount, totalSpent) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: `Monthly Budget Exceeded for ${month}`,
    text: `Alert: You have exceeded your monthly budget of $${budgetAmount}. Your total spending for ${month} is $${totalSpent}.`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending budget exceeded email:', error);
  }
}

module.exports = { sendBudgetExceededEmail };
