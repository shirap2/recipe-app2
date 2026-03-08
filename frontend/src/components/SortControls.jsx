export default function SortControls({ sort = 'createdAt', order = 'desc', onChange }) {
  function handleFieldChange(e) {
    onChange(e.target.value, order);
  }

  function handleOrderChange(e) {
    onChange(sort, e.target.value);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-sage-600 whitespace-nowrap">Sort by</span>
      <select
        aria-label="Sort by"
        value={sort}
        onChange={handleFieldChange}
        className="input w-36"
      >
        <option value="createdAt">Date added</option>
        <option value="title">Title</option>
        <option value="prepTime">Prep time</option>
        <option value="cookTime">Cook time</option>
      </select>
      <select
        aria-label="Sort order"
        value={order}
        onChange={handleOrderChange}
        className="input w-36"
      >
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
    </div>
  );
}
