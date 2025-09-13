import React, { useState } from 'react';
import { deleteExpense } from '../services/api';
import axios from 'axios';

const ExpenseTable = ({ expenses, onExpenseDeleted, onExpenseUpdated }) => {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [updateLoading, setUpdateLoading] = useState(null);

  if (!expenses || expenses.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px', 
        color: '#666',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h3>📊 No expenses found</h3>
        <p>Upload a receipt to get started with tracking your expenses!</p>
      </div>
    );
  }

  // Filter and sort expenses
  const filteredExpenses = expenses.filter(expense => {
    if (filter === 'all') return true;
    if (filter === 'needs-fix') return expense.needsManualAmount || expense.amount === 0;
    return expense.type.toLowerCase() === filter.toLowerCase();
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'date') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleEdit = (expense) => {
    setEditingId(expense._id);
    setEditingValues({
      amount: expense.amount || '',
      category: expense.category,
      description: expense.description
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editingValues.amount || editingValues.amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    setUpdateLoading(id);
    try {
      const response = await axios.put(`http://localhost:5000/api/expenses/${id}`, editingValues);
      
      if (response.data.success) {
        onExpenseUpdated(response.data.expense);
        setEditingId(null);
        setEditingValues({});
        
        // Success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed; top: 20px; right: 20px; background: #d4edda; 
          color: #155724; padding: 15px; border-radius: 8px; z-index: 1000;
          border: 1px solid #c3e6cb; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          font-family: system-ui, sans-serif;
        `;
        notification.innerHTML = `
          <strong>✅ Updated Successfully!</strong><br>
          ${editingValues.category} - $${editingValues.amount}
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Update failed:', error);
      alert('Failed to update expense: ' + (error.response?.data?.error || error.message));
    } finally {
      setUpdateLoading(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleDelete = async (expense) => {
    const confirmMessage = `Are you sure you want to delete this expense?\n\n` +
      `Date: ${new Date(expense.date).toLocaleDateString()}\n` +
      `Category: ${expense.category}\n` +
      `Amount: $${expense.amount}`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteLoading(expense._id);
    
    try {
      await deleteExpense(expense._id);
      onExpenseDeleted(expense._id);
    } catch (error) {
      console.error('❌ Delete failed:', error);
      alert('Failed to delete expense: ' + (error.response?.data?.error || error.message));
    } finally {
      setDeleteLoading(null);
    }
  };

  const needsFixCount = sortedExpenses.filter(exp => exp.needsManualAmount || exp.amount === 0).length;
  const totalExpenses = sortedExpenses.filter(exp => exp.type === 'Expense' && exp.amount > 0).reduce((sum, exp) => sum + exp.amount, 0);
  const totalIncome = sortedExpenses.filter(exp => exp.type === 'Income' && exp.amount > 0).reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div>
      {/* RED ALERT for expenses needing fixes */}
      {needsFixCount > 0 && (
        <div style={{
          marginBottom: '25px',
          padding: '20px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '2px solid #dc3545',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(220, 53, 69, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '24px', marginRight: '12px' }}>🚨</span>
            <strong style={{ fontSize: '18px' }}>UNABLE TO PARSE - MANUAL FIX REQUIRED</strong>
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
            <strong>{needsFixCount}</strong> expense{needsFixCount > 1 ? 's' : ''} could not be properly parsed from the uploaded document.
          </p>
          <p style={{ margin: '0', fontSize: '14px' }}>
            Please click the <span style={{ 
              backgroundColor: '#dc3545', 
              color: 'white', 
              padding: '2px 6px', 
              borderRadius: '3px',
              fontSize: '12px'
            }}>🚨 FIX</span> button to manually enter the missing amounts and verify the details.
          </p>
        </div>
      )}

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div>
            <label style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>
              Filter:
            </label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="all">All Expenses</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Income Only</option>
              {needsFixCount > 0 && (
                <option value="needs-fix">🚨 Needs Fix ({needsFixCount})</option>
              )}
            </select>
          </div>

          <div>
            <label style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>
              Sort:
            </label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                marginRight: '8px',
                fontSize: '14px'
              }}
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="category">Category</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div style={{ fontSize: '14px', color: '#666', textAlign: 'right' }}>
          <div>📊 Total: {sortedExpenses.length} items</div>
          <div>
            <span style={{ color: '#dc3545', marginRight: '15px' }}>
              💰 Expenses: ${totalExpenses.toFixed(2)}
            </span>
            <span style={{ color: '#28a745' }}>
              💵 Income: ${totalIncome.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ 
        overflowX: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderRadius: '8px'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <thead style={{ backgroundColor: '#007bff', color: 'white' }}>
            <tr>
              <th style={{ padding: '15px 12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
              <th style={{ padding: '15px 12px', textAlign: 'left', fontWeight: '600' }}>Category</th>
              <th style={{ padding: '15px 12px', textAlign: 'center', fontWeight: '600' }}>Type</th>
              <th style={{ padding: '15px 12px', textAlign: 'right', fontWeight: '600' }}>Amount</th>
              <th style={{ padding: '15px 12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
              <th style={{ padding: '15px 12px', textAlign: 'center', fontWeight: '600' }}>File</th>
              <th style={{ padding: '15px 12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map((expense, index) => {
              const isEditing = editingId === expense._id;
              const needsFix = expense.needsManualAmount || expense.amount === 0;
              
              return (
                <tr 
                  key={expense._id || index} 
                  style={{ 
                    borderBottom: '1px solid #eee',
                    backgroundColor: needsFix ? '#ffebee' : (index % 2 === 0 ? '#f8f9fa' : 'white'),
                    borderLeft: needsFix ? '4px solid #dc3545' : 'none'
                  }}
                >
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    {expense.date 
                      ? new Date(expense.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit'
                        })
                      : 'Invalid Date'
                    }
                  </td>
                  <td style={{ padding: '12px', fontWeight: '500', fontSize: '14px' }}>
                    {isEditing ? (
                      <select
                        value={editingValues.category}
                        onChange={(e) => setEditingValues({...editingValues, category: e.target.value})}
                        style={{ width: '100%', padding: '4px', fontSize: '14px' }}
                      >
                        <option value="Food">Food</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Medical">Medical</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Rent">Rent</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      expense.category || 'N/A'
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{ 
                      color: expense.type === 'Income' ? '#28a745' : '#dc3545',
                      fontWeight: '600',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: expense.type === 'Income' ? '#d4edda' : '#f8d7da',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}>
                      {expense.type || 'N/A'}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right', 
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingValues.amount}
                        onChange={(e) => setEditingValues({...editingValues, amount: e.target.value})}
                        style={{ 
                          width: '90px', 
                          padding: '6px',
                          textAlign: 'right',
                          border: '2px solid #007bff',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        placeholder="0.00"
                        autoFocus
                      />
                    ) : needsFix ? (
                      <span style={{ 
                        color: '#dc3545', 
                        fontStyle: 'italic',
                        fontWeight: 'bold'
                      }}>
                        Enter Amount
                      </span>
                    ) : (
                      <span style={{ color: expense.type === 'Income' ? '#28a745' : '#dc3545' }}>
                        ${Number(expense.amount).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    maxWidth: '200px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingValues.description}
                        onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '6px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    ) : (
                      expense.description || `${expense.category} expense`
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {expense.fileUrl ? (
                      <a 
                        href={expense.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#007bff', 
                          textDecoration: 'none',
                          padding: '6px 12px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          fontSize: '12px',
                          display: 'inline-block',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        📎 View
                      </a>
                    ) : (
                      <span style={{ color: '#999', fontSize: '12px' }}>No file</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleSaveEdit(expense._id)}
                          disabled={updateLoading === expense._id}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {updateLoading === expense._id ? '⏳' : '✅ Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(expense)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: needsFix ? '#dc3545' : '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title={needsFix ? 'Fix missing amount' : 'Edit expense'}
                        >
                          {needsFix ? '🚨 FIX' : '✏️ Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(expense)}
                          disabled={deleteLoading === expense._id}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: deleteLoading === expense._id ? '#6c757d' : '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: deleteLoading === expense._id ? 'not-allowed' : 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {deleteLoading === expense._id ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Net Balance */}
      <div style={{ 
        marginTop: '20px', 
        padding: '20px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          fontSize: '24px',
          fontWeight: 'bold',
          color: (totalIncome - totalExpenses) >= 0 ? '#28a745' : '#dc3545'
        }}>
          Net Balance: ${(totalIncome - totalExpenses).toFixed(2)}
        </div>
        {needsFixCount > 0 && (
          <div style={{ fontSize: '14px', color: '#dc3545', marginTop: '8px' }}>
            * Balance excludes {needsFixCount} expense{needsFixCount > 1 ? 's' : ''} with missing amounts
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseTable;
