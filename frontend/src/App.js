import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import CustomThemeProvider from './contexts/ThemeContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import AnalyticsPage from './pages/Analytics';
import Upload from './pages/Upload';
import Layout from './components/Layout/Layout';

function App() {
  const { token } = useSelector((state) => state.auth);

  return (
    <CustomThemeProvider>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={!token ? <Login /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/" 
            element={token ? <Layout /> : <Navigate to="/login" />}
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="upload" element={<Upload />} />
          </Route>
        </Routes>
      </Router>
    </CustomThemeProvider>
  );
}

export default App;
