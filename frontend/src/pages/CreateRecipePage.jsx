import { useNavigate, Link } from 'react-router-dom';
import RecipeForm from '../components/RecipeForm';
import { createRecipe } from '../api/recipesApi';

export default function CreateRecipePage() {
  const navigate = useNavigate();

  const handleSubmit = async (formData) => {
    await createRecipe(formData);
    navigate('/recipes');
  };

  return (
    <div className="page max-w-3xl">
      <Link to="/recipes" className="text-terracotta-500 hover:text-terracotta-600 text-sm font-medium no-underline transition-colors">
        ← My Recipes
      </Link>
      <h2 className="text-sage-900 text-2xl font-bold mt-3 mb-6">New Recipe</h2>
      <RecipeForm onSubmit={handleSubmit} submitLabel="Create Recipe" />
    </div>
  );
}
