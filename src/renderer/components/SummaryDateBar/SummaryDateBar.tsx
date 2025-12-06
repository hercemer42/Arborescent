import { memo, useCallback } from 'react';
import { useStore } from '../../store/tree/useStore';
import './SummaryDateBar.css';

export const SummaryDateBar = memo(function SummaryDateBar() {
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);
  const summaryDateFrom = useStore((state) => state.summaryDateFrom);
  const summaryDateTo = useStore((state) => state.summaryDateTo);
  const setSummaryDates = useStore((state) => state.actions.setSummaryDates);

  const handleFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSummaryDates(e.target.value || null, summaryDateTo);
  }, [setSummaryDates, summaryDateTo]);

  const handleToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSummaryDates(summaryDateFrom, e.target.value || null);
  }, [setSummaryDates, summaryDateFrom]);

  const handleClearFrom = useCallback(() => {
    setSummaryDates(null, summaryDateTo);
  }, [setSummaryDates, summaryDateTo]);

  const handleClearTo = useCallback(() => {
    setSummaryDates(summaryDateFrom, null);
  }, [setSummaryDates, summaryDateFrom]);

  if (!summaryModeEnabled) {
    return null;
  }

  return (
    <div className="summary-date-bar">
      <span className="summary-date-bar-label">Summary:</span>
      <div className="summary-date-bar-field">
        <label>From</label>
        <input
          type="date"
          value={summaryDateFrom || ''}
          onChange={handleFromChange}
        />
        {summaryDateFrom && (
          <button className="summary-date-bar-clear" onClick={handleClearFrom}>×</button>
        )}
      </div>
      <div className="summary-date-bar-field">
        <label>To</label>
        <input
          type="date"
          value={summaryDateTo || ''}
          onChange={handleToChange}
        />
        {summaryDateTo && (
          <button className="summary-date-bar-clear" onClick={handleClearTo}>×</button>
        )}
      </div>
    </div>
  );
});
