import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, img, quetzales } from '../api';
import { useEvento, useToast } from '../contexto';
import { Cargando, Countdown, DanioBadge, EstadoChip, Imagen } from '../components/comunes';

export default function MisPublicaciones() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api(`/api/vehiculos/mios?q=${encodeURIComponent(q)}`).then((r) => setLista(r.vehiculos)).catch((e) => setError(e.message));
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  useEvento('puja:nueva', (d) => setLista((xs) => xs && xs.map((v) => (v.id === d.vehiculoId ? { ...v, pujaActual: d.pujaActual, totalPujas: d.totalPujas } : v))));
  useEvento('subasta:cerrada', (d) => setLista((xs) => xs && xs.map((v) => (v.id === d.vehiculoId ? { ...v, estado: d.resultado } : v))));

  const eliminar = async (v) => {
    if (!window.confirm(`¿Eliminar la publicación ${v.titulo}?`)) return;
    try {
      await api(`/api/vehiculos/${v.id}`, { method: 'DELETE' });
      toast({ tipo: 'ok', texto: 'Publicación eliminada.' });
      cargar();
    } catch (e) { toast({ tipo: 'error', texto: e.message }); }
  };

  return (
    <div className="contenedor">
      <div className="cab-pagina">
        <div>
          <h1 className="titulo-pagina">Mis publicaciones</h1>
          <p className="muted">Busca tus vehículos publicados para ver o editar su información.</p>
        </div>
        <Link to="/publicar" className="btn btn-primario">+ Publicar vehículo</Link>
      </div>
      <div className="buscador">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en mis publicaciones (marca, modelo, año, motor…)" />
      </div>
      {error && <div className="alerta alerta-error">{error}</div>}
      {!lista ? <Cargando /> : lista.length === 0 ? (
        <div className="vacio"><span>📋</span><p>{q ? 'No hay publicaciones que coincidan.' : 'Aún no has publicado vehículos.'}</p></div>
      ) : (
        <div className="tabla-mis">
          {lista.map((v) => (
            <div key={v.id} className="fila-mis">
              <Link to={`/vehiculo/${v.id}`} className="mini"><Imagen src={img(v.portada)} alt={v.titulo} /></Link>
              <div className="info">
                <Link to={`/vehiculo/${v.id}`}><b>{v.titulo}</b></Link>
                <small>{v.tipoArticulo} · {v.motor} · {v.transmision} · {v.trenManejo}</small>
                <div className="tags"><EstadoChip v={v} /> <DanioBadge danio={v.danio} corto /> <Countdown v={v} /></div>
              </div>
              <div className="montos">
                <small>Base {quetzales(v.precioBase)}</small>
                <b>{v.pujaActual != null ? quetzales(v.pujaActual) : 'Sin ofertas'}</b>
                <small>{v.totalPujas} pujas</small>
              </div>
              <div className="acciones">
                {v.estado === 'Activa' || v.estado === 'Próxima' ? <Link className="btn btn-sec" to={`/editar/${v.id}`}>✏️ Editar</Link> : <span className="muted">Finalizada</span>}
                {v.totalPujas === 0 && (v.estado === 'Activa' || v.estado === 'Próxima') && <button className="btn btn-peligro" onClick={() => eliminar(v)}>Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
