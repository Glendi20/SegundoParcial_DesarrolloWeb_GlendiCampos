const express = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');
const { firmar, authRequerido } = require('../auth');

const router = express.Router();

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_TELEFONO = /^\+?[0-9\s-]{8,15}$/;

/** Contraseña segura: 8+ caracteres, mayúscula, minúscula, número y símbolo. */
function erroresPassword(p = '') {
  const e = [];
  if (p.length < 8) e.push('al menos 8 caracteres');
  if (!/[A-Z]/.test(p)) e.push('una mayúscula');
  if (!/[a-z]/.test(p)) e.push('una minúscula');
  if (!/[0-9]/.test(p)) e.push('un número');
  if (!/[^A-Za-z0-9]/.test(p)) e.push('un símbolo');
  return e;
}

function usuarioPublico(u) {
  return { id: u.Id, nombre: u.Nombre, apellido: u.Apellido, correo: u.Correo, telefono: u.Telefono };
}

router.post('/registro', async (req, res, next) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const apellido = String(req.body.apellido || '').trim();
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const telefono = String(req.body.telefono || '').trim();
    const password = String(req.body.password || '');

    const errores = {};
    if (nombre.length < 2 || nombre.length > 60) errores.nombre = 'Nombre requerido (2-60 caracteres).';
    if (apellido.length < 2 || apellido.length > 60) errores.apellido = 'Apellido requerido (2-60 caracteres).';
    if (!RE_CORREO.test(correo) || correo.length > 120) errores.correo = 'Correo electrónico inválido.';
    if (!RE_TELEFONO.test(telefono)) errores.telefono = 'Teléfono inválido (8 a 15 dígitos).';
    const ep = erroresPassword(password);
    if (ep.length) errores.password = 'La contraseña necesita ' + ep.join(', ') + '.';
    if (Object.keys(errores).length) return res.status(400).json({ ok: false, error: 'Datos inválidos.', errores });

    const pool = await getPool();
    const existe = await pool.request().input('c', sql.NVarChar(120), correo)
      .query('SELECT 1 FROM dbo.Usuarios WHERE Correo = @c');
    if (existe.recordset.length) {
      return res.status(409).json({ ok: false, error: 'Ese correo ya está registrado.', errores: { correo: 'Ese correo ya está registrado.' } });
    }

    const hash = await bcrypt.hash(password, 10);
    const r = await pool.request()
      .input('n', sql.NVarChar(60), nombre)
      .input('a', sql.NVarChar(60), apellido)
      .input('c', sql.NVarChar(120), correo)
      .input('t', sql.NVarChar(20), telefono)
      .input('h', sql.NVarChar(100), hash)
      .query(`INSERT INTO dbo.Usuarios (Nombre, Apellido, Correo, Telefono, PasswordHash)
              OUTPUT INSERTED.* VALUES (@n, @a, @c, @t, @h)`);
    const u = r.recordset[0];
    res.status(201).json({ ok: true, token: firmar(u), usuario: usuarioPublico(u) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!correo || !password) return res.status(400).json({ ok: false, error: 'Ingresa correo y contraseña.' });

    const pool = await getPool();
    const r = await pool.request().input('c', sql.NVarChar(120), correo)
      .query('SELECT * FROM dbo.Usuarios WHERE Correo = @c');
    const u = r.recordset[0];
    if (!u || !(await bcrypt.compare(password, u.PasswordHash))) {
      return res.status(401).json({ ok: false, error: 'Correo o contraseña incorrectos.' });
    }
    res.json({ ok: true, token: firmar(u), usuario: usuarioPublico(u) });
  } catch (err) { next(err); }
});

router.get('/me', authRequerido, async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, req.user.id).query('SELECT * FROM dbo.Usuarios WHERE Id = @id');
    if (!r.recordset.length) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });
    res.json({ ok: true, usuario: usuarioPublico(r.recordset[0]) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.erroresPassword = erroresPassword;
