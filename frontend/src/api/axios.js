import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Used by auth endpoints (login, register, refresh) — no interceptors
export const publicAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Used by protected endpoints — AuthContext attaches token interceptors
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default axiosInstance;
