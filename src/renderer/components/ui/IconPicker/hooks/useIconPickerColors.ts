import { useState, useCallback, useMemo } from 'react';
import { PRESET_COLORS } from '../IconPicker';

export function useIconPickerColors(initialColor?: string | null) {
  const [currentColor, setCurrentColor] = useState(initialColor || '');
  const [customColor, setCustomColor] = useState('');

  const handleColorSelect = useCallback((color: string) => {
    setCurrentColor(color);
    setCustomColor('');
  }, []);

  const handleCustomColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    setCurrentColor(color);
  }, []);

  const isPresetColor = useMemo(
    () => PRESET_COLORS.some(c => c.value === currentColor),
    [currentColor]
  );

  const isCustomColor = useMemo(
    () => !isPresetColor && currentColor !== '',
    [isPresetColor, currentColor]
  );

  return {
    currentColor,
    customColor,
    isPresetColor,
    isCustomColor,
    handleColorSelect,
    handleCustomColorChange,
  };
}
