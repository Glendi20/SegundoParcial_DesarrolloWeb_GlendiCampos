/**
 * Tiempo real con Socket.IO.
 *  - Cada socket autenticado entra a la sala "user:<id>" (para avisarle si va ganando o si lo superaron).
 *  - La vista de detalle entra a "veh:<id>" (contador de personas viendo).
 *  - Los cambios de puja se envían a TODOS los clientes (inventario y detalle se actualizan sin F5).
 * Nunca se envía la identidad de quien ofertó.
 */
const { Server } = require('socket.io');
const { verificar } = require('./auth');

let io = null;

function init(httpServer, corsOrigin) {
  io = new Server(httpServer, { cors: { origin: corsOrigin } });

  io.on('connection', (socket) => {
    const user = verificar(socket.handshake.auth?.token);
    if (user) socket.join(`user:${user.id}`);
    socket.emit('hora', { serverTime: Date.now() });

    socket.on('ver', async (vehiculoId) => {
      for (const r of socket.rooms) if (r.startsWith('veh:')) { socket.leave(r); emitirEspectadores(r); }
      const room = `veh:${Number(vehiculoId)}`;
      socket.join(room);
      emitirEspectadores(room);
    });

    socket.on('dejar', (vehiculoId) => {
      const room = `veh:${Number(vehiculoId)}`;
      socket.leave(room);
      emitirEspectadores(room);
    });

    socket.on('disconnecting', () => {
      for (const r of socket.rooms) if (r.startsWith('veh:')) setTimeout(() => emitirEspectadores(r), 50);
    });
  });
  return io;
}

async function emitirEspectadores(room) {
  if (!io) return;
  const n = (await io.in(room).fetchSockets()).length;
  io.to(room).emit('espectadores', { vehiculoId: Number(room.slice(4)), total: n });
}

/** Nueva puja aceptada: datos públicos a todos + estado personal al líder y al superado. */
function pujaNueva(publico, liderId, anteriorLiderId) {
  if (!io) return;
  io.emit('puja:nueva', { ...publico, serverTime: Date.now() });
  io.to(`user:${liderId}`).emit('puja:estado', { vehiculoId: publico.vehiculoId, estado: 'ganando' });
  if (anteriorLiderId && anteriorLiderId !== liderId) {
    io.to(`user:${anteriorLiderId}`).emit('puja:estado', {
      vehiculoId: publico.vehiculoId,
      estado: 'superado',
      titulo: publico.titulo,
      pujaActual: publico.pujaActual,
    });
  }
}

function subastaCerrada(data, ganadorId) {
  if (!io) return;
  io.emit('subasta:cerrada', { ...data, serverTime: Date.now() });
  if (ganadorId) io.to(`user:${ganadorId}`).emit('puja:estado', { vehiculoId: data.vehiculoId, estado: 'ganado', titulo: data.titulo });
}

function vehiculoActualizado(vehiculoId, accion = 'actualizado') {
  if (io) io.emit('vehiculo:cambio', { vehiculoId, accion });
}

module.exports = { init, pujaNueva, subastaCerrada, vehiculoActualizado };
