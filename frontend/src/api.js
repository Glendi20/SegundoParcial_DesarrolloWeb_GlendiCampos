// Cliente de la Web API (fetch asíncrono). Si el frontend se publica aparte,
// define VITE_API_URL; si lo sirve el mismo backend, queda vacío (mismo origen).
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = 'autopuja_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

// ---- Reloj sincronizado con el servidor (el temporizador no depende de la hora de la PC) ----
let offset = 0;
export const sincronizarHora = (serverTime) => {
  if (serverTime) offset = Number(serverTime) - Date.now();
};
export const ahoraServidor = () => Date.now() + offset;

export class ApiError extends Error {
  constructor(msg, status, data) {
    super(msg);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (data?.serverTime) sincronizarHora(data.serverTime);
  if (res.status === 401 && token && auth) window.dispatchEvent(new Event('sesion-expirada'));
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status, data);
  return data;
}

/** Las fotos guardadas en la BD vienen como /api/...; se les antepone el host de la API. */
export const img = (url) => (url && url.startsWith('/') ? `${API_URL}${url}` : url);

export const quetzales = (n) =>
  n == null ? '—' : 'Q ' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const qsFiltros = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (Array.isArray(v) ? v.length : v !== '' && v != null) p.set(k, Array.isArray(v) ? v.join(',') : v);
  });
  return p.toString();
};
