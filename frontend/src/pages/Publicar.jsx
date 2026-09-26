import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, img, quetzales } from '../api';
import { useToast } from '../contexto';
import { Cargando, DANIOS, Imagen } from '../components/comunes';

// datetime-local <-> ISO
const aLocal = (f) => {
  const d = new Date(f);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Reduce la imagen en el navegador (máx. 1280 px, JPEG) antes de enviarla. */
function comprimir(file, max = 1280, calidad = 0.8) {
  return new Promise((ok, fallo) => {
    const lector = new FileReader();
    lector.onerror = fallo;
    lector.onload = () => {
      const im = new Image();
      im.onerror = () => fallo(new Error('Imagen no válida'));
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', calidad));
      };
      im.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

const VACIO = {
  anio: '', tipoArticulo: '', marca: '', modelo: '', motor: '', transmision: '', combustible: '', trenManejo: '',
  cilindros: '', danio: '', descripcion: '', precioBase: '', fechaInicio: '', fechaCierre: '', fotos: [],
};

export default function Publicar() {
  const { id } = useParams();
  const editando = !!id;
  const nav = useNavigate();
  const toast = useToast();
  const [cat, setCat] = useState(null);
  const [d, setD] = useState(null);
  const [info, setInfo] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [url, setUrl] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    api('/api/catalogos', { auth: false }).then(setCat).catch(() => {});
    if (!editando) {
      const ini = new Date(Date.now() + 5 * 60e3);
      const fin = new Date(Date.now() + 7 * 864e5);
      setD({ ...VACIO, fechaInicio: aLocal(ini), fechaCierre: aLocal(fin) });
      return;
    }
    api(`/api/vehiculos/${id}`)
      .then(({ vehiculo: v }) => {
        if (!v.esPropietario) { setError('Solo el publicador puede editar este vehículo.'); return; }
        setInfo(v);
        setD({
          anio: v.anio, tipoArticulo: v.tipoArticulo, marca: v.marca, modelo: v.modelo, motor: v.motor,
          transmision: v.transmision, combustible: v.combustible, trenManejo: v.trenManejo, cilindros: v.cilindros,
          danio: v.danio, descripcion: v.descripcion || '', precioBase: v.precioBase,
          fechaInicio: aLocal(v.fechaInicio), fechaCierre: aLocal(v.fechaCierre), fotos: v.fotos,
        });
      })
      .catch((e) => setError(e.message));
  }, [id, editando]);

  if (error && !d) return <div className="contenedor"><div className="alerta alerta-error">{error}</div><Link to="/mis-publicaciones">← Mis publicaciones</Link></div>;
  if (!d) return <Cargando />;

  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const conPujas = info && info.totalPujas > 0;

  const agregarArchivos = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setProcesando(true);
    try {
      const nuevas = [];
      for (const f of files) if (f.type.startsWith('image/')) nuevas.push(await comprimir(f));
      setD((x) => ({ ...x, fotos: [...x.fotos, ...nuevas].slice(0, 15) }));
    } catch (err) {
      toast({ tipo: 'error', texto: err.message });
    } finally {
      setProcesando(false);
    }
  };
  const agregarUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { toast({ tipo: 'error', texto: 'Ingresa una URL válida (http/https).' }); return; }
    setD((x) => ({ ...x, fotos: [...x.fotos, u].slice(0, 15) }));
    setUrl('');
  };
  const mover = (i, k) => setD((x) => {
    const f = [...x.fotos];
    const j = i + k;
    if (j < 0 || j >= f.length) return x;
    [f[i], f[j]] = [f[j], f[i]];
    return { ...x, fotos: f };
  });
  const quitar = (i) => setD((x) => ({ ...x, fotos: x.fotos.filter((_, k) => k !== i) }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    const errs = {};
    if (d.fotos.length < 5) errs.fotos = `Agrega al menos 5 fotografías (llevas ${d.fotos.length}).`;
    if (new Date(d.fechaCierre) <= new Date(d.fechaInicio)) errs.fechaCierre = 'El cierre debe ser posterior al inicio.';
    setErrores(errs);
    if (Object.keys(errs).length) { setError('Revisa los campos marcados.'); return; }

    setGuardando(true);
    try {
      const body = {
        ...d,
        anio: Number(d.anio), cilindros: Number(d.cilindros), precioBase: Number(d.precioBase),
        fechaInicio: new Date(d.fechaInicio).toISOString(), fechaCierre: new Date(d.fechaCierre).toISOString(),
      };
      // Si ya hay pujas se conserva exactamente la fecha de inicio original
      if (conPujas) body.fechaInicio = info.fechaInicio;
      const r = editando
        ? await api(`/api/vehiculos/${id}`, { method: 'PUT', body })
        : await api('/api/vehiculos', { method: 'POST', body });
      toast({ tipo: 'ok', titulo: editando ? 'Cambios guardados' : '¡Vehículo publicado!', texto: `${d.anio} ${d.marca} ${d.modelo}` });
      nav(`/vehiculo/${r.id}`);
    } catch (err) {
      setError(err.message);
      setErrores(err.data?.errores || {});
    } finally {
      setGuardando(false);
    }
  };

  const Campo = ({ k, label, children }) => (
    <label className={errores[k] ? 'con-error' : ''}>
      <span>{label} <span className="req">*</span></span>
      {children}
      {errores[k] && <small className="error">{errores[k]}</small>}
    </label>
  );
  const sel = (k, opciones) => (
    <select value={d[k]} onChange={set(k)} required>
      <option value="">Selecciona…</option>
      {opciones.map((o) => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="contenedor">
      <nav className="migas"><Link to="/mis-publicaciones">Mis publicaciones</Link> › <span>{editando ? 'Editar' : 'Publicar vehículo'}</span></nav>
      <h1 className="titulo-pagina">{editando ? 'Editar publicación' : 'Publicar un vehículo para subasta'}</h1>
      <p className="muted">Todos los campos marcados con * son obligatorios.</p>

      <form className="form-vehiculo" onSubmit={enviar} noValidate={false}>
        <section className="panel">
          <h2>1. Ficha técnica</h2>
          <div className="fila3">
            {Campo({ k: 'anio', label: 'Año', children: <input type="number" min="1950" max={new Date().getFullYear() + 1} value={d.anio} onChange={set('anio')} required /> })}
            {Campo({ k: 'tipoArticulo', label: 'Tipo de artículo', children: sel('tipoArticulo', cat?.tiposArticulo || []) })}
            {Campo({ k: 'marca', label: 'Marca', children: <><input list="marcas" value={d.marca} onChange={set('marca')} required maxLength={40} placeholder="Ej. Toyota" /><datalist id="marcas">{(cat?.marcas || []).map((m) => <option key={m} value={m} />)}</datalist></> })}
            {Campo({ k: 'modelo', label: 'Modelo', children: <input value={d.modelo} onChange={set('modelo')} required maxLength={60} placeholder="Ej. Corolla LE" /> })}
            {Campo({ k: 'motor', label: 'Motor', children: <input value={d.motor} onChange={set('motor')} required maxLength={40} placeholder="Ej. 2.0L 4 cil." /> })}
            {Campo({ k: 'transmision', label: 'Transmisión', children: sel('transmision', cat?.transmisiones || []) })}
            {Campo({ k: 'combustible', label: 'Tipo de combustible', children: sel('combustible', cat?.combustibles || []) })}
            {Campo({ k: 'trenManejo', label: 'Tren de manejo', children: sel('trenManejo', cat?.trenesManejo || ['AWD', 'FWD', 'RWD', '4WD']) })}
            {Campo({ k: 'cilindros', label: 'Número de cilindros', children: <input type="number" min="0" max="16" value={d.cilindros} onChange={set('cilindros')} required placeholder="0 si es eléctrico" /> })}
          </div>
          <label>Descripción / observaciones<textarea rows="3" maxLength={1000} value={d.descripcion} onChange={set('descripcion')} placeholder="Detalles del daño, estado mecánico, título…" /></label>
        </section>

        <section className="panel">
          <h2>2. Clasificación por estado de daño <span className="req">*</span></h2>
          <div className="danio-opciones">
            {Object.entries(DANIOS).map(([k, x]) => (
              <label key={k} className={`danio-op danio-${x.clase} ${d.danio === k ? 'sel' : ''}`}>
                <input type="radio" name="danio" value={k} checked={d.danio === k} onChange={set('danio')} required />
                <span className="punto grande" />
                <b>{k}</b>
                <small>{x.etiqueta}</small>
              </label>
            ))}
          </div>
          {errores.danio && <small className="error">{errores.danio}</small>}
        </section>

        <section className="panel">
          <h2>3. Galería fotográfica <span className="req">*</span> <small className="muted">(mínimo 5 · {d.fotos.length}/15)</small></h2>
          <div className="subir-fotos">
            <label className="btn btn-sec">
              📷 Subir fotos
              <input type="file" accept="image/*" multiple hidden onChange={agregarArchivos} />
            </label>
            <div className="por-url">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…o pega la URL de una imagen" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarUrl(); } }} />
              <button type="button" className="btn btn-sec" onClick={agregarUrl}>Agregar</button>
            </div>
          </div>
          {procesando && <Cargando texto="Procesando imágenes…" />}
          <div className="galeria-edit">
            {d.fotos.map((f, i) => (
              <div key={i} className="foto-edit">
                <Imagen src={img(f)} alt={`Foto ${i + 1}`} />
                {i === 0 && <span className="portada">Portada</span>}
                <div className="acciones">
                  <button type="button" onClick={() => mover(i, -1)} title="Mover a la izquierda">◀</button>
                  <button type="button" onClick={() => quitar(i)} title="Quitar">✕</button>
                  <button type="button" onClick={() => mover(i, 1)} title="Mover a la derecha">▶</button>
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - d.fotos.length) }).map((_, i) => <div key={`v${i}`} className="foto-edit vacia">Foto {d.fotos.length + i + 1}</div>)}
          </div>
          {errores.fotos && <small className="error">{errores.fotos}</small>}
        </section>

        <section className="panel">
          <h2>4. Parámetros de la subasta</h2>
          {conPujas && <div className="alerta alerta-info">Este vehículo ya tiene {info.totalPujas} puja(s): el monto base y la fecha de inicio quedan bloqueados y el cierre solo puede extenderse.</div>}
          <div className="fila3">
            {Campo({ k: 'precioBase', label: 'Precio / monto base (Q)', children: <input type="number" min="1" step="0.01" value={d.precioBase} onChange={set('precioBase')} required disabled={conPujas} placeholder="Ej. 20000" /> })}
            {Campo({ k: 'fechaInicio', label: 'Fecha y hora de inicio', children: <input type="datetime-local" value={d.fechaInicio} onChange={set('fechaInicio')} required disabled={conPujas} /> })}
            {Campo({ k: 'fechaCierre', label: 'Fecha y hora de cierre', children: <input type="datetime-local" value={d.fechaCierre} onChange={set('fechaCierre')} required /> })}
          </div>
          {d.precioBase && <p className="muted">La primera oferta debe ser mayor a <b>{quetzales(d.precioBase)}</b>; cada nueva puja debe superar la anterior en al menos 10 %.</p>}
        </section>

        {error && <div className="alerta alerta-error">{error}</div>}
        <div className="acciones-form">
          <Link to={editando ? `/vehiculo/${id}` : '/'} className="btn btn-sec">Cancelar</Link>
          <button className="btn btn-primario btn-grande" disabled={guardando || procesando}>{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar vehículo'}</button>
        </div>
      </form>
    </div>
  );
}
