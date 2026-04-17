import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { Toast } from '../Toast';
import { ToastContainer } from '../ToastContainer';
import type { ToastAction, ToastItem } from '../ToastContainer';

interface HarnessProps {
  initialToasts?: ToastItem[];
  externalInputTestId?: string;
}

function FocusHarness({ initialToasts = [], externalInputTestId = 'external-input' }: HarnessProps) {
  const [toasts, setToasts] = useState<ToastItem[]>(initialToasts);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <>
      <input ref={inputRef} data-testid={externalInputTestId} />
      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
      <button
        data-testid="add-toast"
        onClick={() =>
          setToasts((prev) => [
            ...prev,
            { id: `t-${prev.length + 1}`, message: `Toast ${prev.length + 1}`, type: 'info' },
          ])
        }
      >
        add
      </button>
      <button
        data-testid="add-toast-with-actions"
        onClick={() =>
          setToasts((prev) => [
            ...prev,
            {
              id: `ta-${prev.length + 1}`,
              message: `Toast ${prev.length + 1}`,
              type: 'info',
              actions: [{ label: 'Continue', onClick: vi.fn() }],
            },
          ])
        }
      >
        add-actions
      </button>
      <button
        data-testid="add-persistent-toast"
        onClick={() =>
          setToasts((prev) => [
            ...prev,
            { id: `tp-${prev.length + 1}`, message: 'Persistent', type: 'info', persistent: true },
          ])
        }
      >
        add-persistent
      </button>
    </>
  );
}

describe('Toast focus preservation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('happy path — external element retains focus', () => {
    it('should not steal focus when a toast is rendered initially alongside a focused element', () => {
      render(
        <FocusHarness
          initialToasts={[{ id: '1', message: 'Hello', type: 'info' }]}
        />,
      );

      const input = screen.getByTestId('external-input');
      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast is added to an empty list', () => {
      render(<FocusHarness />);
      const input = screen.getByTestId('external-input');
      expect(document.activeElement).toBe(input);

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast is appended to existing toasts', () => {
      render(
        <FocusHarness
          initialToasts={[{ id: 'pre', message: 'Existing', type: 'info' }]}
        />,
      );
      const input = screen.getByTestId('external-input');

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast is auto-dismissed', () => {
      render(
        <FocusHarness
          initialToasts={[{ id: '1', message: 'Dismiss me', type: 'info' }]}
        />,
      );
      const input = screen.getByTestId('external-input');

      act(() => {
        vi.advanceTimersByTime(8000);
      });

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a persistent toast is rendered', () => {
      render(<FocusHarness />);
      const input = screen.getByTestId('external-input');

      fireEvent.click(screen.getByTestId('add-persistent-toast'));

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast with action buttons is rendered', () => {
      render(<FocusHarness />);
      const input = screen.getByTestId('external-input');

      fireEvent.click(screen.getByTestId('add-toast-with-actions'));

      expect(document.activeElement).toBe(input);
    });
  });

  describe('concurrent / repeated interactions', () => {
    it('should not steal focus when multiple toasts are added in rapid succession', () => {
      render(<FocusHarness />);
      const input = screen.getByTestId('external-input');

      const addButton = screen.getByTestId('add-toast');
      fireEvent.click(addButton);
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a mix of normal and action toasts are added together', () => {
      render(<FocusHarness />);
      const input = screen.getByTestId('external-input');

      fireEvent.click(screen.getByTestId('add-toast'));
      fireEvent.click(screen.getByTestId('add-toast-with-actions'));
      fireEvent.click(screen.getByTestId('add-persistent-toast'));

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when toasts are added and removed repeatedly', () => {
      const { rerender } = render(
        <ToastContainer toasts={[]} onRemove={vi.fn()} />,
      );

      const external = document.createElement('input');
      document.body.appendChild(external);
      external.focus();
      expect(document.activeElement).toBe(external);

      const toastsA: ToastItem[] = [{ id: '1', message: 'A', type: 'info' }];
      rerender(<ToastContainer toasts={toastsA} onRemove={vi.fn()} />);
      expect(document.activeElement).toBe(external);

      rerender(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
      expect(document.activeElement).toBe(external);

      const toastsB: ToastItem[] = [
        { id: '2', message: 'B', type: 'error' },
        { id: '3', message: 'C', type: 'success' },
      ];
      rerender(<ToastContainer toasts={toastsB} onRemove={vi.fn()} />);
      expect(document.activeElement).toBe(external);

      external.remove();
    });

    it('should not steal focus when an auto-dismiss fires while another toast is being added', () => {
      function Rapid() {
        const [toasts, setToasts] = useState<ToastItem[]>([
          { id: 'first', message: 'first', type: 'info' },
        ]);
        const inputRef = useRef<HTMLInputElement>(null);
        useEffect(() => {
          inputRef.current?.focus();
        }, []);
        return (
          <>
            <input ref={inputRef} data-testid="input" />
            <ToastContainer
              toasts={toasts}
              onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
            />
            <button
              data-testid="add"
              onClick={() =>
                setToasts((prev) => [
                  ...prev,
                  { id: `new-${prev.length}`, message: 'new', type: 'info' },
                ])
              }
            >
              add
            </button>
          </>
        );
      }

      render(<Rapid />);
      const input = screen.getByTestId('input');

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      fireEvent.click(screen.getByTestId('add'));
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(document.activeElement).toBe(input);
    });
  });

  describe('error / failure states', () => {
    it('should not steal focus when rendering an error-type toast', () => {
      render(
        <FocusHarness
          initialToasts={[{ id: '1', message: 'Boom', type: 'error' }]}
        />,
      );
      const input = screen.getByTestId('external-input');

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast action callback throws', () => {
      function ThrowingScenario() {
        const inputRef = useRef<HTMLInputElement>(null);
        useEffect(() => {
          inputRef.current?.focus();
        }, []);
        const throwingAction: ToastAction = {
          label: 'Boom',
          onClick: () => {
            throw new Error('boom');
          },
        };
        return (
          <>
            <input ref={inputRef} data-testid="scenario-input" />
            <ToastContainer
              toasts={[
                {
                  id: '1',
                  message: 'Err',
                  type: 'error',
                  actions: [throwingAction],
                },
              ]}
              onRemove={vi.fn()}
            />
          </>
        );
      }

      render(<ThrowingScenario />);
      const input = screen.getByTestId('scenario-input');

      expect(document.activeElement).toBe(input);
    });
  });

  describe('empty / null / undefined inputs', () => {
    it('should not steal focus when toasts array is empty', () => {
      render(<FocusHarness initialToasts={[]} />);
      const input = screen.getByTestId('external-input');

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast with undefined actions is rendered', () => {
      const external = document.createElement('input');
      document.body.appendChild(external);
      external.focus();

      const onClose = vi.fn();
      render(<Toast message="No actions" type="info" actions={undefined} onClose={onClose} />);

      expect(document.activeElement).toBe(external);
      external.remove();
    });

    it('should not steal focus when a toast with empty actions array is rendered', () => {
      const external = document.createElement('input');
      document.body.appendChild(external);
      external.focus();

      const onClose = vi.fn();
      render(<Toast message="Empty actions" type="info" actions={[]} onClose={onClose} />);

      expect(document.activeElement).toBe(external);
      external.remove();
    });

    it('should not steal focus when a toast with empty message is rendered', () => {
      const external = document.createElement('input');
      document.body.appendChild(external);
      external.focus();

      const onClose = vi.fn();
      render(<Toast message="" type="info" onClose={onClose} />);

      expect(document.activeElement).toBe(external);
      external.remove();
    });
  });

  describe('boundary values / limits', () => {
    it('should not steal focus when many toasts are rendered at once', () => {
      const many: ToastItem[] = Array.from({ length: 20 }, (_, i) => ({
        id: `b-${i}`,
        message: `Toast ${i}`,
        type: 'info' as const,
      }));

      render(<FocusHarness initialToasts={many} />);
      const input = screen.getByTestId('external-input');

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when a toast with very long message is rendered', () => {
      const external = document.createElement('input');
      document.body.appendChild(external);
      external.focus();

      const onClose = vi.fn();
      render(<Toast message={'x'.repeat(10000)} type="info" onClose={onClose} />);

      expect(document.activeElement).toBe(external);
      external.remove();
    });

    it('should not steal focus when duration is set to 0', () => {
      const external = document.createElement('input');
      document.body.appendChild(external);
      external.focus();

      const onClose = vi.fn();
      render(<Toast message="Zero" type="info" duration={0} onClose={onClose} />);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(document.activeElement).toBe(external);
      external.remove();
    });
  });

  describe('accessibility / UX', () => {
    it('should use role="alert" (non-focus-stealing live region) rather than role="alertdialog"', () => {
      const onClose = vi.fn();
      render(<Toast message="Accessible" type="info" onClose={onClose} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should not apply autoFocus to the close button', () => {
      const onClose = vi.fn();
      render(<Toast message="Test" type="info" onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close notification/i });
      expect(closeButton).not.toHaveAttribute('autofocus');
    });

    it('should not apply autoFocus to action buttons', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
        { label: 'Stop', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      expect(screen.getByRole('button', { name: 'Continue' })).not.toHaveAttribute('autofocus');
      expect(screen.getByRole('button', { name: 'Stop' })).not.toHaveAttribute('autofocus');
    });

    it('should not apply autoFocus to the toast root element', () => {
      const onClose = vi.fn();
      render(<Toast message="Test" type="info" onClose={onClose} />);

      expect(screen.getByRole('alert')).not.toHaveAttribute('autofocus');
    });

    it('should not place the toast in the tab order with tabIndex=0', () => {
      const onClose = vi.fn();
      render(<Toast message="Test" type="info" onClose={onClose} />);

      const alert = screen.getByRole('alert');
      const tabIndex = alert.getAttribute('tabindex');
      expect(tabIndex === null || tabIndex === '-1' || parseInt(tabIndex) < 0).toBe(true);
    });

    it('should keep screen-reader announcement (role alert) even while preserving focus', () => {
      render(<FocusHarness />);
      const input = screen.getByTestId('external-input');

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(document.activeElement).toBe(input);
    });
  });

  describe('terminal focus scenario', () => {
    it('should preserve focus on a terminal-like element when a toast appears', () => {
      function TerminalScenario() {
        const [toasts, setToasts] = useState<ToastItem[]>([]);
        const termRef = useRef<HTMLTextAreaElement>(null);
        useEffect(() => {
          termRef.current?.focus();
        }, []);
        return (
          <>
            <textarea ref={termRef} data-testid="terminal" />
            <ToastContainer
              toasts={toasts}
              onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
            />
            <button
              data-testid="fire"
              onClick={() =>
                setToasts((prev) => [
                  ...prev,
                  { id: `t-${prev.length}`, message: 'A session completed', type: 'info' },
                ])
              }
            >
              fire
            </button>
          </>
        );
      }

      render(<TerminalScenario />);
      const terminal = screen.getByTestId('terminal');
      expect(document.activeElement).toBe(terminal);

      fireEvent.click(screen.getByTestId('fire'));

      expect(document.activeElement).toBe(terminal);
    });
  });
});
