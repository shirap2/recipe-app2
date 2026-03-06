import useAuth from '../hooks/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h2>Dashboard</h2>
      <p>Logged in as: <strong>{user?.username || `User ${user?.id}`}</strong></p>
      <button
        onClick={logout}
        style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Logout
      </button>
    </div>
  );
}
