import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../api/recipesApi');
import * as recipesApi from '../../api/recipesApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../components/RecipeForm', () => ({
  default: ({ onSubmit, submitLabel, initialData }) => {
    const [error, setError] = React.useState('');
    return (
      <form
        data-testid="recipe-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSubmit({ title: 'Updated Title', ingredients: [], instructions: [] });
          } catch (err) {
            setError(err.response?.data?.message || 'Failed to save recipe.');
          }
        }}
      >
        {initialData && <input data-testid="initial-title" defaultValue={initialData.title} />}
        <button type="submit">{submitLabel}</button>
        {error && <p data-testid="form-error">{error}</p>}
      </form>
    );
  },
}));

import EditRecipePage from '../EditRecipePage';

const fullRecipe = {
  _id: 'abc123',
  title: 'Classic Pasta Carbonara',
  category: 'Dinner',
  difficulty: 'Medium',
  ingredients: [{ name: 'Spaghetti', amount: 200, unit: 'g' }],
  instructions: ['Boil pasta.'],
  tags: [],
  createdAt: '2026-02-15T00:00:00.000Z',
};

function renderPage(id = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/recipes/${id}/edit`]}>
      <Routes>
        <Route path="/recipes/:id/edit" element={<EditRecipePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EditRecipePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('renders without crashing (smoke test)', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /edit recipe/i })).toBeInTheDocument());
  });

  it('shows loading state before data arrives', () => {
    recipesApi.getRecipeById.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('loading indicator disappears after data loads', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  });

  it('getRecipeById is called with the URL param id', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage('abc123');
    await waitFor(() => expect(recipesApi.getRecipeById).toHaveBeenCalledWith('abc123'));
  });

  it('RecipeForm receives initialData from API response', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('initial-title')).toHaveValue('Classic Pasta Carbonara'));
  });

  it('RecipeForm receives submitLabel="Update Recipe"', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /update recipe/i })).toBeInTheDocument());
  });

  it('"← Back to Recipe" link points to /recipes/:id', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: /edit recipe/i }));
    expect(screen.getByRole('link', { name: /← back to recipe/i })).toHaveAttribute('href', '/recipes/abc123');
  });

  it('successful submit calls updateRecipe and navigates to /recipes/:id', async () => {
    const user = userEvent.setup();
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    recipesApi.updateRecipe.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /update recipe/i }));
    await user.click(screen.getByRole('button', { name: /update recipe/i }));
    await waitFor(() => expect(recipesApi.updateRecipe).toHaveBeenCalledWith('abc123', { title: 'Updated Title', ingredients: [], instructions: [] }));
    expect(mockNavigate).toHaveBeenCalledWith('/recipes/abc123');
  });

  it('updateRecipe API failure — error shown in RecipeForm', async () => {
    const user = userEvent.setup();
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    recipesApi.updateRecipe.mockRejectedValue({ response: { data: { message: 'Validation failed' } } });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /update recipe/i }));
    await user.click(screen.getByRole('button', { name: /update recipe/i }));
    await waitFor(() => expect(screen.getByTestId('form-error')).toHaveTextContent('Validation failed'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('getRecipeById failure — shows error state, no form', async () => {
    recipesApi.getRecipeById.mockRejectedValue(new Error('Not found'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Recipe not found.')).toBeInTheDocument());
    expect(screen.queryByTestId('recipe-form')).toBeNull();
  });

  it('navigate is NOT called after a failed getRecipeById', async () => {
    recipesApi.getRecipeById.mockRejectedValue(new Error('Not found'));
    renderPage();
    await waitFor(() => screen.getByText('Recipe not found.'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('page heading is "Edit Recipe" not "New Recipe"', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit Recipe' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /new recipe/i })).toBeNull();
  });
});
