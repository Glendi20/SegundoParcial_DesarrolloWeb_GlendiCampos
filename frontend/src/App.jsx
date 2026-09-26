import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, SocketProvider, ToastProvider, useAuth, useEvento, useSocket, useToast } from './contexto';
import { quetzales } from './api';
import { Cargando } from './components/comunes';
import Home from './pages/Home';
import Detalle from './pages/Detalle';
import Publicar from './pages/Publicar';
import MisPublicaciones from './pages/MisPublicaciones';
import { Login, Registro } from './pages/Auth';

function RutaPrivada({ children }) {
  const { usuario, cargando } = useAuth();
  const loc = useLocation();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  return children;
}

function Navbar() {
  const { usuario, logout } = useAuth();
  const { conectado } = useSocket() || {};
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  return (
    <header className="navbar">
      <div className="nav-in">
        <Link to="/" className="logo"><span className="logo-ico">🚗</span> Auto<b>Puja</b> <small>GT</small></Link>
        <button className="hamburguesa" onClick={() => setMenu((x) => !x)} aria-label="Menú">☰</button>
        <nav className={menu ? 'abierto' : ''} onClick={() => setMenu(false)}>
          <NavLink to="/" end>Inventario</NavLink>
          {usuario && <NavLink to="/mis-publicaciones">Mis publicaciones</NavLink>}
          <NavLink to="/publicar" className="nav-cta">+ Publicar</NavLink>
          <span className={`live ${conectado ? 'on' : ''}`} title={conectado ? 'Tiempo real conectado' : 'Sin conexión en tiempo real'}>● En vivo</span>
          {usuario ? (
            <div className="usuario">
              <span className="avatar">{usuario.nombre[0]}{usuario.apellido[0]}</span>
              <span className="nombre">{usuario.nombre}</span>
              <button className="link" onClick={() => { logout(); nav('/'); }}>Salir</button>
            </div>
          ) : (
            <>
              <NavLink to="/login">Iniciar sesión</NavLink>
              <NavLink to="/registro" className="btn btn-primario btn-sm">Registrarse</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Avisos globales: si te superan en cualquier subasta, te enteras aunque estés en otra página. */
function AvisosGlobales() {
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  useEvento('puja:estado', (d) => {
    if (loc.pathname === `/vehiculo/${d.vehiculoId}`) return; // la vista de detalle ya lo muestra
    if (d.estado === 'superado') {
      toast({ tipo: 'error', titulo: 'Tu oferta ha sido superada', texto: `${d.titulo}: nueva oferta ${quetzales(d.pujaActual)}. Toca para ofertar.`, duracion: 9000, accion: () => nav(`/vehiculo/${d.vehiculoId}`) });
    }
    if (d.estado === 'ganado') toast({ tipo: 'ok', titulo: '🎉 ¡Ganaste la subasta!', texto: d.titulo, duracion: 12000, accion: () => nav(`/vehiculo/${d.vehiculoId}`) });
  });
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <Navbar />
            <AvisosGlobales />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/vehiculo/:id" element={<Detalle />} />
                <Route path="/login" element={<Login />} />
                <Route path="/registro" element={<Registro />} />
                <Route path="/publicar" element={<RutaPrivada><Publicar /></RutaPrivada>} />
                <Route path="/editar/:id" element={<RutaPrivada><Publicar /></RutaPrivada>} />
                <Route path="/mis-publicaciones" element={<RutaPrivada><MisPublicaciones /></RutaPrivada>} />
                <Route path="*" element={<div className="contenedor"><h1>Página no encontrada</h1><Link to="/">Ir al inventario</Link></div>} />
              </Routes>
            </main>
            <footer className="footer">
              <p>AutoPuja GT · Plataforma académica de subastas de vehículos en tiempo real · React + Web API (Node/Express) + Socket.IO + SQL Server</p>
            </footer>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
