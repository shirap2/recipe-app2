import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/recipes" style={styles.logo}>🍳 Recipe App</Link>
      <div style={styles.right}>
        <Link to="/recipes" style={styles.link}>My Recipes</Link>
        <Link to="/recipes/new" style={styles.link}>+ New Recipe</Link>
        <span style={styles.username}>{user?.username || 'Account'}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', background: '#1e293b', color: '#fff',
    fontFamily: 'sans-serif', position: 'sticky', top: 0, zIndex: 100,
  },
  logo: { color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 18 },
  right: { display: 'flex', alignItems: 'center', gap: 20 },
  link: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  username: { color: '#e2e8f0', fontSize: 14 },
  logoutBtn: {
    background: 'transparent', border: '1px solid #475569', color: '#94a3b8',
    padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
  },
};
