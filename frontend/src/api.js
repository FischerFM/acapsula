import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Envia token em todas as requisições
api.interceptors.request.use(config => {
  const token = localStorage.getItem('acapsula_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Se receber 401, limpa sessão e recarrega para ir ao login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('acapsula_token');
      localStorage.removeItem('acapsula_usuario');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// Download autenticado de arquivo Excel
export async function downloadFile(path, filename) {
  const token = localStorage.getItem('acapsula_token');
  const res = await api.get(path, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${token}` },
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default api;
