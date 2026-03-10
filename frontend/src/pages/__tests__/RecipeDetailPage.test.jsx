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

import RecipeDetailPage from '../RecipeDetailPage';

const fullRecipe = {
  _id: 'abc123',
  title: 'Classic Pasta Carbonara',
  category: 'Dinner',
  difficulty: 'Medium',
  prepTime: 15,
  cookTime: 20,
  servings: 4,
  tags: ['italian', 'pasta', 'quick'],
  ingredients: [
    { name: 'Spaghetti', amount: 200, unit: 'g' },
    { name: 'Eggs', amount: 3, unit: '' },
  ],
  instructions: ['Boil pasta.', 'Mix eggs and cheese.', 'Combine.'],
  notes: 'Use guanciale for authenticity.',
  createdAt: '2026-02-15T00:00:00.000Z',
};

const minimalRecipe = {
  _id: 'abc123',
  title: 'Plain Toast',
  category: 'Breakfast',
  difficulty: 'Easy',
  ingredients: [],
  instructions: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage(id = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/recipes/${id}`]}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RecipeDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('renders without crashing (smoke test)', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Classic Pasta Carbonara' })).toBeInTheDocument());
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

  it('fully populated recipe — all fields rendered', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Prep 15m')).toBeInTheDocument();
    expect(screen.getByText('Cook 20m')).toBeInTheDocument();
    expect(screen.getByText('35m total')).toBeInTheDocument();
    expect(screen.getByText('4 servings')).toBeInTheDocument();
    expect(screen.getByText('italian')).toBeInTheDocument();
  });

  it('minimal recipe — optional fields absent', async () => {
    recipesApi.getRecipeById.mockResolvedValue(minimalRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Plain Toast'));
    expect(screen.queryByText(/prep/i)).toBeNull();
    expect(screen.queryByText(/cook/i)).toBeNull();
    expect(screen.queryByText(/total/i)).toBeNull();
    expect(screen.queryByText(/servings/i)).toBeNull();
  });

  it('recipe with no ingredients — fallback text shown', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    recipesApi.getRecipeById.mockResolvedValue({ ...fullRecipe, ingredients: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No ingredients listed.')).toBeInTheDocument());
  });

  it('recipe with no instructions — fallback text shown', async () => {
    recipesApi.getRecipeById.mockResolvedValue({ ...fullRecipe, instructions: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No instructions listed.')).toBeInTheDocument());
  });

  it('recipe with notes — notes section rendered', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument());
    expect(screen.getByText('Use guanciale for authenticity.')).toBeInTheDocument();
  });

  it('recipe with no notes — notes section absent', async () => {
    recipesApi.getRecipeById.mockResolvedValue({ ...fullRecipe, notes: '' });
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    expect(screen.queryByRole('heading', { name: /notes/i })).toBeNull();
  });

  it('"← My Recipes" back-link points to /recipes', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    expect(screen.getByRole('link', { name: /← my recipes/i })).toHaveAttribute('href', '/recipes');
  });

  it('Edit button links to /recipes/:id/edit', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/recipes/abc123/edit');
  });

  it('clicking Delete shows ConfirmDialog', async () => {
    const user = userEvent.setup();
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('cancel in ConfirmDialog dismisses it without deleting', async () => {
    const user = userEvent.setup();
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(recipesApi.deleteRecipe).not.toHaveBeenCalled();
  });

  it('confirming delete calls deleteRecipe and navigates', async () => {
    const user = userEvent.setup();
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    recipesApi.deleteRecipe.mockResolvedValue({});
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(recipesApi.deleteRecipe).toHaveBeenCalledWith('abc123'));
    expect(mockNavigate).toHaveBeenCalledWith('/recipes');
  });

  it('delete API failure — error message shown, user stays on page', async () => {
    const user = userEvent.setup();
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    recipesApi.deleteRecipe.mockRejectedValue(new Error('Server Error'));
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(screen.getByText('Failed to delete recipe.')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('recipe not found — shows error state with "← My Recipes" link', async () => {
    recipesApi.getRecipeById.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Recipe not found.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /← my recipes/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('error state does not render Edit or Delete buttons', async () => {
    recipesApi.getRecipeById.mockRejectedValue(new Error('error'));
    renderPage();
    await waitFor(() => screen.getByText('Recipe not found.'));
    expect(screen.queryByRole('link', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('accessibility: page has a single h1 containing the recipe title', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => screen.getByText('Classic Pasta Carbonara'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('accessibility: Ingredients section has a heading', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /ingredients/i })).toBeInTheDocument());
  });

  it('accessibility: Instructions section has a heading', async () => {
    recipesApi.getRecipeById.mockResolvedValue(fullRecipe);
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /instructions/i })).toBeInTheDocument());
  });
});
