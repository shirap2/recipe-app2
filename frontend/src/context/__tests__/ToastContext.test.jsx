import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach } from 'vitest';

import { ToastProvider } from '../ToastContext';
import useToast from '../../hooks/useToast';

function TestConsumer({ message, variant, duration }) {
  const { showToast } = useToast();
  return (
    <button
      onClick={() => showToast(message, variant, duration)}
    >
      Trigger
    </button>
  );
}

function BrokenConsumer() {
  useToast();
  return null;
}

const renderWithProvider = (ui) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('useToast', () => {
  it('throws if called outside ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BrokenConsumer />)).toThrow(
      'useToast must be used inside ToastProvider'
    );
    spy.mockRestore();
  });
});

describe('ToastProvider', () => {
  it('showToast renders a toast with the correct message', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <TestConsumer message="Hello" variant="success" duration={0} />
    );
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('showToast with error variant renders the error toast', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <TestConsumer message="Oops" variant="error" duration={0} />
    );
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('alert')).toHaveClass('bg-terracotta-500');
  });

  it('showToast with success variant renders the success toast', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <TestConsumer message="Done" variant="success" duration={0} />
    );
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('alert')).toHaveClass('bg-sage-600');
  });

  describe('auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('toast auto-dismisses after duration ms', () => {
      renderWithProvider(
        <TestConsumer message="Bye" variant="error" duration={1000} />
      );
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
      });
      expect(screen.getByText('Bye')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText('Bye')).not.toBeInTheDocument();
    });

    it('toast with duration 0 does not auto-dismiss', () => {
      renderWithProvider(
        <TestConsumer message="Sticky" variant="success" duration={0} />
      );
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
      });
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText('Sticky')).toBeInTheDocument();
    });
  });

  it('multiple showToast calls render multiple toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer message="First" variant="success" duration={0} />
        <TestConsumer message="Second" variant="error" duration={0} />
      </ToastProvider>
    );
    const [first, second] = screen.getAllByRole('button', { name: 'Trigger' });
    await user.click(first);
    await user.click(second);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('dismissing one toast does not affect others', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer message="Keep" variant="success" duration={0} />
        <TestConsumer message="Remove" variant="error" duration={0} />
      </ToastProvider>
    );
    const [first, second] = screen.getAllByRole('button', { name: 'Trigger' });
    await user.click(first);
    await user.click(second);
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss notification' });
    await user.click(dismissButtons[1]);
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });
});
