const { getIO } = require('./socketInstance');

const safeEmit = (fn) => {
  try { fn(getIO()); } catch (e) { console.warn('[Socket] emit failed:', e.message); }
};

// ── Job events ────────────────────────────────────────────────────────────────
const emitJobCreated  = (job)  => safeEmit((io) => {
  io.to('admin').emit('job:created', { job });
  console.log(`[Socket] emitJobCreated → room="admin" event="job:created" jobId="${job._id}"`);
});

const emitJobUpdated  = (job)  => safeEmit((io) => {
  io.to('admin').emit('job:updated', { job });
  console.log(`[Socket] emitJobUpdated → room="admin" event="job:updated" jobId="${job._id}"`);
});

const emitJobDeleted  = (jobId) => safeEmit((io) => {
  io.to('admin').emit('job:deleted', { jobId });
  console.log(`[Socket] emitJobDeleted → room="admin" event="job:deleted" jobId="${jobId}"`);
});

// ── Request events ────────────────────────────────────────────────────────────
const emitRequestUpdated = (request) =>
  safeEmit((io) => {
    io.to('admin').emit('request:updated', { request });
    console.log(`[Socket] emitRequestUpdated → room="admin" event="request:updated" requestId="${request._id}"`);
  });

const emitRequestMessage = (requestId, message) =>
  safeEmit((io) => {
    io.to(`request:${requestId}`).emit('request:message', { requestId, message });
    console.log(`[Socket] emitRequestMessage → room="request:${requestId}" event="request:message"`);
  });

const emitRequestStatus = (requestId, payload) =>
  safeEmit((io) => {
    io.to(`request:${requestId}`).emit('request:status', { requestId, ...payload });
    console.log(`[Socket] emitRequestStatus → room="request:${requestId}" event="request:status" status="${payload.status}"`);
  });

// ── Verification events ───────────────────────────────────────────────────────
const emitVerificationUpdated = (technicianId, status, notes) => {
  safeEmit(async (io) => {
    const room = `technician:${technicianId}`;
    const sockets = await io.in(room).fetchSockets();
    console.log(`[Socket] Room "${room}" has ${sockets.length} connected client(s)`);
    io.to('admin').emit('technician:verificationUpdated', { technicianId, status, notes });
    console.log(`[Socket] emitVerificationUpdated → room="admin" event="technician:verificationUpdated" technicianId="${technicianId}" status="${status}"`);
    io.to(room).emit('technician:verificationUpdated', { technicianId, status, notes });
    console.log(`[Socket] emitVerificationUpdated → room="${room}" event="technician:verificationUpdated"`);
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
