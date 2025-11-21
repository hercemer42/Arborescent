import { act } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import type { StateCreator } from 'zustand';

// Store reset functions - clear between tests to allow GC
export const storeResetFns = new Set<() => void>();

// Get actual zustand synchronously using createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const actualZustand = require('zustand') as typeof import('zustand');

beforeEach(() => {
  storeResetFns.clear();
});

const createUncurried = <T>(stateCreator: StateCreator<T>) => {
  const store = actualZustand.create(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

export const create = (<T>(stateCreator: StateCreator<T>) => {
  return typeof stateCreator === 'function'
    ? createUncurried(stateCreator)
    : createUncurried;
}) as typeof actualZustand.create;

const createStoreUncurried = <T>(stateCreator: StateCreator<T>) => {
  const store = actualZustand.createStore(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

export const createStore = (<T>(stateCreator: StateCreator<T>) => {
  return typeof stateCreator === 'function'
    ? createStoreUncurried(stateCreator)
    : createStoreUncurried;
}) as typeof actualZustand.createStore;

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => {
      resetFn();
    });
  });
  storeResetFns.clear();
});
