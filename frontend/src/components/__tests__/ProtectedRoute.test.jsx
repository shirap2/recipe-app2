import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

// NOTE: AuthContext renders {!loading && children}, so ProtectedRoute is never
// mounted while loading is true. No loading-state test is needed here.

vi.mock('../../hooks/useAuth');
import useAuth from '../../hooks/useAuth';

vi.mock('../NavBar', () => ({ default: () => <nav data-testid="mock-navbar" /> }));

import ProtectedRoute from '../ProtectedRoute';

function renderProtected(user = { id: '1', username: 'testuser' }, children = <div data-testid="child">content</div>) {
  vi.mocked(useAuth).mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={['/recipes']}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page" />} />
        <Route path="/recipes" element={<ProtectedRoute>{children}</ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing when user is logged in', () => {
    expect(() => renderProtected()).not.toThrow();
  });

  it('renders NavBar when user is present', () => {
    renderProtected();
    expect(screen.getByTestId('mock-navbar')).toBeInTheDocument();
  });

  it('renders children when user is present', () => {
    renderProtected();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('children are rendered inside a main element', () => {
    renderProtected();
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByTestId('child'));
  });

  it('redirects to /login when user is null', () => {
    renderProtected(null);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-navbar')).toBeNull();
  });

  it('does NOT render children when user is null', () => {
    renderProtected(null);
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('does NOT render NavBar when user is null', () => {
    renderProtected(null);
    expect(screen.queryByTestId('mock-navbar')).toBeNull();
  });

  it('renders correctly with user whose username is empty string', () => {
    renderProtected({ id: '1', username: '' });
    expect(screen.getByTestId('mock-navbar')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders correctly with minimal user object', () => {
    renderProtected({ id: '1' });
    expect(screen.getByTestId('mock-navbar')).toBeInTheDocument();
  });
});
