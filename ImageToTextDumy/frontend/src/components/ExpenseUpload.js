import React, { useState } from 'react';
import { uploadExpenseFile } from '../services/api';

const ExpenseUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      console.log('📁 File selected:', {
        name: selectedFile.name,
        size: `${(selectedFile.size / 1024).toFixed(2)} KB`,
        type: selectedFile.type
      });
      
      setFile(selectedFile);
      setError('');
      setSuccess('');
      setDebugInfo(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setProgress(0);
    setDebugInfo(null);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      console.log('📤 Starting upload for:', file.name);
      const response = await uploadExpenseFile(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      console.log('✅ Upload successful:', response.data);
      
      // Set debug information
      setDebugInfo(response.data.stats);
      
      // Show appropriate success message
      if (response.data.expenses && response.data.expenses.length > 0) {
        setSuccess(
          `✅ Success! Processed ${response.data.expenses.length} expense(s) using ${response.data.stats?.ocrMethod || 'OCR'} and ${response.data.stats?.parsingMethod || 'AI parsing'}.`
        );
        onUploadSuccess(response.data);
      } else {
        setSuccess(
          `⚠️ File uploaded but no expenses found. The OCR extracted ${response.data.stats?.textLength || 0} characters but couldn't identify expense data. Please ensure the image/PDF contains clear expense information.`
        );
        // Still call onUploadSuccess to refresh the list
        onUploadSuccess(response.data);
      }
      
      // Reset form after delay
      setTimeout(() => {
        setFile(null);
        setProgress(0);
        document.querySelector('input[type="file"]').value = '';
        setDebugInfo(null);
      }, 5000);
      
    } catch (error) {
      clearInterval(progressInterval);
      setProgress(0);
      
      console.error('❌ Upload failed:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          'Upload failed. Please try again.';
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      marginBottom: '30px', 
      padding: '25px', 
      border: '2px dashed #007bff', 
      borderRadius: '12px',
      backgroundColor: '#f8f9fa',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
          📄 Upload Receipt or Invoice
        </h3>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          <strong>Images:</strong> Processed with Tesseract OCR | <strong>PDFs:</strong> Processed with Google Vision API
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf" 
          onChange={handleFileChange}
          disabled={loading}
          style={{ 
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: loading ? '#f5f5f5' : 'white'
          }}
        />
      </div>

      {file && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <strong>📎 Selected:</strong> {file.name} ({(file.size / 1024).toFixed(2)} KB)
          <br />
          <strong>🔍 OCR Method:</strong> {file.type === 'application/pdf' ? 'Google Vision API (PDF)' : 'Tesseract.js (Image)'}
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            width: '100%', 
            backgroundColor: '#e0e0e0', 
            borderRadius: '10px',
            height: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease',
              borderRadius: '10px'
            }} />
          </div>
          <p style={{ 
            margin: '5px 0 0 0', 
            fontSize: '12px', 
            color: '#666',
            textAlign: 'center'
          }}>
            Processing OCR and AI parsing... {progress}%
          </p>
        </div>
      )}
      
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={handleUpload} 
          disabled={loading || !file}
          style={{ 
            padding: '12px 30px', 
            backgroundColor: loading ? '#6c757d' : (!file ? '#ccc' : '#007bff'), 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            cursor: loading || !file ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            minWidth: '150px'
          }}
        >
          {loading ? '🔄 Processing...' : '⬆️ Upload & Process'}
        </button>
      </div>
      
      {error && (
        <div style={{ 
          marginTop: '15px',
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}
      
      {success && (
        <div style={{ 
          marginTop: '15px',
          padding: '12px',
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      {debugInfo && (
        <div style={{ 
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <strong>🔍 Debug Info:</strong><br />
          📝 Text extracted: {debugInfo.textLength} characters<br />
          🤖 OCR Method: {debugInfo.ocrMethod}<br />
          🧠 Parsing: {debugInfo.parsingMethod}<br />
          📊 Expenses found: {debugInfo.expenseCount}
        </div>
      )}
    </div>
  );
};

export default ExpenseUpload;
