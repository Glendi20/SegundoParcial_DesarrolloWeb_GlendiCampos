import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexto';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(correo, password);
      nav(loc.state?.desde || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={enviar}>
        <h1>Iniciar sesión</h1>
        <p className="muted">Ingresa para ofertar y publicar vehículos.</p>
        {loc.state?.desde && <div className="alerta alerta-info">Debes iniciar sesión para continuar.</div>}
        <label>Correo electrónico<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="email" /></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {error && <div className="alerta alerta-error">{error}</div>}
        <button className="btn btn-primario btn-bloque" disabled={cargando}>{cargando ? 'Ingresando…' : 'Entrar'}</button>
        <p className="muted centro">¿No tienes cuenta? <Link to="/registro" state={loc.state}>Regístrate</Link></p>
      </form>
    </div>
  );
}

const REGLAS = [
  [(p) => p.length >= 8, '8 caracteres o más'],
  [(p) => /[A-Z]/.test(p), 'Una mayúscula'],
  [(p) => /[a-z]/.test(p), 'Una minúscula'],
  [(p) => /[0-9]/.test(p), 'Un número'],
  [(p) => /[^A-Za-z0-9]/.test(p), 'Un símbolo (#, @, !, …)'],
];

export function Registro() {
  const { registro } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [d, setD] = useState({ nombre: '', apellido: '', correo: '', telefono: '', password: '', confirmar: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));

  const cumplidas = REGLAS.filter(([f]) => f(d.password)).length;

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    const errs = {};
    if (cumplidas < REGLAS.length) errs.password = 'La contraseña no cumple los requisitos.';
    if (d.password !== d.confirmar) errs.confirmar = 'Las contraseñas no coinciden.';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    setCargando(true);
    try {
      const { confirmar, ...datos } = d;
      await registro(datos);
      nav(loc.state?.desde || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setErrores(err.data?.errores || {});
    } finally {
      setCargando(false);
    }
  };

  const campo = (k, label, props = {}) => (
    <label className={errores[k] ? 'con-error' : ''}>
      {label}
      <input value={d[k]} onChange={set(k)} required {...props} />
      {errores[k] && <small className="error">{errores[k]}</small>}
    </label>
  );

  return (
    <div className="auth">
      <form className="auth-card ancho" onSubmit={enviar}>
        <h1>Crear cuenta</h1>
        <p className="muted">El registro es obligatorio para ofertar o publicar.</p>
        <div className="fila2">
          {campo('nombre', 'Nombre', { autoComplete: 'given-name' })}
          {campo('apellido', 'Apellido', { autoComplete: 'family-name' })}
        </div>
        <div className="fila2">
          {campo('correo', 'Correo electrónico', { type: 'email', autoComplete: 'email' })}
          {campo('telefono', 'Teléfono', { type: 'tel', placeholder: '5555-1234', autoComplete: 'tel' })}
        </div>
        <div className="fila2">
          {campo('password', 'Contraseña', { type: 'password', autoComplete: 'new-password' })}
          {campo('confirmar', 'Confirmar contraseña', { type: 'password', autoComplete: 'new-password' })}
        </div>
        <div className="fuerza">
          <div className="barra"><span style={{ width: `${(cumplidas / REGLAS.length) * 100}%` }} className={`n${cumplidas}`} /></div>
          <ul>{REGLAS.map(([f, t]) => <li key={t} className={f(d.password) ? 'ok' : ''}>{f(d.password) ? '✔' : '○'} {t}</li>)}</ul>
        </div>
        {error && <div className="alerta alerta-error">{error}</div>}
        <button className="btn btn-primario btn-bloque" disabled={cargando}>{cargando ? 'Creando cuenta…' : 'Registrarme'}</button>
        <p className="muted centro">¿Ya tienes cuenta? <Link to="/login" state={loc.state}>Inicia sesión</Link></p>
      </form>
    </div>
  );
}
