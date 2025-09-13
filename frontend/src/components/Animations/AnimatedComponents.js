import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box } from '@mui/material';

// Fade In Animation
export const FadeIn = ({ children, delay = 0, duration = 0.5 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration, delay, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// Slide In Animation
export const SlideIn = ({ children, direction = 'left', delay = 0 }) => {
  const variants = {
    left: { x: -50 },
    right: { x: 50 },
    up: { y: 50 },
    down: { y: -50 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...variants[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...variants[direction] }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

// Scale In Animation
export const ScaleIn = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.3, delay, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// Staggered Children Animation
export const StaggerContainer = ({ children, staggerDelay = 0.1 }) => (
  <motion.div
    initial="hidden"
    animate="show"
    exit="hidden"
    variants={{
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, index = 0 }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      show: { opacity: 1, y: 0 },
    }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// Card Hover Animation
export const AnimatedCard = ({ children, ...props }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <Box {...props}>
      {children}
    </Box>
  </motion.div>
);

// List Item Animation
export const AnimatedListItem = ({ children, onDelete, ...props }) => (
  <motion.div
    layout
    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
    transition={{ duration: 0.3, ease: 'easeInOut' }}
    whileHover={{ scale: 1.01 }}
    {...props}
  >
    {children}
  </motion.div>
);

// Button with Pulse Animation
export const PulseButton = ({ children, ...props }) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
  >
    <Box component="div" {...props}>
      {children}
    </Box>
  </motion.div>
);

// Number Counter Animation
export const AnimatedNumber = ({ value, duration = 1, prefix = '', suffix = '' }) => {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.span
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration }}
      >
        {prefix}{value.toLocaleString('en-IN')}{suffix}
      </motion.span>
    </motion.span>
  );
};
