import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import RecipeCard from '../RecipeCard';

const baseRecipe = {
  _id: 'abc123',
  title: 'Pasta Carbonara',
  difficulty: 'Easy',
  prepTime: 10,
  cookTime: 20,
  tags: ['italian', 'pasta'],
  ingredients: [{ name: 'eggs', amount: 2, unit: 'pcs' }],
};

function renderCard(recipe) {
  return render(
    <MemoryRouter>
      <RecipeCard recipe={recipe} />
    </MemoryRouter>
  );
}

describe('RecipeCard', () => {
  it('renders without crashing', () => {
    renderCard(baseRecipe);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('card is a link to the recipe detail page', () => {
    renderCard(baseRecipe);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/recipes/abc123');
  });

  it('renders recipe title', () => {
    renderCard(baseRecipe);
    expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
  });

  it('renders difficulty badge', () => {
    renderCard(baseRecipe);
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('renders prep, cook, and total time', () => {
    renderCard(baseRecipe);
    const timeEl = screen.getByText(/prep 10m/i);
    expect(timeEl).toBeInTheDocument();
    expect(timeEl.textContent).toMatch(/cook 20m/i);
    expect(timeEl.textContent).toMatch(/30m total/i);
  });

  it('renders total time when only prepTime is set', () => {
    renderCard({ ...baseRecipe, cookTime: 0 });
    const timeEl = screen.getByText(/10m total/i);
    expect(timeEl.textContent).toMatch(/prep 10m/i);
    expect(timeEl.textContent).not.toMatch(/cook/i);
  });

  it('renders total time when only cookTime is set', () => {
    renderCard({ ...baseRecipe, prepTime: 0, cookTime: 30 });
    const timeEl = screen.getByText(/30m total/i);
    expect(timeEl.textContent).toMatch(/cook 30m/i);
    expect(timeEl.textContent).not.toMatch(/prep/i);
  });

  it('does not render time section when both are 0', () => {
    renderCard({ ...baseRecipe, prepTime: 0, cookTime: 0 });
    expect(screen.queryByText(/total/i)).toBeNull();
  });

  it('does not render time section when both are undefined', () => {
    renderCard({ ...baseRecipe, prepTime: undefined, cookTime: undefined });
    expect(screen.queryByText(/total/i)).toBeNull();
  });

  it('renders up to 4 tags, not 5th', () => {
    renderCard({ ...baseRecipe, tags: ['a', 'b', 'c', 'd', 'e'] });
    ['a', 'b', 'c', 'd'].forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.queryByText('e')).toBeNull();
  });

  it('renders ingredient count (plural)', () => {
    renderCard({ ...baseRecipe, ingredients: [{}, {}, {}] });
    expect(screen.getByText('3 ingredients')).toBeInTheDocument();
  });

  it('renders ingredient count (singular)', () => {
    renderCard({ ...baseRecipe, ingredients: [{}] });
    expect(screen.getByText('1 ingredient')).toBeInTheDocument();
  });

  it('does not render ingredient count when ingredients is empty', () => {
    renderCard({ ...baseRecipe, ingredients: [] });
    expect(screen.queryByText(/ingredient/)).toBeNull();
  });

  it('does not render ingredient count when ingredients is undefined', () => {
    renderCard({ ...baseRecipe, ingredients: undefined });
    expect(screen.queryByText(/ingredient/)).toBeNull();
  });

  it('does not render difficulty badge when difficulty is absent', () => {
    renderCard({ ...baseRecipe, difficulty: undefined });
    expect(screen.queryByText(/^(Easy|Medium|Hard)$/)).toBeNull();
  });

  it('renders unknown difficulty with fallback style (no crash)', () => {
    renderCard({ ...baseRecipe, difficulty: 'Expert' });
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('does not render tags when tags is empty', () => {
    renderCard({ ...baseRecipe, tags: [] });
    expect(screen.queryByText('italian')).toBeNull();
  });

  it('XSS safety: title with script tag renders as text not DOM element', () => {
    const title = '<script>alert(1)</script>';
    renderCard({ ...baseRecipe, title });
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(document.querySelector('script[src]')).toBeNull();
  });

  it('very long title renders without crash', () => {
    renderCard({ ...baseRecipe, title: 'A'.repeat(300) });
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});
