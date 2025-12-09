/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 */

import './globals.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(<App />);
