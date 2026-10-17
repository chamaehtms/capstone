import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '/api';
export const API_ORIGIN = API_BASE.startsWith('http') ? API_BASE.replace(/\/api\/?$/, '') : '';

export function toAssetUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return API_ORIGIN ? `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}` : path;
}

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    // Auto-retry on network errors or cloud cold-start / gateway timeouts (502, 503, 504)
    const isNetworkOrWakingServer = !err.response || [502, 503, 504].includes(err.response.status);
    if (config && isNetworkOrWakingServer) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 2) {
        config.__retryCount += 1;
        const delay = config.__retryCount * 1200;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
