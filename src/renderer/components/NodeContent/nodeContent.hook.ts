import { useState, useRef, useEffect } from 'react';
import { useTreeStore } from '../../store/treeStore';
import { Node } from '../../../shared/types';

export function useNodeContent(node: Node) {
  const nodeTypeConfig = useTreeStore((state) => state.nodeTypeConfig);
  const isSelected = useTreeStore((state) => state.selectedNodeId === node.id);
  const isEditing = useTreeStore((state) => state.editingNodeId === node.id);
  const selectNode = useTreeStore((state) => state.selectNode);
  const startEdit = useTreeStore((state) => state.startEdit);
  const finishEdit = useTreeStore((state) => state.finishEdit);
  const updateContent = useTreeStore((state) => state.updateContent);
  const updateStatus = useTreeStore((state) => state.updateStatus);

  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
  const hasChildren = node.children.length > 0;

  const [editValue, setEditValue] = useState(node.content);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(node.content);
  }, [node.content]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
    if (isSelected && !isEditing) {
      startEdit(node.id);
    }
  };

  const handleSaveEdit = (value: string) => {
    updateContent(node.id, value);
    finishEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editValue.trim()) {
        handleSaveEdit(editValue.trim());
      } else {
        finishEdit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(node.content);
      finishEdit();
    }
  };

  const handleBlur = () => {
    if (editValue.trim()) {
      handleSaveEdit(editValue.trim());
    } else {
      setEditValue(node.content);
      finishEdit();
    }
  };

  return {
    config,
    hasChildren,
    isSelected,
    isEditing,
    handleClick,
    updateStatus,
    editValue,
    setEditValue,
    inputRef,
    handleKeyDown,
    handleBlur,
  };
}
