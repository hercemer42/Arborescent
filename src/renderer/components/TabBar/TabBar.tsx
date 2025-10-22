import { memo } from 'react';
import { Tab } from '../Tab';
import { useTabKeyboard } from './hooks/useTabKeyboard';
import { useFilesStore } from '../../store/files/filesStore';
import './TabBar.css';

export const TabBar = memo(function TabBar() {
  useTabKeyboard();

  const files = useFilesStore((state) => state.files);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const setActiveFile = useFilesStore((state) => state.setActiveFile);
  const closeFile = useFilesStore((state) => state.actions.closeFile);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      {files.map((file) => (
        <Tab
          key={file.path}
          displayName={file.displayName}
          isActive={file.path === activeFilePath}
          onClick={() => setActiveFile(file.path)}
          onClose={() => closeFile(file.path)}
        />
      ))}
    </div>
  );
});
