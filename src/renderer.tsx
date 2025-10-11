/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 */

import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
