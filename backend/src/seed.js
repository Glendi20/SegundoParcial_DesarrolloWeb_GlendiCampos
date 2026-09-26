/**
 * Datos iniciales: 3 usuarios de prueba y un inventario de ejemplo.
 * Solo se ejecuta si la tabla Usuarios está vacía (o con `npm run seed -- --reset`).
 */
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('./db');
let FOTOS = {};
try { FOTOS = require('./seed-fotos.json'); } catch { /* opcional */ }

const USUARIOS = [
  { nombre: 'Ana', apellido: 'López', correo: 'ana.lopez@subastasgt.com', telefono: '5555-1001', password: 'Subasta#2026A' },
  { nombre: 'Carlos', apellido: 'Méndez', correo: 'carlos.mendez@subastasgt.com', telefono: '5555-1002', password: 'Subasta#2026B' },
  { nombre: 'Lucía', apellido: 'Ramírez', correo: 'lucia.ramirez@subastasgt.com', telefono: '5555-1003', password: 'Subasta#2026C' },
];

const H = 3600e3;
const D = 24 * H;

// dueño = índice en USUARIOS; ini/fin en milisegundos relativos al momento del seed
const VEHICULOS = [
  { clave: 'corolla', dueno: 0, anio: 2019, tipo: 'Automóvil', marca: 'Toyota', modelo: 'Corolla LE', motor: '1.8L 4 cil.', trans: 'CVT', comb: 'Gasolina', tren: 'FWD', cil: 4, danio: 'Verde', base: 20000, ini: -1 * D, fin: 75 * D, desc: 'Golpe leve en defensa trasera. Arranca y camina. Título limpio.', color: '#c0392b' },
  { clave: 'hilux', dueno: 1, anio: 2018, tipo: 'Pickup', marca: 'Toyota', modelo: 'Hilux SR', motor: '2.4L Turbo Diésel', trans: 'Manual', comb: 'Diésel', tren: '4WD', cil: 4, danio: 'Amarillo', base: 65000, ini: -2 * D, fin: 90 * D, desc: 'Daño lateral izquierdo, puertas con hundimiento. Motor en buen estado.', color: '#7f8c8d' },
  { clave: 'civic', dueno: 2, anio: 2020, tipo: 'Automóvil', marca: 'Honda', modelo: 'Civic EX', motor: '1.5L Turbo', trans: 'CVT', comb: 'Gasolina', tren: 'FWD', cil: 4, danio: 'Verde', base: 45000, ini: -10 * D, fin: -1 * D, desc: 'Rayones superficiales. Interior impecable. (Subasta ya finalizada: ejemplo de vehículo vendido.)', color: '#2c3e50' },
  { clave: 'cx5', dueno: 0, anio: 2021, tipo: 'SUV', marca: 'Mazda', modelo: 'CX-5 Touring', motor: '2.5L 4 cil.', trans: 'Automática', comb: 'Gasolina', tren: 'AWD', cil: 4, danio: 'Amarillo', base: 70000, ini: -1 * D, fin: 105 * D, desc: 'Impacto frontal medio, bolsas de aire intactas. Reparable.', color: '#8e1b1b' },
  { clave: 'f150', dueno: 1, anio: 2016, tipo: 'Pickup', marca: 'Ford', modelo: 'F-150 XLT', motor: '5.0L V8', trans: 'Automática', comb: 'Gasolina', tren: '4WD', cil: 8, danio: 'Rojo', base: 35000, ini: -1 * D, fin: 80 * D, desc: 'Volcadura. Se vende como salvamento para piezas.', color: '#1f3a93' },
  { clave: 'tucson', dueno: 2, anio: 2019, tipo: 'SUV', marca: 'Hyundai', modelo: 'Tucson GLS', motor: '2.0L 4 cil.', trans: 'Automática', comb: 'Gasolina', tren: 'FWD', cil: 4, danio: 'Verde', base: 52000, ini: -2 * D, fin: 120 * D, desc: 'Daño por granizo leve. Mecánica perfecta.', color: '#ecf0f1' },
  { clave: 'model3', dueno: 0, anio: 2021, tipo: 'Automóvil', marca: 'Tesla', modelo: 'Model 3 Long Range', motor: 'Doble motor eléctrico', trans: 'Automática', comb: 'Eléctrico', tren: 'AWD', cil: 0, danio: 'Amarillo', base: 120000, ini: -1 * D, fin: 110 * D, desc: 'Daño en suspensión delantera derecha. Batería al 92 %.', color: '#f5f5f5' },
  { clave: 'wrangler', dueno: 1, anio: 2018, tipo: 'SUV', marca: 'Jeep', modelo: 'Wrangler Sport', motor: '3.6L V6', trans: 'Manual', comb: 'Gasolina', tren: '4WD', cil: 6, danio: 'Rojo', base: 40000, ini: -12 * D, fin: -2 * D, desc: 'Daño por inundación. Se vende con título de salvamento. (Subasta finalizada sin ofertas: ejemplo de subasta desierta.)', color: '#27ae60' },
  { clave: 'sportage', dueno: 2, anio: 2020, tipo: 'SUV', marca: 'Kia', modelo: 'Sportage LX', motor: '2.4L 4 cil.', trans: 'Automática', comb: 'Gasolina', tren: 'FWD', cil: 4, danio: 'Amarillo', base: 48000, ini: 3 * D, fin: 100 * D, desc: 'Próxima subasta. Golpe en puerta trasera derecha.', color: '#d35400' },
  { clave: 'frontier', dueno: 0, anio: 2017, tipo: 'Pickup', marca: 'Nissan', modelo: 'Frontier SV', motor: '2.5L 4 cil.', trans: 'Manual', comb: 'Gasolina', tren: 'RWD', cil: 4, danio: 'Verde', base: 38000, ini: -5 * D, fin: 85 * D, desc: 'Uso normal, detalles cosméticos.', color: '#95a5a6' },
  { clave: 'rav4', dueno: 1, anio: 2022, tipo: 'SUV', marca: 'Toyota', modelo: 'RAV4 Hybrid XLE', motor: '2.5L Híbrido', trans: 'CVT', comb: 'Híbrido', tren: 'AWD', cil: 4, danio: 'Verde', base: 110000, ini: -1 * D, fin: 115 * D, desc: 'Daño menor en faro delantero. Pocas millas.', color: '#34495e' },
  { clave: 'yamaha', dueno: 2, anio: 2021, tipo: 'Motocicleta', marca: 'Yamaha', modelo: 'MT-07', motor: '689cc bicilíndrico', trans: 'Manual', comb: 'Gasolina', tren: 'RWD', cil: 2, danio: 'Amarillo', base: 20000, ini: -1 * D, fin: 95 * D, desc: 'Caída lateral, carenado y espejo dañados.', color: '#2980b9' },
];

// Pujas de ejemplo: [clave, índice de usuario, monto]
const PUJAS = [
  ['corolla', 1, 20500], ['corolla', 2, 22600], ['corolla', 1, 24900],
  ['hilux', 2, 66000], ['hilux', 0, 72600],
  ['civic', 0, 45500], ['civic', 1, 50100],
  ['cx5', 2, 71000],
  ['tucson', 0, 52500], ['tucson', 1, 57800], ['tucson', 0, 63600],
  ['yamaha', 0, 20500],
];

const VISTAS = ['Frontal', 'Lateral', 'Trasera', 'Interior', 'Motor'];
function fotosDe(v) {
  if (Array.isArray(FOTOS[v.clave]) && FOTOS[v.clave].length >= 5) return FOTOS[v.clave];
  return VISTAS.map((_, i) => `/api/placeholder/${encodeURIComponent(v.marca + ' ' + v.modelo)}/${i + 1}.svg?c=${encodeURIComponent(v.color)}`);
}

async function seed({ reset = false } = {}) {
  const pool = await getPool();
  const n = (await pool.request().query('SELECT COUNT(*) AS n FROM dbo.Usuarios')).recordset[0].n;
  if (n > 0 && !reset) return false;
  if (reset) await pool.request().batch('DELETE FROM dbo.Pujas; DELETE FROM dbo.VehiculoFotos; DELETE FROM dbo.Vehiculos; DELETE FROM dbo.Usuarios;');

  const ids = [];
  for (const u of USUARIOS) {
    const r = await pool.request()
      .input('n', sql.NVarChar(60), u.nombre).input('a', sql.NVarChar(60), u.apellido)
      .input('c', sql.NVarChar(120), u.correo).input('t', sql.NVarChar(20), u.telefono)
      .input('h', sql.NVarChar(100), await bcrypt.hash(u.password, 10))
      .query('INSERT INTO dbo.Usuarios (Nombre, Apellido, Correo, Telefono, PasswordHash) OUTPUT INSERTED.Id VALUES (@n,@a,@c,@t,@h)');
    ids.push(r.recordset[0].Id);
  }

  const ahora = Date.now();
  const vid = {};
  for (const v of VEHICULOS) {
    const r = await pool.request()
      .input('u', sql.Int, ids[v.dueno]).input('anio', sql.Int, v.anio).input('tipo', sql.NVarChar(40), v.tipo)
      .input('marca', sql.NVarChar(40), v.marca).input('modelo', sql.NVarChar(60), v.modelo).input('motor', sql.NVarChar(40), v.motor)
      .input('trans', sql.NVarChar(20), v.trans).input('comb', sql.NVarChar(20), v.comb).input('tren', sql.NVarChar(4), v.tren)
      .input('cil', sql.Int, v.cil).input('danio', sql.NVarChar(10), v.danio).input('desc', sql.NVarChar(1000), v.desc)
      .input('base', sql.Decimal(12, 2), v.base)
      .input('ini', sql.DateTime2, new Date(ahora + v.ini)).input('fin', sql.DateTime2, new Date(ahora + v.fin))
      .query(`INSERT INTO dbo.Vehiculos (UsuarioId, Anio, TipoArticulo, Marca, Modelo, Motor, Transmision, Combustible, TrenManejo,
                Cilindros, Danio, Descripcion, PrecioBase, FechaInicio, FechaCierre)
              OUTPUT INSERTED.Id VALUES (@u,@anio,@tipo,@marca,@modelo,@motor,@trans,@comb,@tren,@cil,@danio,@desc,@base,@ini,@fin)`);
    vid[v.clave] = r.recordset[0].Id;
    const fotos = fotosDe(v);
    for (let i = 0; i < fotos.length; i++) {
      await pool.request().input('v', sql.Int, vid[v.clave]).input('o', sql.Int, i + 1).input('url', sql.NVarChar(sql.MAX), fotos[i])
        .query('INSERT INTO dbo.VehiculoFotos (VehiculoId, Orden, Url) VALUES (@v,@o,@url)');
    }
  }

  // Las pujas se fechan dentro de la ventana de cada subasta (antes de su cierre)
  const porClave = Object.fromEntries(VEHICULOS.map((v) => [v.clave, v]));
  let k = 0;
  for (const [clave, u, monto] of PUJAS) {
    const fin = ahora + porClave[clave].fin;
    const t = Math.min(ahora, fin - 3 * H) - 20 * 60e3 + (k++) * 60e3;
    await pool.request().input('v', sql.Int, vid[clave]).input('u', sql.Int, ids[u]).input('m', sql.Decimal(12, 2), monto)
      .input('f', sql.DateTime2, new Date(t))
      .query(`INSERT INTO dbo.Pujas (VehiculoId, UsuarioId, Monto, Fecha) VALUES (@v,@u,@m,@f);
              UPDATE dbo.Vehiculos SET PujaActual=@m, LiderId=@u, TotalPujas=TotalPujas+1 WHERE Id=@v;`);
  }
  console.log(`[seed] ${USUARIOS.length} usuarios, ${VEHICULOS.length} vehículos y ${PUJAS.length} pujas creados.`);
  return true;
}

module.exports = { seed, USUARIOS };

if (require.main === module) {
  require('dotenv').config();
  const { ensureSchema } = require('./schema');
  ensureSchema()
    .then(() => seed({ reset: process.argv.includes('--reset') }))
    .then((hecho) => { console.log(hecho ? 'Listo.' : 'Ya había datos (usa --reset para reiniciar).'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
