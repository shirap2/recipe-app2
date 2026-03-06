import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllRecipes, searchRecipes } from '../api/recipesApi';
import RecipeCard from '../components/RecipeCard';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getAllRecipes()
      .then(setRecipes)
      .catch(() => setError('Failed to load recipes.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) {
      setSearching(false);
      setLoading(true);
      const data = await getAllRecipes();
      setRecipes(data);
      setLoading(false);
      return;
    }
    setSearching(true);
    setLoading(true);
    try {
      const data = await searchRecipes(search.trim());
      setRecipes(data);
    } catch {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setSearch('');
    setSearching(false);
    setLoading(true);
    const data = await getAllRecipes();
    setRecipes(data);
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.heading}>My Recipes</h2>
        <Link to="/recipes/new" style={styles.newBtn}>+ New Recipe</Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={styles.searchRow}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or tag..."
          style={styles.searchInput}
        />
        <button type="submit" style={styles.searchBtn}>Search</button>
        {searching && <button type="button" onClick={handleClear} style={styles.clearBtn}>Clear</button>}
      </form>

      {loading && <p style={styles.status}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && recipes.length === 0 && (
        <div style={styles.empty}>
          <p>{searching ? 'No recipes match your search.' : 'No recipes yet.'}</p>
          {!searching && <Link to="/recipes/new" style={styles.newBtn}>Create your first recipe</Link>}
        </div>
      )}

      <div style={styles.grid}>
        {recipes.map(r => <RecipeCard key={r._id} recipe={r} />)}
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 24px', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  heading: { margin: 0, fontSize: 24, color: '#0f172a' },
  newBtn: { background: '#2563eb', color: '#fff', padding: '8px 18px', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600 },
  searchRow: { display: 'flex', gap: 8, marginBottom: 24 },
  searchInput: { flex: 1, padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6 },
  searchBtn: { padding: '9px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  clearBtn: { padding: '9px 14px', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#6b7280' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  status: { color: '#64748b' },
  error: { color: '#dc2626' },
  empty: { textAlign: 'center', padding: '48px 0', color: '#64748b' },
};
