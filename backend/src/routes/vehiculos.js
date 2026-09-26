const express = require('express');
const { sql, getPool } = require('../db');
const { authOpcional, authRequerido } = require('../auth');
const { CATALOGOS, estadoSubasta, minimoSiguiente, validarVehiculo } = require('../services/reglas');
const { registrarPuja } = require('../services/pujas');
const rt = require('../realtime');

const router = express.Router();

const fotoUrl = (id, url) => (url == null ? `/api/fotos/${id}` : url);

/** Forma pública de un vehículo (nunca incluye quién ofertó). */
function publico(v, ahora = new Date()) {
  return {
    id: v.Id,
    titulo: `${v.Anio} ${v.Marca} ${v.Modelo}`,
    anio: v.Anio,
    tipoArticulo: v.TipoArticulo,
    marca: v.Marca,
    modelo: v.Modelo,
    motor: v.Motor,
    transmision: v.Transmision,
    combustible: v.Combustible,
    trenManejo: v.TrenManejo,
    cilindros: v.Cilindros,
    danio: v.Danio,
    descripcion: v.Descripcion,
    precioBase: Number(v.PrecioBase),
    pujaActual: v.PujaActual == null ? null : Number(v.PujaActual),
    totalPujas: v.TotalPujas,
    minimoSiguiente: minimoSiguiente(v),
    fechaInicio: v.FechaInicio,
    fechaCierre: v.FechaCierre,
    estado: estadoSubasta(v, ahora),
    portada: v.PortadaId ? fotoUrl(v.PortadaId, v.PortadaUrl) : null,
    totalFotos: v.TotalFotos ?? undefined,
  };
}

const SELECT_LISTA = `
  SELECT v.*, f.Id AS PortadaId,
         CASE WHEN LEFT(f.Url, 5) = 'data:' THEN NULL ELSE f.Url END AS PortadaUrl,
         (SELECT COUNT(*) FROM dbo.VehiculoFotos x WHERE x.VehiculoId = v.Id) AS TotalFotos
  FROM dbo.Vehiculos v
  OUTER APPLY (SELECT TOP 1 Id, Url FROM dbo.VehiculoFotos WHERE VehiculoId = v.Id ORDER BY Orden) f`;

// ---------- Catálogos ----------
router.get('/catalogos', async (_req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT DISTINCT Marca FROM dbo.Vehiculos ORDER BY Marca;
      SELECT MIN(Anio) AS AnioMin, MAX(Anio) AS AnioMax FROM dbo.Vehiculos;`);
    res.json({
      ...CATALOGOS,
      marcas: r.recordsets[0].map((x) => x.Marca),
      anioMin: r.recordsets[1][0].AnioMin,
      anioMax: r.recordsets[1][0].AnioMax,
    });
  } catch (err) { next(err); }
});

// ---------- Inventario con filtros multitarea (público) ----------
router.get('/vehiculos', async (req, res, next) => {
  try {
    const q = req.query;
    const pool = await getPool();
    const rq = pool.request();
    const where = [];
    const ahora = new Date();
    rq.input('ahora', sql.DateTime2, ahora);

    const igual = (campo, col, tipo = sql.NVarChar(60)) => {
      if (q[campo] === undefined || q[campo] === '') return;
      const valores = String(q[campo]).split(',').map((s) => s.trim()).filter(Boolean);
      const nombres = valores.map((val, i) => {
        const p = `${campo}${i}`;
        rq.input(p, tipo, tipo === sql.Int ? Number(val) : val);
        return `@${p}`;
      });
      if (nombres.length) where.push(`v.${col} IN (${nombres.join(',')})`);
    };
    igual('marca', 'Marca');
    igual('tipoArticulo', 'TipoArticulo');
    igual('transmision', 'Transmision');
    igual('combustible', 'Combustible');
    igual('trenManejo', 'TrenManejo');
    igual('danio', 'Danio');
    igual('anio', 'Anio', sql.Int);
    igual('cilindros', 'Cilindros', sql.Int);

    if (q.modelo) { rq.input('modelo', sql.NVarChar(80), `%${q.modelo}%`); where.push('v.Modelo LIKE @modelo'); }
    if (q.motor) { rq.input('motor', sql.NVarChar(80), `%${q.motor}%`); where.push('v.Motor LIKE @motor'); }
    if (q.anioMin) { rq.input('anioMin', sql.Int, Number(q.anioMin)); where.push('v.Anio >= @anioMin'); }
    if (q.anioMax) { rq.input('anioMax', sql.Int, Number(q.anioMax)); where.push('v.Anio <= @anioMax'); }
    if (q.precioMax) {
      rq.input('precioMax', sql.Decimal(12, 2), Number(q.precioMax));
      where.push('COALESCE(v.PujaActual, v.PrecioBase) <= @precioMax');
    }
    if (q.q) {
      rq.input('q', sql.NVarChar(120), `%${String(q.q).trim()}%`);
      where.push(`(v.Marca LIKE @q OR v.Modelo LIKE @q OR v.Motor LIKE @q OR v.TipoArticulo LIKE @q
                  OR v.Combustible LIKE @q OR v.Transmision LIKE @q OR v.TrenManejo LIKE @q
                  OR v.Danio LIKE @q OR CAST(v.Anio AS NVARCHAR(4)) LIKE @q OR v.Descripcion LIKE @q
                  OR CONCAT(v.Anio, ' ', v.Marca, ' ', v.Modelo) LIKE @q)`);
    }
    switch (q.estado) {
      case 'activa': where.push('v.FechaInicio <= @ahora AND v.FechaCierre > @ahora'); break;
      case 'proxima': where.push('v.FechaInicio > @ahora'); break;
      case 'finalizada': where.push('v.FechaCierre <= @ahora'); break;
      case 'vigentes': where.push('v.FechaCierre > @ahora'); break;
      default: break;
    }

    const ORDEN = {
      cierre: 'CASE WHEN v.FechaCierre > @ahora THEN 0 ELSE 1 END, v.FechaCierre',
      recientes: 'v.FechaCreacion DESC',
      precioAsc: 'COALESCE(v.PujaActual, v.PrecioBase)',
      precioDesc: 'COALESCE(v.PujaActual, v.PrecioBase) DESC',
      anio: 'v.Anio DESC',
      pujas: 'v.TotalPujas DESC',
    };
    const orden = ORDEN[q.orden] || ORDEN.cierre;

    const r = await rq.query(`${SELECT_LISTA} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orden}`);
    res.json({ serverTime: Date.now(), total: r.recordset.length, vehiculos: r.recordset.map((v) => publico(v, ahora)) });
  } catch (err) { next(err); }
});

// ---------- Mis publicaciones (buscar para editar) ----------
router.get('/vehiculos/mios', authRequerido, async (req, res, next) => {
  try {
    const pool = await getPool();
    const rq = pool.request().input('uid', sql.Int, req.user.id);
    let filtro = '';
    if (req.query.q) {
      rq.input('q', sql.NVarChar(120), `%${String(req.query.q).trim()}%`);
      filtro = `AND (v.Marca LIKE @q OR v.Modelo LIKE @q OR CAST(v.Anio AS NVARCHAR(4)) LIKE @q
                OR v.Motor LIKE @q OR v.TipoArticulo LIKE @q OR CONCAT(v.Anio, ' ', v.Marca, ' ', v.Modelo) LIKE @q)`;
    }
    const r = await rq.query(`${SELECT_LISTA} WHERE v.UsuarioId = @uid ${filtro} ORDER BY v.FechaCreacion DESC`);
    res.json({ serverTime: Date.now(), vehiculos: r.recordset.map((v) => publico(v)) });
  } catch (err) { next(err); }
});

// ---------- Detalle (público; si hay sesión incluye "miEstado") ----------
router.get('/vehiculos/:id', authOpcional, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'Id inválido.' });
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id).query(`
      SELECT * FROM dbo.Vehiculos WHERE Id = @id;
      SELECT Id, CASE WHEN LEFT(Url, 5) = 'data:' THEN NULL ELSE Url END AS Url
        FROM dbo.VehiculoFotos WHERE VehiculoId = @id ORDER BY Orden;
      SELECT TOP 10 Monto, Fecha FROM dbo.Pujas WHERE VehiculoId = @id ORDER BY Monto DESC;`);
    const v = r.recordsets[0][0];
    if (!v) return res.status(404).json({ ok: false, error: 'Vehículo no encontrado.' });

    let miEstado = null;
    let esPropietario = false;
    if (req.user) {
      esPropietario = v.UsuarioId === req.user.id;
      if (v.LiderId === req.user.id) miEstado = 'ganando';
      else {
        const p = await pool.request().input('id', sql.Int, id).input('u', sql.Int, req.user.id)
          .query('SELECT TOP 1 1 AS x FROM dbo.Pujas WHERE VehiculoId = @id AND UsuarioId = @u');
        if (p.recordset.length) miEstado = 'superado';
      }
    }
    res.json({
      serverTime: Date.now(),
      vehiculo: {
        ...publico(v),
        fotos: r.recordsets[1].map((f) => fotoUrl(f.Id, f.Url)),
        // Historial anónimo: solo montos y horas, nunca la identidad del postor.
        historial: r.recordsets[2].map((p) => ({ monto: Number(p.Monto), fecha: p.Fecha })),
        esPropietario,
        miEstado,
      },
    });
  } catch (err) { next(err); }
});

// ---------- Publicar ----------
router.post('/vehiculos', authRequerido, async (req, res, next) => {
  const { datos: d, errores } = validarVehiculo(req.body);
  if (Object.keys(errores).length) return res.status(400).json({ ok: false, error: 'Revisa los campos marcados.', errores });
  if (d.fotos.some((f) => f.startsWith('/api/fotos/'))) {
    return res.status(400).json({ ok: false, error: 'Fotos inválidas.', errores: { fotos: 'Sube imágenes nuevas o usa URLs.' } });
  }
  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = await entradas(new sql.Request(tx), d).input('uid', sql.Int, req.user.id).query(`
        INSERT INTO dbo.Vehiculos (UsuarioId, Anio, TipoArticulo, Marca, Modelo, Motor, Transmision, Combustible,
          TrenManejo, Cilindros, Danio, Descripcion, PrecioBase, FechaInicio, FechaCierre)
        OUTPUT INSERTED.Id
        VALUES (@uid, @anio, @tipo, @marca, @modelo, @motor, @trans, @comb, @tren, @cil, @danio, @desc, @base, @ini, @fin)`);
      const id = r.recordset[0].Id;
      await insertarFotos(tx, id, d.fotos);
      await tx.commit();
      rt.vehiculoActualizado(id, 'creado');
      res.status(201).json({ ok: true, id });
    } catch (e) { await tx.rollback().catch(() => {}); throw e; }
  } catch (err) { next(err); }
});

// ---------- Editar (solo el publicador) ----------
router.put('/vehiculos/:id', authRequerido, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const act = (await pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.Vehiculos WHERE Id = @id')).recordset[0];
    if (!act) return res.status(404).json({ ok: false, error: 'Vehículo no encontrado.' });
    if (act.UsuarioId !== req.user.id) return res.status(403).json({ ok: false, error: 'Solo el publicador puede editar este vehículo.' });

    const { datos: d, errores } = validarVehiculo(req.body, { parcialFechas: true });
    const ahora = new Date();
    if (new Date(act.FechaCierre) <= ahora) {
      return res.status(409).json({ ok: false, error: 'La subasta ya finalizó; no se puede editar.' });
    }
    // Con pujas registradas no se pueden cambiar las reglas de la subasta (base e inicio).
    if (act.TotalPujas > 0) {
      if (Number(act.PrecioBase) !== d.precioBase) errores.precioBase = 'No se puede cambiar el monto base: ya hay pujas.';
      if (new Date(act.FechaInicio).getTime() !== d.fechaInicio.getTime()) errores.fechaInicio = 'No se puede cambiar el inicio: ya hay pujas.';
      if (d.fechaCierre < new Date(act.FechaCierre)) errores.fechaCierre = 'Con pujas activas el cierre solo puede extenderse.';
    }
    if (!errores.fechaCierre && d.fechaCierre <= ahora) errores.fechaCierre = 'El cierre debe ser una fecha futura.';
    if (Object.keys(errores).length) return res.status(400).json({ ok: false, error: 'Revisa los campos marcados.', errores });

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Fotos: las existentes llegan como /api/fotos/<id> o como su URL; las nuevas como data:/http.
      const existentes = (await new sql.Request(tx).input('id', sql.Int, id)
        .query('SELECT Id, Url FROM dbo.VehiculoFotos WHERE VehiculoId = @id')).recordset;
      const porId = new Map(existentes.map((f) => [f.Id, f.Url]));
      const finales = [];
      for (const f of d.fotos) {
        const m = f.match(/^\/api\/fotos\/(\d+)$/);
        if (m) {
          if (!porId.has(Number(m[1]))) throw Object.assign(new Error('Foto no pertenece al vehículo'), { status: 400 });
          finales.push(porId.get(Number(m[1])));
        } else finales.push(f);
      }
      await entradas(new sql.Request(tx), d).input('id', sql.Int, id).query(`
        UPDATE dbo.Vehiculos SET Anio=@anio, TipoArticulo=@tipo, Marca=@marca, Modelo=@modelo, Motor=@motor,
          Transmision=@trans, Combustible=@comb, TrenManejo=@tren, Cilindros=@cil, Danio=@danio, Descripcion=@desc,
          PrecioBase=@base, FechaInicio=@ini, FechaCierre=@fin
        WHERE Id = @id`);
      await new sql.Request(tx).input('id', sql.Int, id).query('DELETE FROM dbo.VehiculoFotos WHERE VehiculoId = @id');
      await insertarFotos(tx, id, finales);
      await tx.commit();
      rt.vehiculoActualizado(id);
      res.json({ ok: true, id });
    } catch (e) { await tx.rollback().catch(() => {}); throw e; }
  } catch (err) { next(err); }
});

// ---------- Eliminar (solo publicador y sin pujas) ----------
router.delete('/vehiculos/:id', authRequerido, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const v = (await pool.request().input('id', sql.Int, id).query('SELECT UsuarioId, TotalPujas FROM dbo.Vehiculos WHERE Id = @id')).recordset[0];
    if (!v) return res.status(404).json({ ok: false, error: 'Vehículo no encontrado.' });
    if (v.UsuarioId !== req.user.id) return res.status(403).json({ ok: false, error: 'Solo el publicador puede eliminarlo.' });
    if (v.TotalPujas > 0) return res.status(409).json({ ok: false, error: 'No se puede eliminar: ya tiene pujas.' });
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Vehiculos WHERE Id = @id');
    rt.vehiculoActualizado(id, 'eliminado');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Pujar (validación en servidor) ----------
router.post('/vehiculos/:id/pujas', authRequerido, async (req, res, next) => {
  try {
    const r = await registrarPuja(Number(req.params.id), req.user.id, req.body.monto);
    if (!r.ok) return res.status(r.status).json({ ok: false, error: r.error, minimoSiguiente: r.minimoSiguiente });
    rt.pujaNueva(r.publico, req.user.id, r.anteriorLiderId);
    res.status(201).json({ ok: true, ...r.publico, miEstado: 'ganando' });
  } catch (err) { next(err); }
});

// ---------- Fotos subidas (se sirven como binario con caché) ----------
router.get('/fotos/:id', async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, Number(req.params.id)).query('SELECT Url FROM dbo.VehiculoFotos WHERE Id = @id');
    const url = r.recordset[0]?.Url;
    if (!url) return res.status(404).end();
    if (!url.startsWith('data:')) return res.redirect(url);
    const m = url.match(/^data:([^;]+);base64,(.*)$/);
    res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=604800, immutable');
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) { next(err); }
});

function entradas(rq, d) {
  return rq
    .input('anio', sql.Int, d.anio)
    .input('tipo', sql.NVarChar(40), d.tipoArticulo)
    .input('marca', sql.NVarChar(40), d.marca)
    .input('modelo', sql.NVarChar(60), d.modelo)
    .input('motor', sql.NVarChar(40), d.motor)
    .input('trans', sql.NVarChar(20), d.transmision)
    .input('comb', sql.NVarChar(20), d.combustible)
    .input('tren', sql.NVarChar(4), d.trenManejo)
    .input('cil', sql.Int, d.cilindros)
    .input('danio', sql.NVarChar(10), d.danio)
    .input('desc', sql.NVarChar(1000), d.descripcion)
    .input('base', sql.Decimal(12, 2), d.precioBase)
    .input('ini', sql.DateTime2, d.fechaInicio)
    .input('fin', sql.DateTime2, d.fechaCierre);
}

async function insertarFotos(tx, vehiculoId, fotos) {
  for (let i = 0; i < fotos.length; i++) {
    await new sql.Request(tx)
      .input('v', sql.Int, vehiculoId).input('o', sql.Int, i + 1).input('u', sql.NVarChar(sql.MAX), fotos[i])
      .query('INSERT INTO dbo.VehiculoFotos (VehiculoId, Orden, Url) VALUES (@v, @o, @u)');
  }
}

module.exports = router;
module.exports.publico = publico;
