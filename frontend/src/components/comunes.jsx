import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { img, quetzales } from '../api';
import { useReloj } from '../contexto';

export const DANIOS = {
  Verde: { etiqueta: 'Daño menor / Limpio', clase: 'verde' },
  Amarillo: { etiqueta: 'Daño medio / Reparable', clase: 'amarillo' },
  Rojo: { etiqueta: 'Daño severo / Salvamento', clase: 'rojo' },
};

export function DanioBadge({ danio, corto = false }) {
  const d = DANIOS[danio] || { etiqueta: danio, clase: '' };
  return (
    <span className={`danio danio-${d.clase}`} title={d.etiqueta}>
      <span className="punto" /> {corto ? danio : `${danio} · ${d.etiqueta}`}
    </span>
  );
}

/** Estado según la hora del servidor (se recalcula cada segundo en el cliente). */
export function estadoLocal(v, ahora) {
  if (ahora < new Date(v.fechaInicio).getTime()) return 'Próxima';
  if (ahora < new Date(v.fechaCierre).getTime()) return 'Activa';
  if (v.estado === 'Vendido' || v.estado === 'Desierta') return v.estado;
  return v.pujaActual != null ? 'Vendido' : 'Desierta';
}

export function partesTiempo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const dos = (n) => String(n).padStart(2, '0');

export function Countdown({ v, grande = false }) {
  const ahora = useReloj();
  const estado = estadoLocal(v, ahora);
  if (estado === 'Próxima') {
    const t = partesTiempo(new Date(v.fechaInicio).getTime() - ahora);
    return <span className={`reloj reloj-proxima ${grande ? 'grande' : ''}`}>Inicia en {t.d > 0 && `${t.d}d `}{dos(t.h)}:{dos(t.m)}:{dos(t.s)}</span>;
  }
  if (estado !== 'Activa') return <span className={`reloj reloj-cerrada ${grande ? 'grande' : ''}`}>Oferta cerrada</span>;
  const ms = new Date(v.fechaCierre).getTime() - ahora;
  const t = partesTiempo(ms);
  const urgente = ms < 3600e3;
  if (grande) {
    return (
      <div className={`reloj-grande ${urgente ? 'urgente' : ''}`}>
        {[['d', 'días'], ['h', 'horas'], ['m', 'min'], ['s', 'seg']].map(([k, l]) => (
          <div key={k} className="celda"><b>{dos(t[k])}</b><small>{l}</small></div>
        ))}
      </div>
    );
  }
  return <span className={`reloj ${urgente ? 'urgente' : ''}`}>⏱ {t.d > 0 && `${t.d}d `}{dos(t.h)}:{dos(t.m)}:{dos(t.s)}</span>;
}

export function EstadoChip({ v }) {
  const ahora = useReloj();
  const e = estadoLocal(v, ahora);
  const cls = { Activa: 'activa', 'Próxima': 'proxima', Vendido: 'vendido', Desierta: 'desierta' }[e];
  const txt = { Activa: 'En vivo', 'Próxima': 'Próximamente', Vendido: 'Vendido', Desierta: 'No vendido / Desierta' }[e];
  return <span className={`chip chip-${cls}`}>{e === 'Activa' && <span className="pulso" />}{txt}</span>;
}

export function VehiculoCard({ v, flash }) {
  return (
    <Link to={`/vehiculo/${v.id}`} className={`card ${flash ? 'flash' : ''}`}>
      <div className="card-img">
        <Imagen src={img(v.portada)} alt={v.titulo} />
        <div className="card-tags"><EstadoChip v={v} /></div>
        <div className="card-danio"><DanioBadge danio={v.danio} corto /></div>
      </div>
      <div className="card-body">
        <h3>{v.titulo}</h3>
        <p className="specs">{v.tipoArticulo} · {v.motor} · {v.transmision} · {v.trenManejo} · {v.combustible}</p>
        <div className="card-precio">
          <div>
            <small>{v.pujaActual != null ? 'Oferta actual' : 'Monto base'}</small>
            <b>{quetzales(v.pujaActual ?? v.precioBase)}</b>
          </div>
          <div className="der">
            <small>{v.totalPujas} {v.totalPujas === 1 ? 'puja' : 'pujas'}</small>
            <Countdown v={v} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function Imagen({ src, alt, ...rest }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);
  if (!src || error) return <div className="img-vacia">🚗<small>Sin imagen</small></div>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setError(true)} {...rest} />;
}

/** Carrusel interactivo: flechas, miniaturas, teclado, deslizamiento táctil y pantalla completa. */
export function Carrusel({ fotos = [], titulo }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const [toque, setToque] = useState(null);
  const n = fotos.length;
  const ir = useCallback((k) => setI((x) => (x + k + n) % n), [n]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') ir(-1);
      if (e.key === 'ArrowRight') ir(1);
      if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ir]);

  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  if (!n) return <div className="carrusel"><div className="carrusel-principal"><Imagen src={null} /></div></div>;

  return (
    <div className={`carrusel ${full ? 'full' : ''}`}>
      <div
        className="carrusel-principal"
        onTouchStart={(e) => setToque(e.touches[0].clientX)}
        onTouchEnd={(e) => { if (toque == null) return; const dx = e.changedTouches[0].clientX - toque; if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1); setToque(null); }}
      >
        <div className="carrusel-pista" style={{ transform: `translateX(-${i * 100}%)` }}>
          {fotos.map((f, k) => (
            <div className="slide" key={k} onClick={() => setFull((x) => !x)}>
              <Imagen src={img(f)} alt={`${titulo} foto ${k + 1}`} />
            </div>
          ))}
        </div>
        <button className="nav prev" onClick={() => ir(-1)} aria-label="Anterior">‹</button>
        <button className="nav next" onClick={() => ir(1)} aria-label="Siguiente">›</button>
        <span className="contador">{i + 1} / {n}</span>
        <button className="btn-full" onClick={() => setFull((x) => !x)} title="Pantalla completa">{full ? '✕' : '⤢'}</button>
      </div>
      <div className="miniaturas">
        {fotos.map((f, k) => (
          <button key={k} className={k === i ? 'activa' : ''} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`}>
            <Imagen src={img(f)} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return <div className="cargando"><span className="spinner" /> {texto}</div>;
}
