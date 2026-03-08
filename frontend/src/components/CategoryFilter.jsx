const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other'];

export default function CategoryFilter({ value, onChange }) {
  return (
    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2 mb-6">
      <button
        type="button"
        aria-pressed={value === null}
        className={value === null ? 'filter-pill-active' : 'filter-pill'}
        onClick={() => onChange(null)}
      >
        All
      </button>

      {CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={value === category}
          className={value === category ? 'filter-pill-active' : 'filter-pill'}
          onClick={() => onChange(value === category ? null : category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
