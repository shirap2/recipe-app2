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

import RegisterPage from '../RegisterPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ register: vi.fn() });
  });

  it('renders without crashing (smoke test)', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /recipe app/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders username, email, and password fields', () => {
    renderPage();
    expect(screen.getByPlaceholderText('your_username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('subtitle text indicates registration context', () => {
    renderPage();
    expect(screen.getByText('Create your free account')).toBeInTheDocument();
  });

  it('password field is type="password"', () => {
    renderPage();
    expect(document.querySelector('input[name="password"]').type).toBe('password');
  });

  it('email field is type="email"', () => {
    renderPage();
    expect(document.querySelector('input[name="email"]').type).toBe('email');
  });

  it('password hint text is visible', () => {
    renderPage();
    expect(screen.getByText('At least 6 characters.')).toBeInTheDocument();
  });

  it('"Sign in" link navigates to /login', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('no error message on initial render', () => {
    renderPage();
    expect(screen.queryByText(/registration failed/i)).toBeNull();
  });

  it('successful registration calls register() with correct args then navigates', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ register });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'bob');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'bob@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(register).toHaveBeenCalledWith('bob', 'bob@test.com', 'pass123'));
    expect(mockNavigate).toHaveBeenCalledWith('/recipes');
  });

  it('button shows "Creating account…" and is disabled while register() is pending', async () => {
    const user = userEvent.setup();
    const register = vi.fn(() => new Promise(() => {}));
    vi.mocked(useAuth).mockReturnValue({ register });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'bob');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'bob@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('button', { name: /creating account…/i })).toBeDisabled();
  });

  it('API returns 400 — shows message from response', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockRejectedValue({ response: { data: { message: 'Username already taken' } } });
    vi.mocked(useAuth).mockReturnValue({ register });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'bob');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'bob@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText('Username already taken')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('API error with no response.data.message — shows fallback text', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockRejectedValue(new Error('Network Error'));
    vi.mocked(useAuth).mockReturnValue({ register });
    renderPage();
    await user.type(screen.getByPlaceholderText('your_username'), 'bob');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'bob@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText('Registration failed. Please try again.')).toBeInTheDocument());
  });

  it('accessibility: page has a single h1', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('accessibility: all inputs have associated labels', () => {
    renderPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
