import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Ignore logout errors — still navigate to login
    }
    navigate('/login');
  };

  return (
    <nav className="bg-sage-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
      <Link
        to="/recipes"
        className="text-cream-100 font-bold text-lg tracking-wide no-underline hover:text-white transition-colors"
      >
        🍳 Recipe App
      </Link>

      <div className="flex items-center gap-6">
        <Link
          to="/recipes"
          className="text-cream-300 hover:text-cream-100 text-sm font-medium transition-colors no-underline"
        >
          My Recipes
        </Link>
        <Link
          to="/recipes/new"
          className="bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors no-underline"
        >
          + New Recipe
        </Link>
        <span className="text-cream-400 text-sm font-medium">
          {user?.username || 'Account'}
        </span>
        <button
          onClick={handleLogout}
          className="border border-sage-600 text-cream-300 hover:bg-sage-700 hover:text-cream-100 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
