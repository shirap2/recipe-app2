import { useState } from 'react';

const EMPTY_INGREDIENT = { name: '', amount: '', unit: '' };

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other'];

function toFormState(data) {
  return {
    title: data?.title || '',
    category:   data?.category   || 'Other',
    ingredients: data?.ingredients?.length
      ? data.ingredients.map(i => ({ ...i, amount: String(i.amount) }))
      : [{ ...EMPTY_INGREDIENT }],
    instructions: data?.instructions?.length ? [...data.instructions] : [''],
    prepTime:   data?.prepTime   ?? '',
    cookTime:   data?.cookTime   ?? '',
    servings:   data?.servings   ?? '',
    tags:       data?.tags?.join(', ') || '',
    notes:      data?.notes      || '',
    difficulty: data?.difficulty || 'Medium',
  };
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    ingredients: form.ingredients
      .filter(i => i.name.trim())
      .map(i => ({ name: i.name.trim(), amount: Number(i.amount), unit: i.unit.trim() })),
    instructions: form.instructions.filter(i => i.trim()),
    prepTime:  form.prepTime  !== '' ? Number(form.prepTime)  : undefined,
    cookTime:  form.cookTime  !== '' ? Number(form.cookTime)  : undefined,
    servings:  form.servings  !== '' ? Number(form.servings)  : undefined,
    tags:      form.tags.split(',').map(t => t.trim()).filter(Boolean),
    notes:     form.notes.trim(),
    difficulty: form.difficulty,
    category:   form.category,
  };
}

export default function RecipeForm({ initialData, onSubmit, submitLabel = 'Save Recipe' }) {
  const [form, setForm]     = useState(() => toFormState(initialData));
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  /* Ingredients */
  const setIngredient = (i, field, value) =>
    setForm(f => { const a = [...f.ingredients]; a[i] = { ...a[i], [field]: value }; return { ...f, ingredients: a }; });
  const addIngredient    = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { ...EMPTY_INGREDIENT }] }));
  const removeIngredient = i  => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, j) => j !== i) }));

  /* Instructions */
  const setInstruction  = (i, v) =>
    setForm(f => { const a = [...f.instructions]; a[i] = v; return { ...f, instructions: a }; });
  const addInstruction    = () => setForm(f => ({ ...f, instructions: [...f.instructions, ''] }));
  const removeInstruction = i  => setForm(f => ({ ...f, instructions: f.instructions.filter((_, j) => j !== i) }));

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">

      {/* Title */}
      <div>
        <label className="field-label">Title *</label>
        <input
          className="input"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          required minLength={3}
          placeholder="e.g. Classic Pasta Carbonara"
        />
      </div>

      {/* Category */}
      <div>
        <label className="field-label">Category</label>
        <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Difficulty */}
      <div>
        <label className="field-label">Difficulty</label>
        <select className="input" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
      </div>

      {/* Times + Servings */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="field-label">Prep Time (min)</label>
          <input className="input" type="number" min="0" placeholder="15"
            value={form.prepTime} onChange={e => set('prepTime', e.target.value)} />
        </div>
        <div>
          <label className="field-label">Cook Time (min)</label>
          <input className="input" type="number" min="0" placeholder="30"
            value={form.cookTime} onChange={e => set('cookTime', e.target.value)} />
        </div>
        <div>
          <label className="field-label">Servings</label>
          <input className="input" type="number" min="1" placeholder="4"
            value={form.servings} onChange={e => set('servings', e.target.value)} />
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <label className="field-label">Ingredients *</label>
        <div className="flex flex-col gap-2">
          {form.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input flex-[2]" placeholder="Name" required
                value={ing.name} onChange={e => setIngredient(i, 'name', e.target.value)} />
              <input className="input flex-1" type="number" min="0" step="any" placeholder="Amount" required
                value={ing.amount} onChange={e => setIngredient(i, 'amount', e.target.value)} />
              <input className="input flex-1" placeholder="Unit (g, cup…)" required
                value={ing.unit} onChange={e => setIngredient(i, 'unit', e.target.value)} />
              {form.ingredients.length > 1 && (
                <button type="button" onClick={() => removeIngredient(i)}
                  className="text-terracotta-400 hover:text-terracotta-600 text-lg leading-none cursor-pointer border-0 bg-transparent p-1 transition-colors">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addIngredient}
          className="mt-2 border border-dashed border-cream-300 hover:border-sage-400 text-sage-500 hover:text-sage-700 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer bg-transparent">
          + Add Ingredient
        </button>
      </div>

      {/* Instructions */}
      <div>
        <label className="field-label">Instructions</label>
        <div className="flex flex-col gap-2">
          {form.instructions.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-sage-400 font-bold text-xs pt-2.5 w-5 text-center shrink-0">{i + 1}</span>
              <textarea className="input resize-y min-h-[56px] flex-1" placeholder={`Step ${i + 1}…`}
                value={step} onChange={e => setInstruction(i, e.target.value)} />
              {form.instructions.length > 1 && (
                <button type="button" onClick={() => removeInstruction(i)}
                  className="text-terracotta-400 hover:text-terracotta-600 text-lg leading-none cursor-pointer border-0 bg-transparent p-1 pt-2 transition-colors">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addInstruction}
          className="mt-2 border border-dashed border-cream-300 hover:border-sage-400 text-sage-500 hover:text-sage-700 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer bg-transparent">
          + Add Step
        </button>
      </div>

      {/* Tags */}
      <div>
        <label className="field-label">
          Tags <span className="text-sage-400 font-normal">(comma-separated)</span>
        </label>
        <input className="input" placeholder="italian, pasta, quick"
          value={form.tags} onChange={e => set('tags', e.target.value)} />
      </div>

      {/* Notes */}
      <div>
        <label className="field-label">Notes</label>
        <textarea className="input resize-y min-h-[80px]" placeholder="Any extra tips or variations…"
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-terracotta-600 text-sm">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary self-start mt-2">
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
