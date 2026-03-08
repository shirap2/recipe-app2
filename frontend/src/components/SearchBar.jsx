import { useState } from 'react';

/**
 * Search input form. Calls onSearch(trimmedQuery) on submit,
 * calls onClear() on clear or empty submit.
 * Does not fetch data or read the URL — the parent owns those concerns.
 *
 * @param {{ onSearch: (query: string) => void, onClear: () => void, initialValue?: string, placeholder?: string, isSearching?: boolean }} props
 * @returns {JSX.Element}
 */
export default function SearchBar({
  onSearch,
  onClear,
  initialValue = '',
  placeholder = 'Search by title or tag\u2026',
  isSearching = false,
}) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e) {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    } else {
      onClear();
    }
  }

  function handleClear() {
    setValue('');
    onClear();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="search"
        aria-label="Search recipes"
        className="input max-w-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <button type="submit" className="btn-secondary">Search</button>
      {isSearching && (
        <button type="button" onClick={handleClear} className="btn-ghost">
          Clear
        </button>
      )}
    </form>
  );
}
