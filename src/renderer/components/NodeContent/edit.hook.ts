import { useState, useRef, useEffect } from 'react';

export function useNodeEdit(
  initialValue: string,
  isEditing: boolean,
  onSave: (value: string) => void,
  onCancel: () => void
) {
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(initialValue);
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editValue.trim()) {
        onSave(editValue.trim());
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(initialValue);
      onCancel();
    }
  };

  const handleBlur = () => {
    if (editValue.trim()) {
      onSave(editValue.trim());
    } else {
      setEditValue(initialValue);
      onCancel();
    }
  };

  return {
    editValue,
    setEditValue,
    inputRef,
    handleKeyDown,
    handleBlur,
  };
}
