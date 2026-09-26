import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { api, quetzales } from '../api';
import { useAuth, useEvento, useReloj, useSocket, useToast } from '../contexto';
import { Carrusel, Countdown, DanioBadge, EstadoChip, estadoLocal, Cargando } from '../components/comunes';

const fechaLarga = (f) => new Date(f).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
const hora = (f) => new Date(f).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function Detalle() {
  const { id } = useParams();
  const vid = Number(id);
  const { usuario } = useAuth();
  const { socket, conectado } = useSocket();
  const toast = useToast();
  const loc = useLocation();
  const ahora = useReloj();

  const [v, setV] = useState(null);
  const [error, setError] = useState('');
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [espectadores, setEspectadores] = useState(null);
  const [pulso, setPulso] = useState(false);

  const cargar = () =>
    api(`/api/vehiculos/${vid}`)
      .then((r) => { setV(r.vehiculo); setMonto(String(r.vehiculo.minimoSiguiente)); })
      .catch((e) => setError(e.message));

  useEffect(() => { setV(null); cargar(); /* eslint-disable-next-line */ }, [vid, usuario?.id]);

  // Entrar a la "sala" del vehículo para el contador de espectadores
  useEffect(() => {
    if (!socket) return;
    const unir = () => socket.emit('ver', vid);
    unir();
    socket.on('connect', unir);
    return () => { socket.off('connect', unir); socket.emit('dejar', vid); };
  }, [socket, vid]);

  // ---- Tiempo real ----
  useEvento('puja:nueva', (d) => {
    if (d.vehiculoId !== vid) return;
    setV((x) => x && {
      ...x,
      pujaActual: d.pujaActual,
      totalPujas: d.totalPujas,
      minimoSiguiente: d.minimoSiguiente,
      historial: [{ monto: d.pujaActual, fecha: d.fecha }, ...x.historial].slice(0, 10),
    });
    setMonto((m) => (Number(m) < d.minimoSiguiente ? String(d.minimoSiguiente) : m));
    setPulso(true);
    setTimeout(() => setPulso(false), 1200);
  });
  useEvento('puja:estado', (d) => {
    if (d.vehiculoId !== vid) return;
    setV((x) => x && { ...x, miEstado: d.estado === 'ganado' ? 'ganando' : d.estado });
  });
  useEvento('subasta:cerrada', (d) => { if (d.vehiculoId === vid) setV((x) => x && { ...x, estado: d.resultado }); });
  useEvento('vehiculo:cambio', (d) => {
    if (d.vehiculoId !== vid) return;
    if (d.accion === 'eliminado') setError('Esta publicación fue eliminada por su publicador.');
    else cargar();
  });
  useEvento('espectadores', (d) => d.vehiculoId === vid && setEspectadores(d.total));

  if (error) return <div className="contenedor"><div className="alerta alerta-error">{error}</div><Link to="/" className="btn btn-sec">← Volver al inventario</Link></div>;
  if (!v) return <Cargando texto="Cargando subasta…" />;

  const estado = estadoLocal(v, ahora);
  const activa = estado === 'Activa';

  const ofertar = async (e) => {
    e.preventDefault();
    setMsg(null);
    const m = Number(monto);
    // Validación rápida en el cliente (el servidor vuelve a validar todo)
    if (!(m >= v.minimoSiguiente)) {
      setMsg({ tipo: 'error', texto: `La oferta mínima es ${quetzales(v.minimoSiguiente)}.` });
      return;
    }
    setEnviando(true);
    try {
      const r = await api(`/api/vehiculos/${vid}/pujas`, { method: 'POST', body: { monto: m } });
      setV((x) => ({ ...x, miEstado: 'ganando', pujaActual: r.pujaActual, totalPujas: r.totalPujas, minimoSiguiente: r.minimoSiguiente }));
      setMonto(String(r.minimoSiguiente));
      setMsg({ tipo: 'ok', texto: `¡Oferta de ${quetzales(m)} registrada!` });
      toast({ tipo: 'ok', titulo: '¡Oferta registrada!', texto: `${v.titulo}: ${quetzales(m)}` });
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.message });
      if (err.data?.minimoSiguiente) setMonto(String(err.data.minimoSiguiente));
    } finally {
      setEnviando(false);
    }
  };

  const sugeridos = [0, 0.05, 0.15].map((p) => Math.ceil(v.minimoSiguiente * (1 + p)));

  return (
    <div className="contenedor detalle">
      <nav className="migas"><Link to="/">Inventario</Link> › <span>{v.titulo}</span></nav>

      <div className="detalle-grid">
        <div className="detalle-izq">
          <Carrusel fotos={v.fotos} titulo={v.titulo} />

          <section className="panel">
            <h2>Ficha técnica</h2>
            <dl className="ficha">
              <div><dt>Año</dt><dd>{v.anio}</dd></div>
              <div><dt>Tipo de artículo</dt><dd>{v.tipoArticulo}</dd></div>
              <div><dt>Marca</dt><dd>{v.marca}</dd></div>
              <div><dt>Modelo</dt><dd>{v.modelo}</dd></div>
              <div><dt>Motor</dt><dd>{v.motor}</dd></div>
              <div><dt>Transmisión</dt><dd>{v.transmision}</dd></div>
              <div><dt>Combustible</dt><dd>{v.combustible}</dd></div>
              <div><dt>Tren de manejo</dt><dd>{v.trenManejo}</dd></div>
              <div><dt>Cilindros</dt><dd>{v.cilindros === 0 ? '0 (eléctrico)' : v.cilindros}</dd></div>
              <div><dt>Estado de daño</dt><dd><DanioBadge danio={v.danio} /></dd></div>
            </dl>
            {v.descripcion && <p className="descripcion">{v.descripcion}</p>}
          </section>

          <section className="panel">
            <h2>Parámetros de la subasta</h2>
            <dl className="ficha">
              <div><dt>Monto base</dt><dd>{quetzales(v.precioBase)}</dd></div>
              <div><dt>Incremento mínimo</dt><dd>10 % sobre la oferta actual</dd></div>
              <div><dt>Inicio</dt><dd>{fechaLarga(v.fechaInicio)}</dd></div>
              <div><dt>Cierre</dt><dd>{fechaLarga(v.fechaCierre)}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="detalle-der">
          <div className={`panel-puja ${pulso ? 'pulso-puja' : ''}`}>
            <div className="puja-cab">
              <h1>{v.titulo}</h1>
              <div className="puja-meta">
                <EstadoChip v={v} />
                <span className={`en-vivo ${conectado ? 'on' : ''}`} title="Conexión en tiempo real">
                  {conectado ? '● Conectado en vivo' : '○ Reconectando…'}
                </span>
              </div>
            </div>

            <Countdown v={v} grande />

            <div className="oferta-actual">
              <small>{v.pujaActual != null ? 'Oferta actual más alta' : 'Monto base (sin ofertas aún)'}</small>
              <strong key={v.pujaActual}>{quetzales(v.pujaActual ?? v.precioBase)}</strong>
              <span>{v.totalPujas} {v.totalPujas === 1 ? 'puja' : 'pujas'}{espectadores ? ` · 👁 ${espectadores} ${espectadores === 1 ? 'persona viendo' : 'personas viendo'}` : ''}</span>
            </div>

            {/* Indicador visual de estado del usuario */}
            {usuario && v.miEstado === 'ganando' && activa && (
              <div className="badge-estado ganando">🏆 ¡Vas ganando esta subasta!</div>
            )}
            {usuario && v.miEstado === 'superado' && activa && (
              <div className="badge-estado superado">⚠️ Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!</div>
            )}
            {usuario && v.miEstado === 'ganando' && estado === 'Vendido' && (
              <div className="badge-estado ganando">🎉 ¡Ganaste esta subasta!</div>
            )}
            {usuario && v.miEstado === 'superado' && estado === 'Vendido' && (
              <div className="badge-estado cerrado">La subasta terminó y otra oferta fue la ganadora.</div>
            )}

            {estado === 'Próxima' && <div className="aviso">La subasta aún no inicia. Podrás ofertar a partir del {fechaLarga(v.fechaInicio)}.</div>}
            {(estado === 'Vendido' || estado === 'Desierta') && (
              <div className={`aviso-cierre ${estado === 'Vendido' ? 'vendido' : 'desierta'}`}>
                <b>Oferta cerrada</b>
                {estado === 'Vendido'
                  ? <span>Vendido por {quetzales(v.pujaActual)}</span>
                  : <span>No se alcanzó el monto base: subasta declarada no vendida / desierta.</span>}
              </div>
            )}

            {activa && !usuario && (
              <div className="bloqueo">
                <p>🔒 Para ofertar debes iniciar sesión.</p>
                <Link to="/login" state={{ desde: loc.pathname }} className="btn btn-primario btn-bloque">Iniciar sesión para ofertar</Link>
                <Link to="/registro" state={{ desde: loc.pathname }} className="link">¿No tienes cuenta? Regístrate</Link>
              </div>
            )}

            {activa && usuario && v.esPropietario && (
              <div className="aviso">Esta es tu publicación; no puedes ofertar por ella. <Link to={`/editar/${v.id}`}>Editar publicación</Link></div>
            )}

            {activa && usuario && !v.esPropietario && (
              <form className="form-puja" onSubmit={ofertar}>
                <label htmlFor="monto">Tu oferta (mínimo {quetzales(v.minimoSiguiente)})</label>
                <div className="input-monto">
                  <span>Q</span>
                  <input id="monto" type="number" step="0.01" min={v.minimoSiguiente} value={monto} onChange={(e) => setMonto(e.target.value)} />
                </div>
                <div className="sugeridos">
                  {sugeridos.map((s) => <button type="button" key={s} onClick={() => setMonto(String(s))}>{quetzales(s)}</button>)}
                </div>
                <button className="btn btn-primario btn-bloque btn-grande" disabled={enviando || v.miEstado === 'ganando'}>
                  {enviando ? 'Enviando…' : v.miEstado === 'ganando' ? 'Tienes la oferta más alta' : 'Ofertar ahora'}
                </button>
                {msg && <div className={`alerta alerta-${msg.tipo === 'ok' ? 'ok' : 'error'}`}>{msg.texto}</div>}
                <p className="nota">🔐 Las pujas son anónimas: nadie ve quién ofertó, solo el monto más alto.</p>
              </form>
            )}
          </div>

          <div className="panel historial">
            <h3>Historial de ofertas</h3>
            {v.historial.length === 0 ? <p className="muted">Aún no hay ofertas. ¡Sé el primero!</p> : (
              <ul>
                {v.historial.map((h, k) => (
                  <li key={`${h.monto}-${k}`} className={k === 0 ? 'top' : ''}>
                    <span>👤 Postor anónimo</span>
                    <b>{quetzales(h.monto)}</b>
                    <small>{hora(h.fecha)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
