import { Link } from 'react-router-dom';

const DIFFICULTY_COLOR = { Easy: '#16a34a', Medium: '#d97706', Hard: '#dc2626' };

export default function RecipeCard({ recipe }) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <Link to={`/recipes/${recipe._id}`} style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>{recipe.title}</h3>
        <span style={{ ...styles.badge, color: DIFFICULTY_COLOR[recipe.difficulty] || '#64748b' }}>
          {recipe.difficulty}
        </span>
      </div>

      {totalTime > 0 && (
        <p style={styles.meta}>
          {recipe.prepTime ? `Prep ${recipe.prepTime}m` : ''}
          {recipe.prepTime && recipe.cookTime ? ' · ' : ''}
          {recipe.cookTime ? `Cook ${recipe.cookTime}m` : ''}
          {totalTime ? ` · ${totalTime}m total` : ''}
        </p>
      )}

      {recipe.tags?.length > 0 && (
        <div style={styles.tags}>
          {recipe.tags.slice(0, 4).map((tag) => (
            <span key={tag} style={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      {recipe.ingredients?.length > 0 && (
        <p style={styles.ingredientCount}>{recipe.ingredients.length} ingredients</p>
      )}
    </Link>
  );
}

const styles = {
  card: {
    display: 'block', textDecoration: 'none', color: 'inherit',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: 20, transition: 'box-shadow 0.15s',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { margin: 0, fontSize: 17, fontWeight: 600, color: '#0f172a' },
  badge: { fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  meta: { margin: '8px 0 0', fontSize: 13, color: '#64748b' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    background: '#f1f5f9', color: '#475569', fontSize: 12,
    padding: '2px 8px', borderRadius: 12,
  },
  ingredientCount: { margin: '8px 0 0', fontSize: 12, color: '#94a3b8' },
};
