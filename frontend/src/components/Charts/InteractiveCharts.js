import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Button,
} from '@mui/material';
import { motion } from 'framer-motion';

// Enhanced color palette for better visual recognition
const CHART_COLORS = {
  'Food & Dining': '#FF6B6B',
  'Transportation': '#4ECDC4',
  'Shopping': '#45B7D1',
  'Entertainment': '#96CEB4',
  'Bills & Utilities': '#FFEAA7',
  'Healthcare': '#DDA0DD',
  'Education': '#98D8C8',
  'Travel': '#F7DC6F',
  'Rent': '#BB8FCE',
  'Insurance': '#85C1E9',
  'Salary': '#58D68D',
  'Freelance': '#F8C471',
  'Investment': '#AED6F1',
  'Business Income': '#A9DFBF',
  'Other': '#D5DBDB',
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, type = 'currency' }) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Paper 
          sx={{ 
            p: 2, 
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 3,
            borderRadius: 2,
            minWidth: 200 
          }}
        >
          {label && (
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {label}
            </Typography>
          )}
          {payload.map((entry, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                  mr: 1
                }}
              />
              <Typography variant="body2" sx={{ mr: 1 }}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {type === 'currency' 
                  ? `₹${Math.abs(entry.value || 0).toLocaleString('en-IN')}`
                  : entry.value
                }
              </Typography>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Click to filter transactions
          </Typography>
        </Paper>
      </motion.div>
    );
  }
  return null;
};

// Interactive Pie Chart Component
export const InteractivePieChart = ({ 
  data, 
  onSegmentClick, 
  activeSegment = null,
  title = "Category Breakdown" 
}) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const handlePieClick = (data, index) => {
    if (onSegmentClick) {
      onSegmentClick(data.name, data);
    }
  };

  const enhancedData = data.map(item => ({
    ...item,
    color: CHART_COLORS[item.name] || '#D5DBDB'
  }));

  return (
    <Paper sx={{ p: 3, borderRadius: 3, height: 450 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {activeSegment && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Chip
              label={`Filtered: ${activeSegment}`}
              onDelete={() => onSegmentClick(null)}
              color="primary"
              variant="outlined"
              size="small"
            />
          </motion.div>
        )}
      </Box>
      
      {enhancedData.length > 0 ? (
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie
              data={enhancedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent, value }) => 
                percent > 5 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
              }
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
              onClick={handlePieClick}
              onMouseEnter={(data, index) => setHoveredSegment(index)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {enhancedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={activeSegment === entry.name ? '#333' : 'none'}
                  strokeWidth={activeSegment === entry.name ? 2 : 0}
                  style={{
                    filter: hoveredSegment === index ? 'brightness(1.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body2" color="text.secondary">
            No data available for the selected period
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// Interactive Line Chart Component
export const InteractiveLineChart = ({ 
  data, 
  onPointClick,
  title = "Trend Analysis",
  lines = [
    { key: 'income', color: '#58D68D', name: 'Income' },
    { key: 'expenses', color: '#EC7063', name: 'Expenses' },
    { key: 'net', color: '#5DADE2', name: 'Net Flow' }
  ]
}) => {
  const [activeLine, setActiveLine] = useState(null);

  const handlePointClick = (data, lineKey) => {
    if (onPointClick) {
      onPointClick(data, lineKey);
    }
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 3, height: 450 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        {title}
      </Typography>
      
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <YAxis 
              tickFormatter={(value) => `₹${Math.abs(value).toLocaleString('en-IN')}`}
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              onClick={(data) => setActiveLine(activeLine === data.dataKey ? null : data.dataKey)}
            />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={activeLine && activeLine !== line.key ? 1 : 3}
                opacity={activeLine && activeLine !== line.key ? 0.3 : 1}
                dot={{ 
                  fill: line.color, 
                  r: 4, 
                  cursor: 'pointer',
                  strokeWidth: 2,
                  stroke: '#fff'
                }}
                activeDot={{ 
                  r: 6, 
                  cursor: 'pointer',
                  onClick: (data) => handlePointClick(data, line.key)
                }}
                name={line.name}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body2" color="text.secondary">
            No trend data available
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// Interactive Bar Chart Component
export const InteractiveBarChart = ({ 
  data, 
  onBarClick,
  title = "Monthly Comparison",
  bars = [
    { key: 'income', color: '#58D68D', name: 'Income' },
    { key: 'expenses', color: '#EC7063', name: 'Expenses' },
    { key: 'savings', color: '#5DADE2', name: 'Savings' }
  ]
}) => {
  const [activeBar, setActiveBar] = useState(null);

  const handleBarClick = (data, barKey) => {
    if (onBarClick) {
      onBarClick(data, barKey);
    }
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 3, height: 450 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        {title}
      </Typography>
      
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <YAxis 
              tickFormatter={(value) => `₹${Math.abs(value).toLocaleString('en-IN')}`}
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              onClick={(data) => setActiveBar(activeBar === data.dataKey ? null : data.dataKey)}
            />
            {bars.map((bar) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                fill={bar.color}
                opacity={activeBar && activeBar !== bar.key ? 0.3 : 1}
                name={bar.name}
                cursor="pointer"
                onClick={(data) => handleBarClick(data, bar.key)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body2" color="text.secondary">
            No comparison data available
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
