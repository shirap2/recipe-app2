import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import SortControls from '../SortControls';

describe('SortControls', () => {
  it('renders without crashing', () => {
    render(<SortControls onChange={() => {}} />);
  });

  it('field select defaults to "Date added" when sort prop is omitted', () => {
    render(<SortControls onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('createdAt');
  });

  it('order select defaults to "Newest first" when order prop is omitted', () => {
    render(<SortControls onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Sort order' })).toHaveValue('desc');
  });

  it('field select reflects controlled sort prop', () => {
    render(<SortControls sort="title" order="desc" onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('title');
  });

  it('order select reflects controlled order prop', () => {
    render(<SortControls sort="createdAt" order="asc" onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Sort order' })).toHaveValue('asc');
  });

  it('changing field select calls onChange with new field and current order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortControls sort="createdAt" order="desc" onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'title');
    expect(onChange).toHaveBeenCalledWith('title', 'desc');
  });

  it('changing order select calls onChange with current sort and new order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortControls sort="createdAt" order="desc" onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort order' }), 'asc');
    expect(onChange).toHaveBeenCalledWith('createdAt', 'asc');
  });

  it('changing the field select does not alter the order value passed to onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortControls sort="createdAt" order="desc" onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'prepTime');
    expect(onChange).toHaveBeenCalledWith('prepTime', 'desc');
  });

  it('field select is accessible via aria-label', () => {
    render(<SortControls onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument();
  });

  it('order select is accessible via aria-label', () => {
    render(<SortControls onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Sort order' })).toBeInTheDocument();
  });

  it('renders all four field options', () => {
    render(<SortControls onChange={() => {}} />);
    const fieldSelect = screen.getByRole('combobox', { name: 'Sort by' });
    const values = Array.from(fieldSelect.options).map((o) => o.value);
    expect(values).toContain('createdAt');
    expect(values).toContain('title');
    expect(values).toContain('prepTime');
    expect(values).toContain('cookTime');
  });

  it('renders both order options', () => {
    render(<SortControls onChange={() => {}} />);
    const orderSelect = screen.getByRole('combobox', { name: 'Sort order' });
    const values = Array.from(orderSelect.options).map((o) => o.value);
    expect(values).toContain('asc');
    expect(values).toContain('desc');
  });
});
