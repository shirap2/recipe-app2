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

  if (error) return <div style={styles.page}><p style={{ color: '#dc2626' }}>{error}</p></div>;
  if (!initialData) return <div style={styles.page}><p>Loading...</p></div>;

  return (
    <div style={styles.page}>
      <Link to={`/recipes/${id}`} style={styles.back}>← Back to Recipe</Link>
      <h2 style={styles.heading}>Edit Recipe</h2>
      <RecipeForm initialData={initialData} onSubmit={handleSubmit} submitLabel="Update Recipe" />
    </div>
  );
}

const styles = {
  page: { maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: 'sans-serif' },
  back: { color: '#2563eb', textDecoration: 'none', fontSize: 14 },
  heading: { margin: '12px 0 24px', fontSize: 24, color: '#0f172a' },
};
