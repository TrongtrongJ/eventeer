import React, { ReactElement, JSX } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from '../store/slices/apiSlice';
import { rootReducer, type RootState } from '../store';

// 1. Create a function to generate a fresh store
export const setupTestStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState,
  });
};

// 2. Create a custom render function that wraps components in the Provider
interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<any>;
  store?: ReturnType<typeof setupTestStore>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    // If no store is passed, create a new one
    store = setupTestStore(),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }): JSX.Element {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Re-export everything from RTL
export * from '@testing-library/react';