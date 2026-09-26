/**
 * Cierre automático de subastas: cada pocos segundos busca subastas cuya hora
 * de cierre ya pasó y les asigna resultado:
 *  - "Vendido"  si la oferta más alta alcanzó o superó el monto base
 *  - "Desierta" si no hubo ofertas (no vendida)
 * y lo notifica en tiempo real a todos los clientes.
 */
const { sql, getPool } = require('../db');
const rt = require('../realtime');

let corriendo = false;

async function cerrarVencidas() {
  if (corriendo) return;
  corriendo = true;
  try {
    const pool = await getPool();
    const r = await pool.request().input('ahora', sql.DateTime2, new Date()).query(`
      UPDATE dbo.Vehiculos
        SET Resultado = CASE WHEN PujaActual IS NOT NULL AND PujaActual >= PrecioBase THEN 'Vendido' ELSE 'Desierta' END
      OUTPUT INSERTED.Id, INSERTED.Resultado, INSERTED.PujaActual, INSERTED.LiderId, INSERTED.Anio, INSERTED.Marca, INSERTED.Modelo
      WHERE Resultado IS NULL AND FechaCierre <= @ahora`);
    for (const v of r.recordset) {
      rt.subastaCerrada({
        vehiculoId: v.Id,
        resultado: v.Resultado,
        pujaActual: v.PujaActual == null ? null : Number(v.PujaActual),
        titulo: `${v.Anio} ${v.Marca} ${v.Modelo}`,
      }, v.Resultado === 'Vendido' ? v.LiderId : null);
    }
  } catch (err) {
    console.error('[cierre]', err.message);
  } finally {
    corriendo = false;
  }
}

function iniciarCierreAutomatico(ms = 3000) {
  setInterval(cerrarVencidas, ms).unref();
  cerrarVencidas();
}

module.exports = { iniciarCierreAutomatico, cerrarVencidas };
