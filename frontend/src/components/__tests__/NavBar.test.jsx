import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../hooks/useAuth');
import useAuth from '../../hooks/useAuth';

import NavBar from '../NavBar';

function renderNavBar(user = { id: '1', username: 'testuser' }, logout = vi.fn()) {
  vi.mocked(useAuth).mockReturnValue({ user, logout });
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>
  );
}

describe('NavBar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    renderNavBar();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('nav element has tagName NAV', () => {
    renderNavBar();
    expect(screen.getByRole('navigation').tagName).toBe('NAV');
  });

  it('renders brand link', () => {
    renderNavBar();
    expect(screen.getByRole('link', { name: /recipe app/i })).toBeInTheDocument();
  });

  it('renders My Recipes link', () => {
    renderNavBar();
    expect(screen.getByRole('link', { name: /my recipes/i })).toBeInTheDocument();
  });

  it('renders + New Recipe link', () => {
    renderNavBar();
    expect(screen.getByRole('link', { name: /\+ new recipe/i })).toBeInTheDocument();
  });

  it('renders username when user has username', () => {
    renderNavBar({ id: '1', username: 'alice' });
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('renders "Account" fallback when username is empty string', () => {
    renderNavBar({ id: '1', username: '' });
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders "Account" fallback when user has no username field', () => {
    renderNavBar({ id: '1' });
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders "Account" fallback when user is null', () => {
    renderNavBar(null);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders Logout button', () => {
    renderNavBar();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('clicking Logout calls logout()', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    renderNavBar({ id: '1', username: 'testuser' }, logout);
    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('logout is called even if server returns error', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockRejectedValue(new Error('network'));
    renderNavBar({ id: '1', username: 'testuser' }, logout);
    // Should not throw
    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
