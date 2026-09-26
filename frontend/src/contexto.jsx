import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL, getToken, setToken, sincronizarHora, ahoraServidor } from './api';

// ======================= Sesión =======================
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(!!getToken());
  const [token, setTok] = useState(getToken());

  useEffect(() => {
    if (!token) { setCargando(false); return; }
    api('/api/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => { setToken(null); setTok(null); })
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => {
    const salir = () => { setToken(null); setTok(null); setUsuario(null); };
    window.addEventListener('sesion-expirada', salir);
    return () => window.removeEventListener('sesion-expirada', salir);
  }, []);

  const entrar = useCallback((r) => { setToken(r.token); setTok(r.token); setUsuario(r.usuario); }, []);
  const login = useCallback(async (correo, password) => {
    const r = await api('/api/auth/login', { method: 'POST', body: { correo, password }, auth: false });
    entrar(r);
    return r.usuario;
  }, [entrar]);
  const registro = useCallback(async (datos) => {
    const r = await api('/api/auth/registro', { method: 'POST', body: datos, auth: false });
    entrar(r);
    return r.usuario;
  }, [entrar]);
  const logout = useCallback(() => { setToken(null); setTok(null); setUsuario(null); }, []);

  const valor = useMemo(() => ({ usuario, token, cargando, login, registro, logout }), [usuario, token, cargando, login, registro, logout]);
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

// ======================= Tiempo real (Socket.IO) =======================
const SocketCtx = createContext(null);
export const useSocket = () => useContext(SocketCtx);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const s = io(API_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('connect', () => setConectado(true));
    s.on('disconnect', () => setConectado(false));
    s.on('hora', (d) => sincronizarHora(d.serverTime));
    setSocket(s);
    return () => { s.disconnect(); };
  }, [token]); // al iniciar/cerrar sesión se reconecta con la nueva identidad

  return <SocketCtx.Provider value={{ socket, conectado }}>{children}</SocketCtx.Provider>;
}

/** Suscribe un manejador a un evento del socket. */
export function useEvento(evento, manejador) {
  const { socket } = useSocket() || {};
  const ref = useRef(manejador);
  ref.current = manejador;
  useEffect(() => {
    if (!socket) return;
    const fn = (d) => ref.current(d);
    socket.on(evento, fn);
    return () => socket.off(evento, fn);
  }, [socket, evento]);
}

// ======================= Notificaciones =======================
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, tipo: 'info', ...t }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.duracion || 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`} onClick={() => { t.accion?.(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>
            {t.titulo && <strong>{t.titulo}</strong>}
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ======================= Reloj =======================
/** Devuelve la hora del servidor, actualizada cada segundo. */
export function useReloj() {
  const [t, setT] = useState(ahoraServidor());
  useEffect(() => {
    const id = setInterval(() => setT(ahoraServidor()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}
