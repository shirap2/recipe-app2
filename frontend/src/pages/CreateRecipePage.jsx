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
    <div style={styles.page}>
      <Link to="/recipes" style={styles.back}>← My Recipes</Link>
      <h2 style={styles.heading}>New Recipe</h2>
      <RecipeForm onSubmit={handleSubmit} submitLabel="Create Recipe" />
    </div>
  );
}

const styles = {
  page: { maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: 'sans-serif' },
  back: { color: '#2563eb', textDecoration: 'none', fontSize: 14 },
  heading: { margin: '12px 0 24px', fontSize: 24, color: '#0f172a' },
};
