import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import RecipeForm from '../components/RecipeForm';
import { getRecipeById, updateRecipe } from '../api/recipesApi';

export default function EditRecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRecipeById(id)
      .then(setInitialData)
      .catch(() => setError('Recipe not found.'));
  }, [id]);

  const handleSubmit = async (formData) => {
    await updateRecipe(id, formData);
    navigate(`/recipes/${id}`);
  };

  if (error)        return <div className="page"><p className="text-terracotta-600">{error}</p></div>;
  if (!initialData) return <div className="page"><p className="text-sage-500">Loading…</p></div>;

  return (
    <div className="page max-w-3xl">
      <Link to={`/recipes/${id}`} className="text-terracotta-500 hover:text-terracotta-600 text-sm font-medium no-underline transition-colors">
        ← Back to Recipe
      </Link>
      <h2 className="text-sage-900 text-2xl font-bold mt-3 mb-6">Edit Recipe</h2>
      <RecipeForm initialData={initialData} onSubmit={handleSubmit} submitLabel="Update Recipe" />
    </div>
  );
}
