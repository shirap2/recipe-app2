import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecipeById, deleteRecipe } from '../api/recipesApi';
import ConfirmDialog from '../components/ConfirmDialog';

const DIFFICULTY_STYLES = {
  Easy:   'bg-sage-100 text-sage-700',
  Medium: 'bg-cream-200 text-terracotta-600',
  Hard:   'bg-terracotta-100 text-terracotta-700',
};

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    getRecipeById(id)
      .then(setRecipe)
      .catch(() => setError('Recipe not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    try {
      await deleteRecipe(id);
      navigate('/recipes');
    } catch {
      setError('Failed to delete recipe.');
    }
  };

  if (loading) return <div className="page"><p className="text-sage-500">Loading…</p></div>;
  if (error)   return (
    <div className="page">
      <p className="text-terracotta-600 mb-4">{error}</p>
      <Link to="/recipes" className="text-terracotta-500 hover:underline text-sm">← My Recipes</Link>
    </div>
  );

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div className="page max-w-3xl">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/recipes" className="text-terracotta-500 hover:text-terracotta-600 text-sm font-medium no-underline transition-colors">
          ← My Recipes
        </Link>
        <div className="flex gap-2">
          <Link to={`/recipes/${id}/edit`} className="btn-secondary no-underline">Edit</Link>
          <ConfirmDialog
            triggerLabel="Delete"
            message={`Delete "${recipe.title}"? This cannot be undone.`}
            onConfirm={handleDelete}
          />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-sage-900 text-3xl font-bold mb-4">{recipe.title}</h1>

      {/* Meta pills */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {recipe.difficulty && (
          <span className={`text-xs font-bold px-3 py-1 rounded ${DIFFICULTY_STYLES[recipe.difficulty] || 'bg-cream-100 text-sage-600'}`}>
            {recipe.difficulty}
          </span>
        )}
        {recipe.prepTime  && <span className="text-sage-500 text-sm">Prep {recipe.prepTime}m</span>}
        {recipe.cookTime  && <span className="text-sage-500 text-sm">Cook {recipe.cookTime}m</span>}
        {totalTime > 0    && <span className="text-sage-500 text-sm font-semibold">{totalTime}m total</span>}
        {recipe.servings  && <span className="text-sage-500 text-sm">{recipe.servings} servings</span>}
      </div>

      {/* Tags */}
      {recipe.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.tags.map(t => (
            <span key={t} className="bg-cream-100 text-sage-600 text-xs px-3 py-1 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Body: ingredients + instructions */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 mt-2">

        {/* Ingredients */}
        <div className="card p-5">
          <h2 className="text-sage-800 text-base font-bold mb-4 pb-2 border-b border-cream-200">
            Ingredients
          </h2>
          {recipe.ingredients?.length > 0 ? (
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold text-sage-900 min-w-[72px]">
                    {ing.amount} {ing.unit}
                  </span>
                  <span className="text-sage-600">{ing.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sage-400 text-sm">No ingredients listed.</p>
          )}
        </div>

        {/* Instructions */}
        <div>
          <h2 className="text-sage-800 text-base font-bold mb-4 pb-2 border-b border-cream-200">
            Instructions
          </h2>
          {recipe.instructions?.length > 0 ? (
            <ol className="list-none p-0 m-0 flex flex-col gap-4">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="bg-terracotta-500 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sage-700 text-sm leading-relaxed m-0">{step}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sage-400 text-sm">No instructions listed.</p>
          )}
        </div>
      </div>

      {/* Notes */}
      {recipe.notes && (
        <div className="mt-8 bg-cream-100 border border-cream-200 rounded-lg px-5 py-4">
          <h2 className="text-sage-700 text-sm font-bold mb-2">Notes</h2>
          <p className="text-sage-600 text-sm leading-relaxed m-0">{recipe.notes}</p>
        </div>
      )}
    </div>
  );
}
