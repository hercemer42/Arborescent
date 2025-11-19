import { Tab } from '../../Tab';
import { BrowserTab } from '../../../../shared/interfaces';
import './BrowserTabBar.css';

interface BrowserTabBarProps {
  tabs: BrowserTab[];
  activeTabId: string | null;
  panelPosition: 'side' | 'bottom';
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onTogglePanelPosition: () => void;
}

export function BrowserTabBar({
  tabs,
  activeTabId,
  panelPosition,
  onTabClick,
  onTabClose,
  onNewTab,
  onTogglePanelPosition,
}: BrowserTabBarProps) {
  return (
    <div className="browser-tab-bar">
      <div className="browser-tabs-left">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            displayName={tab.title}
            isActive={activeTabId === tab.id}
            onClick={() => onTabClick(tab.id)}
            onClose={() => onTabClose(tab.id)}
          />
        ))}
        <button onClick={onNewTab} className="new-browser-button" title="New Tab">
          +
        </button>
      </div>
      <button
        onClick={onTogglePanelPosition}
        className="toggle-panel-button"
        title={`Switch to ${panelPosition === 'side' ? 'bottom' : 'side'} panel`}
      >
        {panelPosition === 'side' ? '⬇' : '➡'}
      </button>
    </div>
  );
}
