import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * Type-only leaf module for the CustomizeDialog cluster. Extracted so
 * IconGrid / ColorPicker / ModeToggle / hooks can import LucideIcon and
 * PRESET_COLORS without forming a cycle back through the main
 * CustomizeDialog component.
 */
export type LucideIcon = ComponentType<LucideProps>;

// Amber and Sky values match globals.css variables for consistency.
export const PRESET_COLORS = [
  { name: 'Slate', value: '#64748b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#c47f09' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Purple', value: '#a855f7' },
];
