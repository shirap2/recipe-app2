import { Link } from 'react-router-dom';

const DIFFICULTY_STYLES = {
  Easy:   'bg-sage-100 text-sage-700',
  Medium: 'bg-cream-200 text-terracotta-600',
  Hard:   'bg-terracotta-100 text-terracotta-700',
};

export default function RecipeCard({ recipe }) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <Link
      to={`/recipes/${recipe._id}`}
      className="card block no-underline p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-3 mb-2">
        <h3 className="text-sage-900 font-semibold text-base leading-snug group-hover:text-terracotta-600 transition-colors m-0">
          {recipe.title}
        </h3>
        {recipe.difficulty && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap ${DIFFICULTY_STYLES[recipe.difficulty] || 'bg-cream-100 text-sage-600'}`}>
            {recipe.difficulty}
          </span>
        )}
      </div>

      {/* Time meta */}
      {totalTime > 0 && (
        <p className="text-sage-500 text-xs mt-1 mb-0">
          {recipe.prepTime ? `Prep ${recipe.prepTime}m` : ''}
          {recipe.prepTime && recipe.cookTime ? ' · ' : ''}
          {recipe.cookTime ? `Cook ${recipe.cookTime}m` : ''}
          {totalTime ? ` · ${totalTime}m total` : ''}
        </p>
      )}

      {/* Tags */}
      {recipe.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {recipe.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="bg-cream-100 text-sage-600 text-xs px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredient count */}
      {recipe.ingredients?.length > 0 && (
        <p className="text-sage-400 text-xs mt-2 mb-0">
          {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
        </p>
      )}
    </Link>
  );
}
