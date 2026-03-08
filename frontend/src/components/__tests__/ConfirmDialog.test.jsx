import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ConfirmDialog from '../ConfirmDialog';

const defaultProps = {
  message: 'Delete "Pasta"? This cannot be undone.',
  onConfirm: vi.fn(),
  triggerLabel: 'Delete',
};

function renderDialog(props = {}) {
  return render(<ConfirmDialog {...defaultProps} {...props} />);
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderDialog();
  });

  it('resting state: trigger button is visible', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('resting state: confirmation row is not visible', () => {
    renderDialog();
    expect(screen.queryByText('Yes, delete')).not.toBeInTheDocument();
  });

  it('clicking trigger shows confirmation row', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Delete "Pasta"? This cannot be undone.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('confirmation row shows the message prop verbatim', async () => {
    const user = userEvent.setup();
    const message = 'Delete "Risotto"? This cannot be undone.';
    renderDialog({ message });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('clicking Cancel returns to resting state without calling onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByText('Yes, delete')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking Confirm calls onConfirm exactly once', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('custom triggerLabel is rendered', () => {
    renderDialog({ triggerLabel: 'Remove friend' });
    expect(screen.getByRole('button', { name: 'Remove friend' })).toBeInTheDocument();
  });

  it('custom confirmLabel and cancelLabel are rendered in pending state', async () => {
    const user = userEvent.setup();
    renderDialog({ confirmLabel: 'Yes, remove', cancelLabel: 'Never mind' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Yes, remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Never mind' })).toBeInTheDocument();
  });

  it('trigger button is accessible via role and label', () => {
    renderDialog({ triggerLabel: 'Delete' });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('confirm and cancel buttons are accessible in pending state', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
