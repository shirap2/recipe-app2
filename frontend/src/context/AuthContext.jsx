import { createContext, useState, useEffect, useRef } from 'react';
import axiosInstance from '../api/axios';
import { login as apiLogin, register as apiRegister, refresh, logout as apiLogout } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ref keeps the current token accessible inside axios interceptors
  // without needing to re-register interceptors on every render
  const tokenRef = useRef(null);

  const setToken = (token) => {
    tokenRef.current = token;
  };

  // Attempt to restore session from httpOnly refresh token cookie on mount
  useEffect(() => {
    refresh()
      .then((data) => {
        setToken(data.accessToken);
        // Decode userId from JWT payload (we don't have username here)
        const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
        setUser({ id: payload.userId });
      })
      .catch(() => {
        // No valid session — user stays null, redirect to login
      })
      .finally(() => setLoading(false));
  }, []);

  // Register axios interceptors once on mount
  useEffect(() => {
    const requestInterceptor = axiosInstance.interceptors.request.use((config) => {
      if (tokenRef.current) {
        config.headers.Authorization = `Bearer ${tokenRef.current}`;
      }
      return config;
    });

    const responseInterceptor = axiosInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err.config;
        const isRefreshUrl = original.url?.includes('/auth/refresh');

        if (err.response?.status === 401 && !original._retry && !isRefreshUrl) {
          original._retry = true;
          try {
            const data = await refresh();
            setToken(data.accessToken);
            const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
            setUser({ id: payload.userId });
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return axiosInstance(original);
          } catch {
            // Refresh failed — session is gone
            setToken(null);
            setUser(null);
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
      axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const login = async (username, password) => {
    const data = await apiLogin(username, password);
    setToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const register = async (username, email, password) => {
    const data = await apiRegister(username, email, password);
    setToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Clear local state even if the server call fails
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
