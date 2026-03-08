import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import Toast from '../Toast';

const makeToast = (overrides = {}) => ({
  id: 'test-id-1',
  message: 'Test notification',
  variant: 'success',
  duration: 4000,
  ...overrides,
});

describe('Toast', () => {
  it('renders without crashing', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />);
  });

  it('displays the message text', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ message: 'Hello world' })} onDismiss={onDismiss} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('close button is present and accessible', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />);
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('clicking close button calls onDismiss with the toast id', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const toast = makeToast({ id: 'abc-123' });
    render(<Toast toast={toast} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledWith('abc-123');
  });

  it('role="alert" is set on the toast container', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('icon is hidden from the accessibility tree', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ variant: 'success' })} onDismiss={onDismiss} />);
    const icon = screen.getByText('✓');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('success toast has sage background class', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ variant: 'success' })} onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toHaveClass('bg-sage-600');
  });

  it('error toast has terracotta background class', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ variant: 'error' })} onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toHaveClass('bg-terracotta-500');
  });
});
