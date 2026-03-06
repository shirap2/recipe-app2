import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import NavBar from './NavBar';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  );
}
