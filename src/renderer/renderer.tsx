/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 */

import './globals.css';
import './styles.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PluginProvider } from '../../plugins/core/PluginContext';

const root = createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <PluginProvider>
    <App />
  </PluginProvider>
);
