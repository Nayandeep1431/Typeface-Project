import React, { useState, useEffect } from 'react';
import ExpenseUpload from './components/ExpenseUpload';
import ExpenseTable from './components/ExpenseTable';
import { fetchExpenses } from './services/api';

function App() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchExpenses();
      setExpenses(response.data);
    } catch (error) {
      console.error('❌ Error loading expenses:', error);
      setError('Failed to load expenses. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (response) => {
    console.log('✅ Upload success, updating expense list');
    
    if (response.expenses && Array.isArray(response.expenses) && response.expenses.length > 0) {
      setExpenses(prev => [...response.expenses, ...prev]);
    }
  };

  const handleExpenseDeleted = (deletedId) => {
    setExpenses(prev => prev.filter(expense => expense._id !== deletedId));
  };

  const handleExpenseUpdated = (updatedExpense) => {
    setExpenses(prev => prev.map(expense => 
      expense._id === updatedExpense._id ? updatedExpense : expense
    ));
  };

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: 'auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f5f6fa'
    }}>
      <header style={{ 
        textAlign: 'center', 
        marginBottom: '40px',
        padding: '30px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          color: '#2c3e50', 
          margin: '0 0 15px 0',
          fontSize: '2.8rem',
          fontWeight: '700'
        }}>
          💰 Smart Expense Tracker
        </h1>
        <p style={{ 
          color: '#7f8c8d', 
          margin: 0,
          fontSize: '1.2rem'
        }}>
          Upload receipts and let AI extract expense data. Edit amounts when OCR fails.
        </p>
      </header>
      
      <ExpenseUpload onUploadSuccess={handleUploadSuccess} />
      
      {error && (
        <div style={{ 
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <strong>❌ {error}</strong>
          <button 
            onClick={loadExpenses}
            style={{
              marginLeft: '15px',
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Retry
          </button>
        </div>
      )}
      
      <section style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '25px'
        }}>
          <h2 style={{ color: '#2c3e50', margin: 0 }}>
            📋 Your Expenses
            {loading && <span style={{ marginLeft: '10px', color: '#666' }}>Loading...</span>}
          </h2>
          
          <button 
            onClick={loadExpenses}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
        
        <ExpenseTable 
          expenses={expenses} 
          onExpenseDeleted={handleExpenseDeleted}
          onExpenseUpdated={handleExpenseUpdated}
        />
      </section>
    </div>
  );
}

export default App;
