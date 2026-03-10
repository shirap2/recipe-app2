import React from 'react';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../api/recipesApi');
import * as recipesApi from '../../api/recipesApi';

vi.mock('../../components/RecipeCard', () => ({
  default: ({ recipe }) => <div data-testid="recipe-card">{recipe.title}</div>,
}));

vi.mock('../../components/SearchBar', () => ({
  default: ({ onSearch, onClear, initialValue, isSearching }) => (
    <div>
      <input
        type="search"
        aria-label="Search recipes"
        data-testid="search-input"
        defaultValue={initialValue}
        onChange={() => {}}
      />
      <button onClick={() => onSearch(initialValue || 'test')} data-testid="search-btn">Search</button>
      {isSearching && <button onClick={onClear} data-testid="clear-btn">Clear</button>}
    </div>
  ),
}));

vi.mock('../../components/CategoryFilter', () => ({
  default: ({ value, onChange }) => (
    <fieldset>
      <legend>Filter by category</legend>
      <button type="button" data-testid="cat-all" aria-pressed={String(value === null)} onClick={() => onChange(null)}>All</button>
      <button type="button" data-testid="cat-dinner" aria-pressed={String(value === 'Dinner')} onClick={() => onChange('Dinner')}>Dinner</button>
      <button type="button" data-testid="cat-breakfast" aria-pressed={String(value === 'Breakfast')} onClick={() => onChange('Breakfast')}>Breakfast</button>
    </fieldset>
  ),
}));

vi.mock('../../components/SortControls', () => ({
  default: ({ sort, order, onChange }) => (
    <div>
      <select aria-label="Sort by" value={sort} onChange={e => onChange(e.target.value, order)}>
        <option value="createdAt">Date added</option>
        <option value="title">Title</option>
      </select>
      <select aria-label="Sort order" value={order} onChange={e => onChange(sort, e.target.value)}>
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
    </div>
  ),
}));

import RecipesPage from '../RecipesPage';

const fullRecipe = {
  _id: 'abc123',
  title: 'Classic Pasta Carbonara',
  category: 'Dinner',
  difficulty: 'Medium',
  prepTime: 15,
  cookTime: 20,
  servings: 4,
  tags: ['italian'],
  ingredients: [],
  instructions: [],
  createdAt: '2026-02-15T00:00:00.000Z',
};

const minimalRecipe = {
  _id: 'min123',
  title: 'Plain Toast',
  category: 'Breakfast',
  difficulty: 'Easy',
  ingredients: [],
  instructions: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage(path = '/recipes') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recipes" element={<RecipesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RecipesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recipesApi.getAllRecipes.mockResolvedValue([]);
    recipesApi.searchRecipes.mockResolvedValue([]);
  });

  it('renders without crashing (smoke test)', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /my recipes/i })).toBeInTheDocument();
    await waitFor(() => expect(recipesApi.getAllRecipes).toHaveBeenCalled());
  });

  it('shows loading state immediately on mount', () => {
    recipesApi.getAllRecipes.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('loading indicator disappears after data loads', async () => {
    recipesApi.getAllRecipes.mockResolvedValue([fullRecipe]);
    renderPage();
    await waitForElementToBeRemoved(() => screen.queryByText('Loading…'));
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('renders recipe cards for each recipe returned', async () => {
    recipesApi.getAllRecipes.mockResolvedValue([fullRecipe, minimalRecipe]);
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('recipe-card')).toHaveLength(2));
    expect(screen.getByText('Classic Pasta Carbonara')).toBeInTheDocument();
    expect(screen.getByText('Plain Toast')).toBeInTheDocument();
  });

  it('shows empty state when no recipes', async () => {
    recipesApi.getAllRecipes.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText("You haven't added any recipes yet.")).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /create your first recipe/i })).toBeInTheDocument();
  });

  it('API failure — shows error message', async () => {
    recipesApi.getAllRecipes.mockRejectedValue(new Error('Network Error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load recipes.')).toBeInTheDocument());
    expect(screen.queryByText("You haven't added any recipes yet.")).toBeNull();
  });

  it('URL param ?q= — searchRecipes called, not getAllRecipes', async () => {
    recipesApi.searchRecipes.mockResolvedValue([fullRecipe]);
    renderPage('/recipes?q=pasta');
    await waitFor(() => expect(recipesApi.searchRecipes).toHaveBeenCalledWith('pasta'));
    expect(recipesApi.getAllRecipes).not.toHaveBeenCalled();
  });

  it('URL param ?category=Dinner — getAllRecipes called with "Dinner"', async () => {
    renderPage('/recipes?category=Dinner');
    await waitFor(() => expect(recipesApi.getAllRecipes).toHaveBeenCalledWith('Dinner'));
  });

  it('URL param ?sort=title&order=asc — SortControls receives correct props', async () => {
    renderPage('/recipes?sort=title&order=asc');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /sort by/i })).toHaveValue('title'));
    expect(screen.getByRole('combobox', { name: /sort order/i })).toHaveValue('asc');
  });

  it('empty state for search — shows search-specific empty message', async () => {
    recipesApi.searchRecipes.mockResolvedValue([]);
    renderPage('/recipes?q=noresult');
    await waitFor(() => expect(screen.getByText('No recipes match your search.')).toBeInTheDocument());
    expect(screen.queryByText("You haven't added any recipes yet.")).toBeNull();
  });

  it('empty state for category — shows category-specific empty message', async () => {
    recipesApi.getAllRecipes.mockResolvedValue([]);
    renderPage('/recipes?category=Dinner');
    await waitFor(() => expect(screen.getByText('No recipes in this category.')).toBeInTheDocument());
  });

  it('no "Create your first recipe" link when searching', async () => {
    recipesApi.searchRecipes.mockResolvedValue([]);
    renderPage('/recipes?q=nothing');
    await waitFor(() => screen.getByText('No recipes match your search.'));
    expect(screen.queryByRole('link', { name: /create your first recipe/i })).toBeNull();
  });

  it('no "Create your first recipe" link when category filtered', async () => {
    recipesApi.getAllRecipes.mockResolvedValue([]);
    renderPage('/recipes?category=Dinner');
    await waitFor(() => screen.getByText('No recipes in this category.'));
    expect(screen.queryByRole('link', { name: /create your first recipe/i })).toBeNull();
  });

  it('"+ New Recipe" link points to /recipes/new', async () => {
    renderPage();
    await waitFor(() => expect(recipesApi.getAllRecipes).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /\+ new recipe/i })).toHaveAttribute('href', '/recipes/new');
  });

  it('getAllRecipes called once on mount with null when no params', async () => {
    renderPage('/recipes');
    await waitFor(() => expect(recipesApi.getAllRecipes).toHaveBeenCalledTimes(1));
    expect(recipesApi.getAllRecipes).toHaveBeenCalledWith(null);
  });

  it('sort changes do NOT trigger another API call', async () => {
    const user = userEvent.setup();
    recipesApi.getAllRecipes.mockResolvedValue([fullRecipe]);
    renderPage('/recipes');
    await waitFor(() => expect(recipesApi.getAllRecipes).toHaveBeenCalledTimes(1));
    await user.selectOptions(screen.getByRole('combobox', { name: /sort by/i }), 'title');
    expect(recipesApi.getAllRecipes).toHaveBeenCalledTimes(1);
  });
});
