import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RecipeForm, { toFormState, toPayload } from '../RecipeForm';

// ── baseForm fixture for toPayload tests ───────────────────────────────────
const baseForm = {
  title: 'Test',
  category: 'Dinner',
  difficulty: 'Medium',
  prepTime: '10',
  cookTime: '20',
  servings: '4',
  tags: '',
  notes: '',
  ingredients: [{ name: 'eggs', amount: '2', unit: 'pcs' }],
  instructions: ['Crack eggs'],
};

// ── toFormState unit tests ─────────────────────────────────────────────────
describe('toFormState', () => {
  it('undefined input returns defaults', () => {
    const result = toFormState(undefined);
    expect(result.title).toBe('');
    expect(result.category).toBe('Other');
    expect(result.difficulty).toBe('Medium');
    expect(result.prepTime).toBe('');
    expect(result.cookTime).toBe('');
    expect(result.servings).toBe('');
    expect(result.tags).toBe('');
    expect(result.notes).toBe('');
    expect(result.ingredients).toEqual([{ name: '', amount: '', unit: '' }]);
    expect(result.instructions).toEqual(['']);
  });

  it('maps title', () => {
    expect(toFormState({ title: 'Pasta' }).title).toBe('Pasta');
  });

  it('falls back to "Other" for category', () => {
    expect(toFormState({}).category).toBe('Other');
  });

  it('falls back to "Medium" for difficulty', () => {
    expect(toFormState({}).difficulty).toBe('Medium');
  });

  it('converts tags array to comma-separated string', () => {
    expect(toFormState({ tags: ['italian', 'pasta'] }).tags).toBe('italian, pasta');
  });

  it('empty tags array yields empty string', () => {
    expect(toFormState({ tags: [] }).tags).toBe('');
  });

  it('undefined tags yields empty string', () => {
    expect(toFormState({ tags: undefined }).tags).toBe('');
  });

  it('converts ingredient amount to string', () => {
    const result = toFormState({ ingredients: [{ name: 'eggs', amount: 2, unit: 'pcs' }] });
    expect(result.ingredients[0].amount).toBe('2');
  });

  it('ingredient amount of 0 becomes string "0"', () => {
    const result = toFormState({ ingredients: [{ name: 'salt', amount: 0, unit: 'g' }] });
    expect(result.ingredients[0].amount).toBe('0');
  });

  it('empty ingredients array yields one empty row', () => {
    const result = toFormState({ ingredients: [] });
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0]).toEqual({ name: '', amount: '', unit: '' });
  });

  it('empty instructions array yields one empty string', () => {
    const result = toFormState({ instructions: [] });
    expect(result.instructions).toHaveLength(1);
    expect(result.instructions[0]).toBe('');
  });

  it('preserves prepTime 0 as 0', () => {
    expect(toFormState({ prepTime: 0 }).prepTime).toBe(0);
  });

  it('undefined prepTime yields empty string', () => {
    expect(toFormState({}).prepTime).toBe('');
  });
});

// ── toPayload unit tests ───────────────────────────────────────────────────
describe('toPayload', () => {
  it('trims title whitespace', () => {
    expect(toPayload({ ...baseForm, title: '  Pasta  ' }).title).toBe('Pasta');
  });

  it('converts comma string to tags array', () => {
    expect(toPayload({ ...baseForm, tags: 'italian, pasta, quick' }).tags).toEqual(['italian', 'pasta', 'quick']);
  });

  it('trims whitespace from individual tags', () => {
    expect(toPayload({ ...baseForm, tags: '  soup , stew  ' }).tags).toEqual(['soup', 'stew']);
  });

  it('empty tags string yields empty array', () => {
    expect(toPayload({ ...baseForm, tags: '' }).tags).toEqual([]);
  });

  it('tags string with only commas yields empty array', () => {
    expect(toPayload({ ...baseForm, tags: ' , , ' }).tags).toEqual([]);
  });

  it('converts ingredient amount string to number', () => {
    const result = toPayload({ ...baseForm, ingredients: [{ name: 'eggs', amount: '2', unit: 'pcs' }] });
    expect(result.ingredients[0].amount).toBe(2);
    expect(typeof result.ingredients[0].amount).toBe('number');
  });

  it('ingredient amount "0" converts to number 0', () => {
    const result = toPayload({ ...baseForm, ingredients: [{ name: 'salt', amount: '0', unit: 'g' }] });
    expect(result.ingredients[0].amount).toBe(0);
  });

  it('filters out ingredients with blank name', () => {
    const result = toPayload({
      ...baseForm,
      ingredients: [{ name: '  ', amount: '1', unit: 'g' }, { name: 'eggs', amount: '2', unit: 'pcs' }],
    });
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0].name).toBe('eggs');
  });

  it('filters out blank instruction steps', () => {
    expect(toPayload({ ...baseForm, instructions: ['  ', 'Boil water', ''] }).instructions).toEqual(['Boil water']);
  });

  it('prepTime "" yields undefined', () => {
    expect(toPayload({ ...baseForm, prepTime: '' }).prepTime).toBeUndefined();
  });

  it('prepTime "15" converts to 15', () => {
    expect(toPayload({ ...baseForm, prepTime: '15' }).prepTime).toBe(15);
  });

  it('cookTime "" yields undefined', () => {
    expect(toPayload({ ...baseForm, cookTime: '' }).cookTime).toBeUndefined();
  });

  it('servings "" yields undefined', () => {
    expect(toPayload({ ...baseForm, servings: '' }).servings).toBeUndefined();
  });

  it('trims notes whitespace', () => {
    expect(toPayload({ ...baseForm, notes: '  tip  ' }).notes).toBe('tip');
  });

  it('preserves category and difficulty', () => {
    const result = toPayload({ ...baseForm, category: 'Lunch', difficulty: 'Hard' });
    expect(result.category).toBe('Lunch');
    expect(result.difficulty).toBe('Hard');
  });
});

// ── Rendered component tests ───────────────────────────────────────────────
describe('RecipeForm rendered', () => {
  it('renders without crashing', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(document.querySelector('form')).toBeInTheDocument();
  });

  it('renders title input', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('renders submit button with default label', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save recipe/i })).toBeInTheDocument();
  });

  it('renders submit button with custom label', () => {
    render(<RecipeForm onSubmit={vi.fn()} submitLabel="Create Recipe" />);
    expect(screen.getByRole('button', { name: /create recipe/i })).toBeInTheDocument();
  });

  it('pre-populates fields from initialData', () => {
    render(
      <RecipeForm
        onSubmit={vi.fn()}
        initialData={{ title: 'Pasta', category: 'Lunch', difficulty: 'Hard', tags: ['italian'], notes: 'tip' }}
      />
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue('Pasta');
    expect(screen.getByLabelText(/category/i)).toHaveValue('Lunch');
    expect(screen.getByLabelText(/difficulty/i)).toHaveValue('Hard');
    expect(screen.getByLabelText(/tags/i)).toHaveValue('italian');
    expect(screen.getByLabelText(/notes/i)).toHaveValue('tip');
  });

  it('Add Ingredient button adds a new ingredient row', async () => {
    const user = userEvent.setup();
    render(<RecipeForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /\+ add ingredient/i }));
    expect(screen.getAllByPlaceholderText('Name')).toHaveLength(2);
  });

  it('Add Step button adds a new instruction textarea', async () => {
    const user = userEvent.setup();
    render(<RecipeForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /\+ add step/i }));
    expect(screen.getAllByPlaceholderText(/step/i)).toHaveLength(2);
  });

  it('submit calls onSubmit with correct payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Carbonara');
    await user.click(screen.getByRole('button', { name: /save recipe/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].title).toBe('Carbonara');
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise(() => {}));
    render(<RecipeForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/title/i), 'Test Recipe');
    await user.click(screen.getByRole('button', { name: /save recipe/i }));
    expect(screen.getByRole('button', { name: /saving…/i })).toBeDisabled();
  });

  it('shows error message on submit failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({ response: { data: { message: 'Title already taken.' } } });
    render(<RecipeForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/title/i), 'Test');
    await user.click(screen.getByRole('button', { name: /save recipe/i }));
    await waitFor(() => expect(screen.getByText('Title already taken.')).toBeInTheDocument());
  });

  it('shows generic error when no response message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('network'));
    render(<RecipeForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/title/i), 'Test');
    await user.click(screen.getByRole('button', { name: /save recipe/i }));
    await waitFor(() => expect(screen.getByText('Failed to save recipe.')).toBeInTheDocument());
  });

  it('accessibility: title input has accessible label', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('accessibility: category select has accessible label', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
  });

  it('accessibility: difficulty select has accessible label', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/difficulty/i)).toBeInTheDocument();
  });

  it('accessibility: tags input has accessible label', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
  });

  it('accessibility: notes textarea has accessible label', () => {
    render(<RecipeForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });
});
