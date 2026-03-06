import { publicAxios } from './axios';
import axiosInstance from './axios';

export const login = async (username, password) => {
  const res = await publicAxios.post('/auth/login', { username, password });
  return res.data;
};

export const register = async (username, email, password) => {
  const res = await publicAxios.post('/auth/register', { username, email, password });
  return res.data;
};

export const refresh = async () => {
  const res = await publicAxios.get('/auth/refresh');
  return res.data;
};

// Logout requires the access token (auth middleware on backend)
export const logout = async () => {
  const res = await axiosInstance.post('/auth/logout');
  return res.data;
};
