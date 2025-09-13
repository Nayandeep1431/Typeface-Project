const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIParsingService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Generate AI prompt for expense extraction
   * @param {string} ocrText - OCR extracted text
   * @returns {string} - Formatted prompt
   */
  generateExpensePrompt(ocrText) {
    return `
You are an expert expense data extraction AI. Extract expense line items from this POS receipt OCR text.

CRITICAL RULES:
1. ONLY extract actual line items (products/services purchased)
2. EXCLUDE: taxes, totals, subtotals, discounts, payment methods, store info
3. EXCLUDE: any line that says "TOTAL", "TAX", "SUBTOTAL", "CHANGE", "PAYMENT"
4. Each item MUST have an amount (number with currency or just number)
5. If no valid line items found, return empty array

OUTPUT FORMAT: Clean JSON array only, no extra text:

[
  {
    "description": "item name/description",
    "amount": numeric_value_only,
    "category": "Food & Dining|Transportation|Shopping|Entertainment|Bills & Utilities|Healthcare|Education|Travel|Groceries|Other Expense",
    "type": "expense"
  }
]

CATEGORY MAPPING RULES:
- Food items, restaurants, cafes → "Food & Dining"
- Groceries, supermarkets → "Groceries"
- Gas stations, parking, transport → "Transportation"
- Retail stores, clothing → "Shopping"
- Movies, games, entertainment → "Entertainment"
- Utilities, phone bills → "Bills & Utilities"
- Medical, pharmacy → "Healthcare"
- Books, courses → "Education"
- Hotels, flights → "Travel"
- Everything else → "Other Expense"

OCR TEXT TO PARSE:
${ocrText}

Return ONLY the JSON array:`;
  }

  /**
   * Parse expenses using Gemini AI with retry logic
   * @param {string} ocrText - OCR extracted text
   * @returns {Promise<Array>} - Parsed expenses array
   */
  async parseExpenses(ocrText) {
    console.log('🤖 Starting AI expense parsing...');
    
    if (!ocrText || ocrText.trim().length < 10) {
      console.warn('⚠️ OCR text too short for AI parsing');
      return [];
    }

    const prompt = this.generateExpensePrompt(ocrText);
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 AI parsing attempt ${attempt}/${this.maxRetries}`);
        
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Empty response from Gemini API');
        }

        console.log('📝 Raw AI response:', text.substring(0, 200) + '...');

        // Extract and parse JSON from response
        const expenses = this.extractExpensesFromResponse(text);
        
        if (expenses.length > 0) {
          console.log(`✅ AI successfully parsed ${expenses.length} expenses`);
          return expenses;
        } else {
          console.warn('⚠️ AI returned no valid expenses');
          return [];
        }

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ AI parsing attempt ${attempt} failed:`, error.message);

        // Handle specific error types
        if (error.message.includes('503') || error.message.includes('overloaded')) {
          console.log(`⏳ Server overloaded, waiting ${this.retryDelay * attempt}ms...`);
          await this.sleep(this.retryDelay * attempt);
          continue;
        }

        if (attempt === this.maxRetries) {
          console.error('❌ All AI parsing attempts failed');
          break;
        }

        await this.sleep(this.retryDelay);
      }
    }

    console.log('🔄 Falling back to regex parsing...');
    return this.fallbackRegexParsing(ocrText);
  }

  /**
   * Extract and validate expenses from AI response
   * @param {string} responseText - AI response text
   * @returns {Array} - Validated expenses array
   */
  extractExpensesFromResponse(responseText) {
    try {
      // Find JSON array in response (handle extra text around JSON)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const jsonText = jsonMatch[0];
      const rawExpenses = JSON.parse(jsonText);

      if (!Array.isArray(rawExpenses)) {
        throw new Error('AI response is not an array');
      }

      // Validate and clean each expense
      const validatedExpenses = rawExpenses
        .map(expense => this.validateExpense(expense))
        .filter(expense => expense !== null);

      return validatedExpenses;

    } catch (error) {
      console.error('❌ Failed to parse AI response as JSON:', error.message);
      return [];
    }
  }

  /**
   * Validate and normalize a single expense object
   * @param {Object} expense - Raw expense object
   * @returns {Object|null} - Validated expense or null if invalid
   */
  validateExpense(expense) {
    if (!expense || typeof expense !== 'object') {
      return null;
    }

    // Extract and validate amount
    let amount = null;
    if (expense.amount !== undefined) {
      const numAmount = parseFloat(String(expense.amount).replace(/[^\d.-]/g, ''));
      if (!isNaN(numAmount) && numAmount > 0) {
        amount = numAmount;
      }
    }

    // Validate description
    const description = String(expense.description || '').trim();
    if (!description || description.length === 0) {
      return null;
    }

    // Validate and normalize category
    const validCategories = [
      'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
      'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 
      'Groceries', 'Other Expense'
    ];
    
    let category = String(expense.category || 'Other Expense').trim();
    if (!validCategories.includes(category)) {
      category = 'Other Expense';
    }

    return {
      description,
      amount,
      category,
      type: 'expense',
      needsManualAmount: !amount
    };
  }

  /**
   * Fallback regex-based parsing when AI fails
   * @param {string} ocrText - OCR text to parse
   * @returns {Array} - Parsed expenses array
   */
  fallbackRegexParsing(ocrText) {
    console.log('🔧 Starting fallback regex parsing...');
    
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const expenses = [];

    // Regex patterns for amounts (₹100, $10.50, 25.00, etc.)
    const amountRegex = /(?:₹|Rs\.?|\$)?(\d+(?:[.,]\d{2})?)\s*$/;
    
    // Keywords to exclude (totals, taxes, etc.)
    const excludeKeywords = [
      'total', 'subtotal', 'tax', 'gst', 'vat', 'discount', 'change', 
      'payment', 'cash', 'card', 'balance', 'amount due', 'grand total'
    ];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Skip lines with exclude keywords
      if (excludeKeywords.some(keyword => lowerLine.includes(keyword))) {
        continue;
      }

      // Look for lines ending with amounts
      const amountMatch = line.match(amountRegex);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(',', '.'));
        
        if (amount > 0) {
          // Extract description (everything before the amount)
          const description = line.replace(amountRegex, '').trim();
          
          if (description.length > 0) {
            expenses.push({
              description,
              amount,
              category: 'Other Expense',
              type: 'expense',
              needsManualAmount: false
            });
          }
        }
      }
    }

    console.log(`🔧 Regex parsing found ${expenses.length} potential expenses`);
    return expenses.slice(0, 20); // Limit to prevent spam
  }

  /**
   * Utility function to sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Promise that resolves after timeout
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get parsing statistics
   * @param {Array} expenses - Parsed expenses
   * @returns {Object} - Statistics object
   */
  getParsingStats(expenses) {
    const totalExpenses = expenses.length;
    const needsManualAmount = expenses.filter(e => e.needsManualAmount).length;
    const hasAmount = totalExpenses - needsManualAmount;

    return {
      totalExpenses,
      hasAmount,
      needsManualAmount,
      successRate: totalExpenses > 0 ? (hasAmount / totalExpenses * 100).toFixed(1) : 0
    };
  }
}

module.exports = new AIParsingService();
