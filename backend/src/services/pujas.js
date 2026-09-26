/**
 * Motor de pujas. Toda la validación ocurre en el servidor dentro de una
 * transacción que bloquea la fila del vehículo (UPDLOCK), así dos pujas
 * simultáneas nunca pueden aceptarse con el mismo monto.
 *
 * Reglas:
 *  1. Debe haber sesión (lo garantiza el middleware).
 *  2. La subasta debe haber iniciado y no haber cerrado (hora del servidor).
 *  3. Primera puja: monto >= monto base.
 *  4. Siguientes: monto > oferta actual y >= oferta actual + 10 %.
 *  5. El publicador no puede pujar por su propio vehículo.
 *  6. Si ya vas ganando no puedes volver a pujar contra ti mismo.
 */
const { sql, getPool } = require('../db');
const { minimoSiguiente } = require('./reglas');

const fmt = (n) => 'Q ' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function registrarPuja(vehiculoId, usuarioId, montoCrudo) {
  const monto = Number(montoCrudo);
  if (!Number.isFinite(monto) || monto <= 0 || monto > 99_999_999 || Math.abs(Math.round(monto * 100) - monto * 100) > 1e-6) {
    return { ok: false, status: 400, error: 'Monto inválido (máximo 2 decimales).' };
  }
  if (!Number.isInteger(vehiculoId)) return { ok: false, status: 400, error: 'Vehículo inválido.' };

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const v = (await new sql.Request(tx).input('id', sql.Int, vehiculoId).query(
      'SELECT * FROM dbo.Vehiculos WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id'
    )).recordset[0];

    const fallo = async (status, error, extra = {}) => {
      await tx.rollback();
      return { ok: false, status, error, ...extra };
    };

    if (!v) return fallo(404, 'Vehículo no encontrado.');
    const ahora = new Date();
    if (ahora < new Date(v.FechaInicio)) return fallo(409, 'La subasta aún no ha iniciado.');
    if (ahora >= new Date(v.FechaCierre) || v.Resultado) return fallo(409, 'Oferta cerrada: el tiempo de la subasta terminó.');
    if (v.UsuarioId === usuarioId) return fallo(403, 'No puedes ofertar por un vehículo que tú publicaste.');
    if (v.LiderId === usuarioId) return fallo(409, '¡Ya tienes la oferta más alta! Espera a que alguien te supere.');

    const minimo = minimoSiguiente(v);
    if (v.PujaActual == null && monto < Number(v.PrecioBase)) {
      return fallo(422, `La oferta no puede ser menor al monto base (${fmt(v.PrecioBase)}).`, { minimoSiguiente: minimo });
    }
    if (v.PujaActual != null && monto <= Number(v.PujaActual)) {
      return fallo(422, `La oferta debe ser mayor a la oferta actual (${fmt(v.PujaActual)}).`, { minimoSiguiente: minimo });
    }
    if (monto < minimo) {
      return fallo(422, `La nueva puja debe superar la actual en al menos 10 %: mínimo ${fmt(minimo)}.`, { minimoSiguiente: minimo });
    }

    await new sql.Request(tx)
      .input('v', sql.Int, vehiculoId).input('u', sql.Int, usuarioId).input('m', sql.Decimal(12, 2), monto)
      .query(`INSERT INTO dbo.Pujas (VehiculoId, UsuarioId, Monto) VALUES (@v, @u, @m);
              UPDATE dbo.Vehiculos SET PujaActual = @m, LiderId = @u, TotalPujas = TotalPujas + 1 WHERE Id = @v;`);
    await tx.commit();

    const nuevo = { ...v, PujaActual: monto, TotalPujas: v.TotalPujas + 1 };
    return {
      ok: true,
      anteriorLiderId: v.LiderId,
      publico: {
        vehiculoId,
        titulo: `${v.Anio} ${v.Marca} ${v.Modelo}`,
        pujaActual: monto,
        totalPujas: nuevo.TotalPujas,
        minimoSiguiente: minimoSiguiente(nuevo),
        fecha: ahora,
      },
    };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

module.exports = { registrarPuja };
