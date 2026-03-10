import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../hooks/useAuth');
import useAuth from '../../hooks/useAuth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import LoginPage from '../LoginPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn() });
  });

  it('renders without crashing (smoke test)', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /recipe app/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders username and password inputs', () => {
    renderPage();
    expect(screen.getByPlaceholderText('your_username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
  });

  it('password field is type="password"', () => {
    renderPage();
    expect(document.querySelector('input[name="password"]').type).toBe('password');
  });

  it('"Create one" link navigates to /register', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/register');
  });

  it('no error message on initial render', () => {
    renderPage();
    expect(screen.queryByText(/invalid credentials/i)).toBeNull();
  });

  it('button is not disabled on initial render', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });

  it('typing into username field updates displayed value', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'alice');
    expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
  });

  it('successful login calls login() with correct args then navigates', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ login });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'alice');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('alice', 'secret123'));
    expect(mockNavigate).toHaveBeenCalledWith('/recipes');
  });

  it('button shows "Signing in…" and is disabled while login() is pending', async () => {
    const user = userEvent.setup();
    const login = vi.fn(() => new Promise(() => {}));
    vi.mocked(useAuth).mockReturnValue({ login });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'alice');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('button', { name: /signing in…/i })).toBeDisabled();
  });

  it('API returns 401 — shows error message', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    vi.mocked(useAuth).mockReturnValue({ login });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'alice');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('API error with no response.data.message — shows fallback text', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(new Error('Network Error'));
    vi.mocked(useAuth).mockReturnValue({ login });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'alice');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('Invalid credentials. Please try again.')).toBeInTheDocument());
  });

  it('accessibility: page has a single h1', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('accessibility: form inputs have associated labels', () => {
    renderPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
