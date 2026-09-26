import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, qsFiltros } from '../api';
import { useAuth, useEvento } from '../contexto';
import { VehiculoCard, Cargando, DANIOS } from '../components/comunes';

const FILTROS_VACIOS = {
  q: '', marca: [], modelo: '', anioMin: '', anioMax: '', tipoArticulo: '', combustible: [], danio: [],
  transmision: '', trenManejo: [], cilindros: '', motor: '', precioMax: '', estado: 'vigentes', orden: 'cierre',
};

export default function Home() {
  const { usuario } = useAuth();
  const [cat, setCat] = useState(null);
  const [f, setF] = useState(FILTROS_VACIOS);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState({});
  const [panel, setPanel] = useState(false);
  const pedido = useRef(0);

  const cargarCatalogos = () => api('/api/catalogos', { auth: false }).then(setCat).catch(() => {});
  useEffect(() => { cargarCatalogos(); }, []);

  const qs = useMemo(() => qsFiltros(f), [f]);
  const cargar = () => {
    const n = ++pedido.current;
    return api(`/api/vehiculos?${qs}`, { auth: false })
      .then((r) => { if (n === pedido.current) { setLista(r.vehiculos); setError(''); } })
      .catch((e) => n === pedido.current && setError(e.message));
  };
  useEffect(() => {
    const t = setTimeout(cargar, 250); // búsqueda en vivo con pequeño retardo
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  // ---- Tiempo real: las tarjetas se actualizan sin recargar ----
  useEvento('puja:nueva', (d) => {
    setLista((xs) => xs && xs.map((v) => (v.id === d.vehiculoId ? { ...v, pujaActual: d.pujaActual, totalPujas: d.totalPujas, minimoSiguiente: d.minimoSiguiente } : v)));
    setFlash((x) => ({ ...x, [d.vehiculoId]: Date.now() }));
    setTimeout(() => setFlash((x) => { const y = { ...x }; delete y[d.vehiculoId]; return y; }), 1600);
  });
  useEvento('subasta:cerrada', (d) => setLista((xs) => xs && xs.map((v) => (v.id === d.vehiculoId ? { ...v, estado: d.resultado } : v))));
  useEvento('vehiculo:cambio', () => { cargar(); cargarCatalogos(); });

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const alternar = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const activos = Object.entries(f).filter(([k, v]) => !['estado', 'orden'].includes(k) && (Array.isArray(v) ? v.length : v !== '')).length;

  const anios = cat?.anioMin ? Array.from({ length: cat.anioMax - cat.anioMin + 1 }, (_, i) => cat.anioMax - i) : [];

  return (
    <>
      <section className="hero">
        <div className="hero-texto">
          <span className="eyebrow">Subastas de vehículos estilo EE. UU. · en tiempo real</span>
          <h1>Encuentra tu próximo vehículo y <em>oferta en vivo</em></h1>
          <p>Autos, pickups, SUVs y motos de subasta con ficha técnica completa, fotos reales y clasificación de daño. Las ofertas se actualizan al instante, sin recargar la página.</p>
          <div className="hero-buscar">
            <input
              value={f.q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Buscar por marca, modelo, año, motor, combustible, daño…"
              aria-label="Buscar"
            />
            <span className="lupa">🔍</span>
          </div>
        </div>
        <div className="pilares">
          <div className="pilar"><span>1</span><div><b>Regístrese</b><small>Crea tu cuenta gratis para ofertar o publicar.</small></div></div>
          <div className="pilar"><span>2</span><div><b>Encuentre</b><small>Explora el inventario con filtros avanzados.</small></div></div>
          <div className="pilar"><span>3</span><div><b>Oferte</b><small>Puja en vivo y recibe avisos al instante.</small></div></div>
          {!usuario && <Link to="/registro" className="btn btn-primario btn-bloque">Crear cuenta gratis</Link>}
          {usuario && <Link to="/publicar" className="btn btn-primario btn-bloque">+ Publicar un vehículo</Link>}
        </div>
      </section>

      <div className="inventario">
        <aside className={`filtros ${panel ? 'abierto' : ''}`}>
          <div className="filtros-cab">
            <h2>Filtros {activos > 0 && <span className="contador-filtros">{activos}</span>}</h2>
            <button className="link" onClick={() => setF({ ...FILTROS_VACIOS, estado: f.estado, orden: f.orden })}>Limpiar</button>
            <button className="link solo-movil" onClick={() => setPanel(false)}>Cerrar ✕</button>
          </div>

          <Grupo titulo="Nivel de daño">
            <div className="chips-filtro">
              {Object.entries(DANIOS).map(([k, d]) => (
                <button key={k} className={`chip-f danio-${d.clase} ${f.danio.includes(k) ? 'sel' : ''}`} onClick={() => alternar('danio', k)}>
                  <span className="punto" /> {k}
                </button>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Marca">
            <div className="lista-check">
              {(cat?.marcas || []).map((m) => (
                <label key={m}><input type="checkbox" checked={f.marca.includes(m)} onChange={() => alternar('marca', m)} /> {m}</label>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Modelo">
            <input value={f.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="Ej. Corolla" />
          </Grupo>

          <Grupo titulo="Año">
            <div className="fila2">
              <select value={f.anioMin} onChange={(e) => set('anioMin', e.target.value)}>
                <option value="">Desde</option>{anios.map((a) => <option key={a}>{a}</option>)}
              </select>
              <select value={f.anioMax} onChange={(e) => set('anioMax', e.target.value)}>
                <option value="">Hasta</option>{anios.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          </Grupo>

          <Grupo titulo="Combustible">
            <div className="chips-filtro">
              {(cat?.combustibles || []).map((c) => (
                <button key={c} className={`chip-f ${f.combustible.includes(c) ? 'sel' : ''}`} onClick={() => alternar('combustible', c)}>{c}</button>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Tren de manejo">
            <div className="chips-filtro">
              {(cat?.trenesManejo || []).map((c) => (
                <button key={c} className={`chip-f ${f.trenManejo.includes(c) ? 'sel' : ''}`} onClick={() => alternar('trenManejo', c)}>{c}</button>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Tipo de artículo">
            <select value={f.tipoArticulo} onChange={(e) => set('tipoArticulo', e.target.value)}>
              <option value="">Todos</option>{(cat?.tiposArticulo || []).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Grupo>

          <Grupo titulo="Transmisión">
            <select value={f.transmision} onChange={(e) => set('transmision', e.target.value)}>
              <option value="">Todas</option>{(cat?.transmisiones || []).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Grupo>

          <Grupo titulo="Motor y cilindros">
            <div className="fila2">
              <input value={f.motor} onChange={(e) => set('motor', e.target.value)} placeholder="Motor (ej. V8)" />
              <select value={f.cilindros} onChange={(e) => set('cilindros', e.target.value)}>
                <option value="">Cilindros</option>{[0, 2, 3, 4, 5, 6, 8, 10, 12].map((c) => <option key={c} value={c}>{c === 0 ? 'Eléctrico' : c}</option>)}
              </select>
            </div>
          </Grupo>

          <Grupo titulo="Precio máximo (Q)">
            <input type="number" min="0" step="1000" value={f.precioMax} onChange={(e) => set('precioMax', e.target.value)} placeholder="Ej. 60000" />
          </Grupo>
        </aside>

        <section className="resultados">
          <div className="barra-resultados">
            <button className="btn btn-sec solo-movil" onClick={() => setPanel(true)}>☰ Filtros {activos > 0 && `(${activos})`}</button>
            <div className="tabs-estado">
              {[['vigentes', 'Vigentes'], ['activa', 'En vivo'], ['proxima', 'Próximas'], ['finalizada', 'Finalizadas'], ['', 'Todas']].map(([k, l]) => (
                <button key={k} className={f.estado === k ? 'sel' : ''} onClick={() => set('estado', k)}>{l}</button>
              ))}
            </div>
            <select className="orden" value={f.orden} onChange={(e) => set('orden', e.target.value)} aria-label="Ordenar">
              <option value="cierre">Terminan pronto</option>
              <option value="recientes">Más recientes</option>
              <option value="precioAsc">Precio: menor a mayor</option>
              <option value="precioDesc">Precio: mayor a menor</option>
              <option value="anio">Año más nuevo</option>
              <option value="pujas">Más pujas</option>
            </select>
          </div>

          {error && <div className="alerta alerta-error">{error}</div>}
          {!lista && !error && <Cargando texto="Cargando inventario…" />}
          {lista && (
            <>
              <p className="total">{lista.length} {lista.length === 1 ? 'vehículo encontrado' : 'vehículos encontrados'}</p>
              {lista.length === 0 ? (
                <div className="vacio">
                  <span>🔎</span>
                  <p>No hay vehículos con esos filtros.</p>
                  <button className="btn btn-sec" onClick={() => setF(FILTROS_VACIOS)}>Quitar filtros</button>
                </div>
              ) : (
                <div className="grid">
                  {lista.map((v) => <VehiculoCard key={v.id} v={v} flash={!!flash[v.id]} />)}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div className="grupo">
      <h4>{titulo}</h4>
      {children}
    </div>
  );
}
