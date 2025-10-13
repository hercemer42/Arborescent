import { memo } from 'react';
import { Tab } from '../Tab';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { storeManager } from '../../store/storeManager';
import './TabBar.css';

export const TabBar = memo(function TabBar() {
  const openFiles = useTabsStore((state) => state.openFiles);
  const activeFilePath = useTabsStore((state) => state.activeFilePath);
  const setActiveFile = useTabsStore((state) => state.setActiveFile);
  const closeFile = useTabsStore((state) => state.closeFile);

  const handleTabClick = (path: string) => {
    setActiveFile(path);
  };

  const handleTabClose = async (path: string) => {
    await storeManager.closeFile(path);
    closeFile(path);
  };

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      {openFiles.map((file) => (
        <Tab
          key={file.path}
          displayName={file.displayName}
          isActive={file.path === activeFilePath}
          onClick={() => handleTabClick(file.path)}
          onClose={() => handleTabClose(file.path)}
        />
      ))}
    </div>
  );
});
