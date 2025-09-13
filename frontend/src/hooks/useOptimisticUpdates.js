import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';

export const useOptimisticUpdates = () => {
  const [optimisticData, setOptimisticData] = useState({});
  const dispatch = useDispatch();

  const addOptimisticTransaction = useCallback((tempId, transactionData) => {
    const optimisticTransaction = {
      _id: tempId,
      ...transactionData,
      isOptimistic: true,
      createdAt: new Date().toISOString(),
    };

    setOptimisticData(prev => ({
      ...prev,
      [tempId]: optimisticTransaction
    }));

    return optimisticTransaction;
  }, []);

  const updateOptimisticTransaction = useCallback((tempId, updates) => {
    setOptimisticData(prev => ({
      ...prev,
      [tempId]: prev[tempId] ? { ...prev[tempId], ...updates, isOptimistic: true } : null
    }));
  }, []);

  const removeOptimisticTransaction = useCallback((tempId) => {
    setOptimisticData(prev => {
      const newData = { ...prev };
      delete newData[tempId];
      return newData;
    });
  }, []);

  const confirmOptimisticTransaction = useCallback((tempId, realTransaction) => {
    removeOptimisticTransaction(tempId);
    return realTransaction;
  }, [removeOptimisticTransaction]);

  const revertOptimisticTransaction = useCallback((tempId) => {
    removeOptimisticTransaction(tempId);
  }, [removeOptimisticTransaction]);

  return {
    optimisticData,
    addOptimisticTransaction,
    updateOptimisticTransaction,
    removeOptimisticTransaction,
    confirmOptimisticTransaction,
    revertOptimisticTransaction,
  };
};