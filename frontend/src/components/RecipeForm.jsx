import { useState } from 'react';

const EMPTY_INGREDIENT = { name: '', amount: '', unit: '' };

// Convert server data → form state
function toFormState(data) {
  return {
    title: data?.title || '',
    ingredients: data?.ingredients?.length ? data.ingredients.map(i => ({ ...i, amount: String(i.amount) })) : [{ ...EMPTY_INGREDIENT }],
    instructions: data?.instructions?.length ? [...data.instructions] : [''],
    prepTime: data?.prepTime ?? '',
    cookTime: data?.cookTime ?? '',
    servings: data?.servings ?? '',
    tags: data?.tags?.join(', ') || '',
    notes: data?.notes || '',
    difficulty: data?.difficulty || 'Medium',
  };
}

// Convert form state → API payload
function toPayload(form) {
  return {
    title: form.title.trim(),
    ingredients: form.ingredients
      .filter(i => i.name.trim())
      .map(i => ({ name: i.name.trim(), amount: Number(i.amount), unit: i.unit.trim() })),
    instructions: form.instructions.filter(i => i.trim()),
    prepTime: form.prepTime !== '' ? Number(form.prepTime) : undefined,
    cookTime: form.cookTime !== '' ? Number(form.cookTime) : undefined,
    servings: form.servings !== '' ? Number(form.servings) : undefined,
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    notes: form.notes.trim(),
    difficulty: form.difficulty,
  };
}

export default function RecipeForm({ initialData, onSubmit, submitLabel = 'Save Recipe' }) {
  const [form, setForm] = useState(() => toFormState(initialData));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Simple field ---
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // --- Ingredients ---
  const setIngredient = (index, field, value) => {
    setForm(f => {
      const ingredients = [...f.ingredients];
      ingredients[index] = { ...ingredients[index], [field]: value };
      return { ...f, ingredients };
    });
  };
  const addIngredient = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { ...EMPTY_INGREDIENT }] }));
  const removeIngredient = (index) => setForm(f => ({
    ...f, ingredients: f.ingredients.filter((_, i) => i !== index),
  }));

  // --- Instructions ---
  const setInstruction = (index, value) => {
    setForm(f => {
      const instructions = [...f.instructions];
      instructions[index] = value;
      return { ...f, instructions };
    });
  };
  const addInstruction = () => setForm(f => ({ ...f, instructions: [...f.instructions, ''] }));
  const removeInstruction = (index) => setForm(f => ({
    ...f, instructions: f.instructions.filter((_, i) => i !== index),
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(toPayload(form));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save recipe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {/* Title */}
      <label style={styles.label}>Title *</label>
      <input
        value={form.title}
        onChange={e => set('title', e.target.value)}
        style={styles.input}
        required
        minLength={3}
        placeholder="e.g. Classic Pasta Carbonara"
      />

      {/* Difficulty */}
      <label style={styles.label}>Difficulty</label>
      <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)} style={styles.input}>
        <option>Easy</option>
        <option>Medium</option>
        <option>Hard</option>
      </select>

      {/* Times + Servings */}
      <div style={styles.row}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Prep Time (min)</label>
          <input type="number" min="0" value={form.prepTime} onChange={e => set('prepTime', e.target.value)} style={styles.input} placeholder="15" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Cook Time (min)</label>
          <input type="number" min="0" value={form.cookTime} onChange={e => set('cookTime', e.target.value)} style={styles.input} placeholder="30" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Servings</label>
          <input type="number" min="1" value={form.servings} onChange={e => set('servings', e.target.value)} style={styles.input} placeholder="4" />
        </div>
      </div>

      {/* Ingredients */}
      <label style={styles.label}>Ingredients *</label>
      {form.ingredients.map((ing, i) => (
        <div key={i} style={styles.ingredientRow}>
          <input
            placeholder="Name"
            value={ing.name}
            onChange={e => setIngredient(i, 'name', e.target.value)}
            style={{ ...styles.input, flex: 2 }}
            required
          />
          <input
            placeholder="Amount"
            type="number"
            min="0"
            step="any"
            value={ing.amount}
            onChange={e => setIngredient(i, 'amount', e.target.value)}
            style={{ ...styles.input, flex: 1 }}
            required
          />
          <input
            placeholder="Unit (e.g. g, cup)"
            value={ing.unit}
            onChange={e => setIngredient(i, 'unit', e.target.value)}
            style={{ ...styles.input, flex: 1 }}
            required
          />
          {form.ingredients.length > 1 && (
            <button type="button" onClick={() => removeIngredient(i)} style={styles.removeBtn}>✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addIngredient} style={styles.addBtn}>+ Add Ingredient</button>

      {/* Instructions */}
      <label style={styles.label}>Instructions</label>
      {form.instructions.map((step, i) => (
        <div key={i} style={styles.instructionRow}>
          <span style={styles.stepNum}>{i + 1}</span>
          <textarea
            value={step}
            onChange={e => setInstruction(i, e.target.value)}
            placeholder={`Step ${i + 1}`}
            style={{ ...styles.input, flex: 1, resize: 'vertical', minHeight: 60 }}
          />
          {form.instructions.length > 1 && (
            <button type="button" onClick={() => removeInstruction(i)} style={styles.removeBtn}>✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addInstruction} style={styles.addBtn}>+ Add Step</button>

      {/* Tags */}
      <label style={styles.label}>Tags <span style={styles.hint}>(comma-separated)</span></label>
      <input
        value={form.tags}
        onChange={e => set('tags', e.target.value)}
        style={styles.input}
        placeholder="italian, pasta, quick"
      />

      {/* Notes */}
      <label style={styles.label}>Notes</label>
      <textarea
        value={form.notes}
        onChange={e => set('notes', e.target.value)}
        style={{ ...styles.input, resize: 'vertical', minHeight: 80 }}
        placeholder="Any extra tips or variations..."
      />

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={loading} style={styles.submitBtn}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 },
  label: { fontWeight: 600, fontSize: 14, color: '#374151', marginTop: 8 },
  hint: { fontWeight: 400, color: '#9ca3af', fontSize: 13 },
  input: { padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box' },
  row: { display: 'flex', gap: 12 },
  ingredientRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 },
  instructionRow: { display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  stepNum: { width: 24, minWidth: 24, textAlign: 'center', fontWeight: 700, color: '#6b7280', paddingTop: 10, fontSize: 13 },
  addBtn: { alignSelf: 'flex-start', background: 'none', border: '1px dashed #d1d5db', color: '#6b7280', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px' },
  submitBtn: { marginTop: 16, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, cursor: 'pointer', alignSelf: 'flex-start' },
  error: { color: '#dc2626', fontSize: 14, margin: '4px 0' },
};
