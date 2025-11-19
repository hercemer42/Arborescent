import './BrowserNavBar.css';

interface BrowserNavBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  addressBarValue: string;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onAddressBarChange: (value: string) => void;
  onAddressBarSubmit: (e?: React.FormEvent) => void;
  onAddressBarFocus: () => void;
  onAddressBarBlur: () => void;
}

export function BrowserNavBar({
  canGoBack,
  canGoForward,
  addressBarValue,
  onBack,
  onForward,
  onReload,
  onAddressBarChange,
  onAddressBarSubmit,
  onAddressBarFocus,
  onAddressBarBlur,
}: BrowserNavBarProps) {
  return (
    <div className="browser-nav-bar">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        className="browser-nav-button"
        title="Back"
      >
        ←
      </button>
      <button
        onClick={onForward}
        disabled={!canGoForward}
        className="browser-nav-button"
        title="Forward"
      >
        →
      </button>
      <button onClick={onReload} className="browser-nav-button" title="Reload">
        ↻
      </button>
      <form onSubmit={onAddressBarSubmit} className="browser-nav-form">
        <input
          type="text"
          className="browser-url-display"
          value={addressBarValue}
          onFocus={onAddressBarFocus}
          onBlur={onAddressBarBlur}
          onChange={(e) => onAddressBarChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAddressBarSubmit();
            }
          }}
          placeholder="Enter URL..."
        />
      </form>
    </div>
  );
}
