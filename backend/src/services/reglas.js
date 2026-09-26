/** Reglas de negocio compartidas (catálogos, estados, validaciones y montos). */

const CATALOGOS = {
  tiposArticulo: ['Automóvil', 'SUV', 'Pickup', 'Camioneta', 'Motocicleta', 'Camión', 'Van', 'Otro'],
  transmisiones: ['Automática', 'Manual', 'CVT'],
  combustibles: ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas (GLP)'],
  trenesManejo: ['AWD', 'FWD', 'RWD', '4WD'],
  danios: [
    { valor: 'Verde', etiqueta: 'Daño menor / Limpio' },
    { valor: 'Amarillo', etiqueta: 'Daño medio / Reparable' },
    { valor: 'Rojo', etiqueta: 'Daño severo / Salvamento' },
  ],
  incrementoMinimo: 0.10,
  minFotos: 5,
  maxFotos: 15,
};

/** Estado de la subasta según la hora actual del servidor. */
function estadoSubasta(v, ahora = new Date()) {
  if (ahora < new Date(v.FechaInicio)) return 'Próxima';
  if (ahora < new Date(v.FechaCierre)) return 'Activa';
  if (v.Resultado) return v.Resultado;
  return v.PujaActual != null && Number(v.PujaActual) >= Number(v.PrecioBase) ? 'Vendido' : 'Desierta';
}

/**
 * Monto mínimo aceptado para la siguiente puja:
 *  - sin pujas: debe ser MAYOR al monto base → se sugiere base + Q 1
 *  - con pujas: oferta actual + 10 % (redondeado hacia arriba al centavo)
 */
function minimoSiguiente(v) {
  if (v.PujaActual == null) return Number(v.PrecioBase) + 1;
  const cent = Math.round(Number(v.PujaActual) * 100);
  return Math.ceil((cent * 110) / 100) / 100;
}

const RE_URL = /^https?:\/\/\S+$/i;
const RE_DATA = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA = 2_500_000; // ~1.8 MB por imagen subida

/** Valida el cuerpo de creación/edición de un vehículo. Devuelve { datos, errores }. */
function validarVehiculo(b, { parcialFechas = false } = {}) {
  const e = {};
  const txt = (k, max, min = 1) => {
    const v = String(b[k] ?? '').trim();
    if (v.length < min || v.length > max) e[k] = `Campo obligatorio (máx. ${max} caracteres).`;
    return v;
  };
  const anioMax = new Date().getUTCFullYear() + 1;
  const d = {
    anio: Number(b.anio),
    tipoArticulo: txt('tipoArticulo', 40),
    marca: txt('marca', 40),
    modelo: txt('modelo', 60),
    motor: txt('motor', 40),
    transmision: txt('transmision', 20),
    combustible: txt('combustible', 20),
    trenManejo: String(b.trenManejo || '').toUpperCase(),
    cilindros: Number(b.cilindros),
    danio: String(b.danio || ''),
    descripcion: String(b.descripcion || '').trim().slice(0, 1000) || null,
    precioBase: Number(b.precioBase),
    fechaInicio: new Date(b.fechaInicio),
    fechaCierre: new Date(b.fechaCierre),
    fotos: Array.isArray(b.fotos) ? b.fotos.map((f) => String(f || '').trim()).filter(Boolean) : [],
  };

  if (!Number.isInteger(d.anio) || d.anio < 1950 || d.anio > anioMax) e.anio = `Año entre 1950 y ${anioMax}.`;
  if (!CATALOGOS.tiposArticulo.includes(d.tipoArticulo)) e.tipoArticulo = 'Selecciona un tipo de artículo válido.';
  if (!CATALOGOS.transmisiones.includes(d.transmision)) e.transmision = 'Selecciona una transmisión válida.';
  if (!CATALOGOS.combustibles.includes(d.combustible)) e.combustible = 'Selecciona un combustible válido.';
  if (!CATALOGOS.trenesManejo.includes(d.trenManejo)) e.trenManejo = 'Tren de manejo: AWD, FWD, RWD o 4WD.';
  if (!Number.isInteger(d.cilindros) || d.cilindros < 0 || d.cilindros > 16) e.cilindros = 'Cilindros entre 0 y 16 (0 = eléctrico).';
  if (!['Verde', 'Amarillo', 'Rojo'].includes(d.danio)) e.danio = 'Selecciona el estado de daño.';
  if (!(d.precioBase >= 1) || d.precioBase > 99_999_999) e.precioBase = 'Monto base inválido.';
  if (isNaN(d.fechaInicio)) e.fechaInicio = 'Fecha y hora de inicio requerida.';
  if (isNaN(d.fechaCierre)) e.fechaCierre = 'Fecha y hora de cierre requerida.';
  else if (!isNaN(d.fechaInicio) && d.fechaCierre <= d.fechaInicio) e.fechaCierre = 'El cierre debe ser posterior al inicio.';
  else if (!parcialFechas && d.fechaCierre <= new Date()) e.fechaCierre = 'El cierre debe ser una fecha futura.';

  if (d.fotos.length < CATALOGOS.minFotos) e.fotos = `Se requieren al menos ${CATALOGOS.minFotos} fotografías.`;
  else if (d.fotos.length > CATALOGOS.maxFotos) e.fotos = `Máximo ${CATALOGOS.maxFotos} fotografías.`;
  else if (d.fotos.some((f) => !(RE_URL.test(f) || /^\/api\/(fotos\/\d+|placeholder\/\S+)$/.test(f) || (RE_DATA.test(f) && f.length <= MAX_DATA)))) {
    e.fotos = 'Alguna fotografía no es válida (usa URL http/https o sube imágenes de hasta ~1.8 MB).';
  }
  return { datos: d, errores: e };
}

module.exports = { CATALOGOS, estadoSubasta, minimoSiguiente, validarVehiculo };
