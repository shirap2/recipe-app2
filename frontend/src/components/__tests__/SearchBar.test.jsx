import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  it('renders without crashing', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} />);
  });

  it('shows initialValue in the input on mount', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} initialValue="pasta" />);
    expect(screen.getByRole('searchbox')).toHaveValue('pasta');
  });

  it('shows placeholder text when input is empty', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search by title or tag\u2026');
  });

  it('hides Clear button when isSearching is false', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} isSearching={false} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('shows Clear button when isSearching is true', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} isSearching={true} />);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('updates input value as the user types', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={() => {}} onClear={() => {}} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'soup');
    expect(input).toHaveValue('soup');
  });

  it('calls onSearch with trimmed query on submit with non-empty value', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onClear  = vi.fn();
    render(<SearchBar onSearch={onSearch} onClear={onClear} />);
    await user.type(screen.getByRole('searchbox'), '  pasta  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith('pasta');
    expect(onClear).not.toHaveBeenCalled();
  });

  it('calls onClear (not onSearch) on submit with empty value', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onClear  = vi.fn();
    render(<SearchBar onSearch={onSearch} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('calls onClear and resets input to empty string when Clear is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchBar onSearch={() => {}} onClear={onClear} initialValue="pasta" isSearching={true} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('does not call onSearch when Clear is clicked', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} onClear={() => {}} initialValue="pasta" isSearching={true} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('input is accessible via aria-label', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} />);
    expect(screen.getByLabelText('Search recipes')).toBeInTheDocument();
  });

  it('Search button is accessible by role and name', () => {
    render(<SearchBar onSearch={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });
});
