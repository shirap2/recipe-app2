import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]     = useState({ username: '', email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/recipes');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand header */}
        <div className="text-center mb-8">
          <span className="text-4xl">🍳</span>
          <h1 className="text-sage-800 text-2xl font-bold mt-2 mb-1">Recipe App</h1>
          <p className="text-sage-500 text-sm">Create your free account</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="field-label">Username</label>
              <input
                className="input"
                name="username"
                placeholder="your_username"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input
                className="input"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                className="input"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-terracotta-600 text-sm bg-terracotta-50 border border-terracotta-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-1 justify-center">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-sage-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-terracotta-500 hover:text-terracotta-600 font-semibold no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
