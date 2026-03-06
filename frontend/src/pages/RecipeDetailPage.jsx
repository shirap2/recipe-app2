import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecipeById, deleteRecipe } from '../api/recipesApi';

const DIFFICULTY_COLOR = { Easy: '#16a34a', Medium: '#d97706', Hard: '#dc2626' };

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getRecipeById(id)
      .then(setRecipe)
      .catch(() => setError('Recipe not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return;
    try {
      await deleteRecipe(id);
      navigate('/recipes');
    } catch {
      setError('Failed to delete recipe.');
    }
  };

  if (loading) return <div style={styles.page}><p>Loading...</p></div>;
  if (error) return <div style={styles.page}><p style={styles.error}>{error}</p><Link to="/recipes">← Back</Link></div>;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <Link to="/recipes" style={styles.back}>← My Recipes</Link>
        <div style={styles.actions}>
          <Link to={`/recipes/${id}/edit`} style={styles.editBtn}>Edit</Link>
          <button onClick={handleDelete} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      <h1 style={styles.title}>{recipe.title}</h1>

      {/* Meta row */}
      <div style={styles.metaRow}>
        {recipe.difficulty && (
          <span style={{ ...styles.badge, color: DIFFICULTY_COLOR[recipe.difficulty] || '#64748b' }}>
            {recipe.difficulty}
          </span>
        )}
        {recipe.prepTime && <span style={styles.meta}>Prep: {recipe.prepTime}m</span>}
        {recipe.cookTime && <span style={styles.meta}>Cook: {recipe.cookTime}m</span>}
        {(recipe.prepTime || recipe.cookTime) && (
          <span style={styles.meta}>Total: {(recipe.prepTime || 0) + (recipe.cookTime || 0)}m</span>
        )}
        {recipe.servings && <span style={styles.meta}>{recipe.servings} servings</span>}
      </div>

      {/* Tags */}
      {recipe.tags?.length > 0 && (
        <div style={styles.tags}>
          {recipe.tags.map(t => <span key={t} style={styles.tag}>{t}</span>)}
        </div>
      )}

      <div style={styles.body}>
        {/* Ingredients */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Ingredients</h2>
          {recipe.ingredients?.length > 0 ? (
            <ul style={styles.ingredientList}>
              {recipe.ingredients.map((ing, i) => (
                <li key={i} style={styles.ingredientItem}>
                  <span style={styles.amount}>{ing.amount} {ing.unit}</span>
                  <span>{ing.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.empty}>No ingredients listed.</p>
          )}
        </section>

        {/* Instructions */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Instructions</h2>
          {recipe.instructions?.length > 0 ? (
            <ol style={styles.instructionList}>
              {recipe.instructions.map((step, i) => (
                <li key={i} style={styles.instructionItem}>{step}</li>
              ))}
            </ol>
          ) : (
            <p style={styles.empty}>No instructions listed.</p>
          )}
        </section>
      </div>

      {/* Notes */}
      {recipe.notes && (
        <section style={{ ...styles.section, marginTop: 16 }}>
          <h2 style={styles.sectionTitle}>Notes</h2>
          <p style={styles.notes}>{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 800, margin: '0 auto', padding: '32px 24px', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  back: { color: '#2563eb', textDecoration: 'none', fontSize: 14 },
  actions: { display: 'flex', gap: 10 },
  editBtn: { padding: '6px 16px', background: '#f1f5f9', color: '#0f172a', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  deleteBtn: { padding: '6px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  title: { margin: '0 0 16px', fontSize: 30, color: '#0f172a' },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 12 },
  badge: { fontWeight: 700, fontSize: 14 },
  meta: { fontSize: 14, color: '#64748b' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 },
  tag: { background: '#f1f5f9', color: '#475569', fontSize: 12, padding: '3px 10px', borderRadius: 12 },
  body: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32, marginTop: 24 },
  section: {},
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 12, borderBottom: '2px solid #f1f5f9', paddingBottom: 6 },
  ingredientList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  ingredientItem: { display: 'flex', gap: 8, fontSize: 14, color: '#374151' },
  amount: { fontWeight: 600, minWidth: 80, color: '#0f172a' },
  instructionList: { paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  instructionItem: { fontSize: 15, color: '#374151', lineHeight: 1.6 },
  notes: { fontSize: 14, color: '#64748b', background: '#f8fafc', padding: '12px 16px', borderRadius: 8, lineHeight: 1.6 },
  empty: { color: '#9ca3af', fontSize: 14 },
  error: { color: '#dc2626' },
};
