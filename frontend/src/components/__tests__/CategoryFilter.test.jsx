import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import CategoryFilter from '../CategoryFilter';

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other'];

describe('CategoryFilter', () => {
  it('renders without crashing', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />);
  });

  it('renders "All" pill', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('renders all 7 category pills', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />);
    CATEGORIES.forEach((cat) => {
      expect(screen.getByRole('button', { name: cat })).toBeInTheDocument();
    });
  });

  it('"All" pill is active when value is null', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    CATEGORIES.forEach((cat) => {
      expect(screen.getByRole('button', { name: cat })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('correct pill is active when value is set', () => {
    render(<CategoryFilter value="Dinner" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    CATEGORIES.filter((c) => c !== 'Dinner').forEach((cat) => {
      expect(screen.getByRole('button', { name: cat })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking an inactive category calls onChange with that category', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<CategoryFilter value={null} onChange={handleChange} />);
    await user.click(screen.getByRole('button', { name: 'Breakfast' }));
    expect(handleChange).toHaveBeenCalledWith('Breakfast');
  });

  it('clicking "All" calls onChange(null)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<CategoryFilter value="Lunch" onChange={handleChange} />);
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('clicking the active category calls onChange(null) — toggle off', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<CategoryFilter value="Dinner" onChange={handleChange} />);
    await user.click(screen.getByRole('button', { name: 'Dinner' }));
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('each pill has type="button"', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('type', 'button');
    });
  });

  it('pill group has accessible label', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Filter by category' })).toBeInTheDocument();
  });

  it('active pill has aria-pressed="true"', () => {
    CATEGORIES.forEach((activeCategory) => {
      const { unmount } = render(
        <CategoryFilter value={activeCategory} onChange={() => {}} />
      );
      expect(screen.getByRole('button', { name: activeCategory })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      unmount();
    });
  });
});
