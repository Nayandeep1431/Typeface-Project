import { configureStore } from '@reduxjs/toolkit';
import authSlice from '../features/auth/authSlice';
import transactionSlice from '../features/transactions/transactionSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    transactions: transactionSlice,
  },
});

// Remove TypeScript type exports for JavaScript
// These lines are not needed in JavaScript:
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;
