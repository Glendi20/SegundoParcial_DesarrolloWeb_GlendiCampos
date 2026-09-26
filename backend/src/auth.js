const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';
const EXPIRA = '8h';

function firmar(usuario) {
  return jwt.sign({ id: usuario.Id, nombre: usuario.Nombre }, SECRET, { expiresIn: EXPIRA });
}

function verificar(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function leerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Si hay token válido deja req.user; si no, sigue como anónimo. */
function authOpcional(req, _res, next) {
  const t = leerToken(req);
  req.user = t ? verificar(t) : null;
  next();
}

/** Bloquea a usuarios no autenticados (401). */
function authRequerido(req, res, next) {
  const t = leerToken(req);
  const user = t ? verificar(t) : null;
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Debes iniciar sesión para realizar esta acción.' });
  }
  req.user = user;
  next();
}

module.exports = { firmar, verificar, authOpcional, authRequerido };
