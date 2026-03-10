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
            await onSubmit({ title: 'Test Recipe', ingredients: [], instructions: [] });
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

import CreateRecipePage from '../CreateRecipePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/recipes/new']}>
      <Routes>
        <Route path="/recipes/new" element={<CreateRecipePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CreateRecipePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('renders without crashing (smoke test)', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /new recipe/i })).toBeInTheDocument();
    expect(screen.getByTestId('recipe-form')).toBeInTheDocument();
  });

  it('"← My Recipes" back-link is rendered', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /← my recipes/i })).toHaveAttribute('href', '/recipes');
  });

  it('RecipeForm receives submitLabel="Create Recipe"', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /create recipe/i })).toBeInTheDocument();
  });

  it('RecipeForm receives no initialData (create flow)', () => {
    renderPage();
    expect(screen.queryByTestId('initial-title')).toBeNull();
  });

  it('successful submit calls createRecipe and navigates to /recipes', async () => {
    const user = userEvent.setup();
    recipesApi.createRecipe.mockResolvedValue({ _id: 'new456', title: 'Test Recipe' });
    renderPage();
    await user.click(screen.getByRole('button', { name: /create recipe/i }));
    await waitFor(() => expect(recipesApi.createRecipe).toHaveBeenCalledWith({ title: 'Test Recipe', ingredients: [], instructions: [] }));
    expect(mockNavigate).toHaveBeenCalledWith('/recipes');
  });

  it('navigate("/recipes") called on successful create', async () => {
    const user = userEvent.setup();
    recipesApi.createRecipe.mockResolvedValue({ _id: 'new456' });
    renderPage();
    await user.click(screen.getByRole('button', { name: /create recipe/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/recipes'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('createRecipe API failure — error shown in RecipeForm', async () => {
    const user = userEvent.setup();
    recipesApi.createRecipe.mockRejectedValue({ response: { data: { message: 'Title is required' } } });
    renderPage();
    await user.click(screen.getByRole('button', { name: /create recipe/i }));
    await waitFor(() => expect(screen.getByTestId('form-error')).toHaveTextContent('Title is required'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('createRecipe network error — shows fallback error', async () => {
    const user = userEvent.setup();
    recipesApi.createRecipe.mockRejectedValue(new Error('Network Error'));
    renderPage();
    await user.click(screen.getByRole('button', { name: /create recipe/i }));
    await waitFor(() => expect(screen.getByTestId('form-error')).toHaveTextContent('Failed to save recipe.'));
  });

  it('navigate is NOT called after failed submit', async () => {
    const user = userEvent.setup();
    recipesApi.createRecipe.mockRejectedValue(new Error('error'));
    renderPage();
    await user.click(screen.getByRole('button', { name: /create recipe/i }));
    await waitFor(() => screen.getByTestId('form-error'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('page heading is "New Recipe"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument();
  });
});
