const { getIO } = require('./socketInstance');

const safeEmit = (fn) => {
  try { fn(getIO()); } catch (e) { console.warn('[Socket] emit failed:', e.message); }
};

// ── Job events ────────────────────────────────────────────────────────────────
const emitJobCreated  = (job)  => safeEmit((io) => io.to('admin').emit('job:created',  { job }));
const emitJobUpdated  = (job)  => safeEmit((io) => io.to('admin').emit('job:updated',  { job }));
const emitJobDeleted  = (jobId)=> safeEmit((io) => io.to('admin').emit('job:deleted',  { jobId }));

// ── Request events ────────────────────────────────────────────────────────────
const emitRequestUpdated = (request) =>
  safeEmit((io) => io.to('admin').emit('request:updated', { request }));

const emitRequestMessage = (requestId, message) =>
  safeEmit((io) => io.to(`request:${requestId}`).emit('request:message', { requestId, message }));

const emitRequestStatus = (requestId, payload) =>
  safeEmit((io) => io.to(`request:${requestId}`).emit('request:status', { requestId, ...payload }));

// ── Verification events ───────────────────────────────────────────────────────
const emitVerificationUpdated = (technicianId, status, notes) => {
  safeEmit(async (io) => {
    const room = `technician:${technicianId}`;
    const sockets = await io.in(room).fetchSockets();
    console.log(`[Socket] Room "${room}" has ${sockets.length} connected client(s)`);
    io.to('admin').emit('technician:verificationUpdated', { technicianId, status, notes });
    io.to(room).emit('technician:verificationUpdated', { technicianId, status, notes });
  });
};

module.exports = {
  emitJobCreated,
  emitJobUpdated,
  emitJobDeleted,
  emitRequestUpdated,
  emitRequestMessage,
  emitRequestStatus,
  emitVerificationUpdated,
};
