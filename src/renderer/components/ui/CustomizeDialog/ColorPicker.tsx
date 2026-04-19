import type { ChangeEvent } from 'react';
import { PRESET_COLORS } from './CustomizeDialog';

interface ColorPickerProps {
  currentColor: string | null;
  customColor: string | null;
  isCustomColor: boolean;
  onColorSelect: (color: string) => void;
  onCustomColorChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Preset-swatch + custom-color-picker row. Self-contained; takes the
 * color state precomputed by useIconPickerColors and emits selections.
 */
export function ColorPicker({
  currentColor,
  customColor,
  isCustomColor,
  onColorSelect,
  onCustomColorChange,
}: ColorPickerProps) {
  return (
    <div className="icon-picker-color-section">
      <div className="icon-picker-color-label">Color</div>
      <div className="icon-picker-color-grid">
        {PRESET_COLORS.map(({ name, value }) => (
          <button
            key={value}
            className={`icon-picker-color-item ${currentColor === value ? 'selected' : ''}`}
            style={{ backgroundColor: value }}
            onClick={() => onColorSelect(value)}
            title={name}
          />
        ))}
        <div className={`icon-picker-custom-color ${isCustomColor ? 'selected' : ''}`}>
          <input
            type="color"
            value={customColor || currentColor || '#64748b'}
            onChange={onCustomColorChange}
            className="icon-picker-color-input"
            title="Custom color"
          />
          {isCustomColor && (
            <span className="icon-picker-custom-indicator" />
          )}
        </div>
      </div>
    </div>
  );
}
