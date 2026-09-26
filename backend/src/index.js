require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');

const { getPool } = require('./db');
const { ensureSchema } = require('./schema');
const { seed } = require('./seed');
const { svg } = require('./placeholder');
const realtime = require('./realtime');
const { iniciarCierreAutomatico } = require('./services/cierre');

const app = express();
const server = http.createServer(app);

const origins = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim());
const corsOrigin = origins.includes('*') ? '*' : origins;
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '30mb' })); // fotos subidas en base64

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ ok: true, db: 'conectada', serverTime: Date.now() });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'sin conexión', error: err.message });
  }
});

app.get('/api/placeholder/:titulo/:n.svg', (req, res) => {
  res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=86400');
  res.send(svg(req.params.titulo, Number(req.params.n) || 1, req.query.c));
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/vehiculos'));

app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada.' }));

// Errores no controlados
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (/(ECONN|ETIMEOUT|ESOCKET|ELOGIN)/.test(err.code || '') ? 503 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    ok: false,
    error: status === 503 ? 'La base de datos no está disponible. Intenta de nuevo en unos segundos.' : err.message || 'Error interno.',
  });
});

// Frontend (SPA) compilado: backend/public (lo copia el workflow de despliegue)
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

realtime.init(server, corsOrigin);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`API + Socket.IO escuchando en :${PORT}`));

// Crea tablas / datos de prueba y arranca el cierre automático (reintenta si la BD aún no responde).
(async function prepararBD(intento = 1) {
  try {
    await ensureSchema();
    await seed();
    iniciarCierreAutomatico();
    console.log('Base de datos lista.');
  } catch (err) {
    console.error(`[BD] intento ${intento}:`, err.message);
    setTimeout(() => prepararBD(intento + 1), Math.min(30000, 5000 * intento));
  }
})();
