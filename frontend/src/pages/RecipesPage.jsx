import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getAllRecipes, searchRecipes } from '../api/recipesApi';

import CategoryFilter from '../components/CategoryFilter';
import RecipeCard from '../components/RecipeCard';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const q        = searchParams.get('q')        ?? '';
  const sort     = searchParams.get('sort')     ?? 'createdAt';
  const order    = searchParams.get('order')    ?? 'desc';
  const category = searchParams.get('category');

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      setError('');
      try {
        const data = q ? await searchRecipes(q) : await getAllRecipes(category || null);
        if (!cancelled) setRecipes(data);
      } catch {
        if (!cancelled) setError('Failed to load recipes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [q, category]);

  const handleSearch = (query) =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('q', query);
      return p;
    });

  const handleClear = () =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('q');
      return p;
    });

  const handleSortChange = (newSort, newOrder) =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('sort', newSort);
      p.set('order', newOrder);
      return p;
    });

  const handleCategoryChange = (cat) =>
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (cat) { p.set('category', cat); } else { p.delete('category'); }
      return p;
    });

  const sorted = [...recipes].sort((a, b) => {
    const aVal = a[sort] ?? '';
    const bVal = b[sort] ?? '';
    if (typeof aVal === 'string') {
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return order === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return (
    <div className="page">

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sage-900 text-2xl m-0">My Recipes</h2>
        <Link to="/recipes/new" className="btn-primary no-underline">
          + New Recipe
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClear}
          initialValue={q}
          isSearching={!!q}
        />
        <SortControls
          sort={sort}
          order={order}
          onChange={handleSortChange}
        />
      </div>

      <CategoryFilter value={category} onChange={handleCategoryChange} />

      {loading && <p className="text-sage-500">Loading…</p>}
      {error   && <p className="text-terracotta-600">{error}</p>}

      {!loading && !error && sorted.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sage-500 text-base mb-4">
            {!!q
              ? 'No recipes match your search.'
              : category
              ? 'No recipes in this category.'
              : 'You haven\'t added any recipes yet.'}
          </p>
          {!q && !category && (
            <Link to="/recipes/new" className="btn-primary no-underline">
              Create your first recipe
            </Link>
          )}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((r) => <RecipeCard key={r._id} recipe={r} />)}
        </div>
      )}
    </div>
  );
}
