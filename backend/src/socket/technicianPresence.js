const PRESENCE_TIMEOUT_MS = 90_000;
const PRESENCE_ROOM = 'technician-presence:admins';

const isPresenceOnline = (user, now = Date.now()) => Boolean(
  user.isOnline && user.accountStatus === 'active' && user.lastActiveAt &&
  new Date(user.lastActiveAt).getTime() > now - PRESENCE_TIMEOUT_MS
);

// One Node process owns these socket leases. See the Flutter guide before scaling.
function createTechnicianPresence({ io, User, now = Date.now, logger = console }) {
  const sessions = new Map();
  const pending = new Map();
  let timer;
  const report = error => logger.error('[Technician presence]', error.message);
  const enqueue = (id, operation) => {
    const task = (pending.get(id) || Promise.resolve()).then(operation);
    const settled = task.catch(report).finally(() => {
      if (pending.get(id) === settled) pending.delete(id);
    });
    pending.set(id, settled);
    return task;
  };
  const emit = user => {
    const payload = {
      technicianId: String(user._id),
      isOnline: isPresenceOnline(user, now()),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).toISOString() : null
    };
    io.to(PRESENCE_ROOM).emit('technician:presence', payload);
    return payload;
  };
  const touch = socket => {
    const id = String(socket.user._id);
    return enqueue(id, async () => {
      if (!socket.connected) return null;
      const stamp = now();
      const user = await User.findOneAndUpdate({
        _id: id, role: 'technician', accountStatus: 'active',
        tokenVersion: socket.user.tokenVersion || { $in: [0, null] }
      }, { $set: { isOnline: true, lastActiveAt: new Date(stamp) } }, { returnDocument: 'after' });
      if (!user) {
        socket.disconnect(true);
        return null;
      }
      if (!sessions.has(id)) sessions.set(id, new Map());
      sessions.get(id).set(socket.id, stamp);
      return emit(user);
    });
  };
  const disconnect = socket => {
    const id = String(socket.user._id);
    return enqueue(id, async () => {
      const connections = sessions.get(id);
      connections?.delete(socket.id);
      const cutoff = now() - PRESENCE_TIMEOUT_MS;
      if (connections && [...connections.values()].some(stamp => stamp > cutoff)) return;
      sessions.delete(id);
      // Preserve last confirmed contact; a delayed disconnect is not new activity.
      const user = await User.findOneAndUpdate({ _id: id, role: 'technician' },
        { $set: { isOnline: false } }, { returnDocument: 'after' });
      if (user) emit(user);
    });
  };
  const sweep = async () => {
    const cutoff = new Date(now() - PRESENCE_TIMEOUT_MS);
    const stale = await User.find({ role: 'technician', isOnline: true, $or: [
      { lastActiveAt: { $lte: cutoff } }, { lastActiveAt: null },
      { accountStatus: { $ne: 'active' } }
    ] }).select('_id');
    await Promise.all(stale.map(user => enqueue(String(user._id), async () => {
      // Recheck atomically: a heartbeat may have arrived after the find.
      const updated = await User.findOneAndUpdate({ _id: user._id, isOnline: true, $or: [
        { lastActiveAt: { $lte: cutoff } }, { lastActiveAt: null },
        { accountStatus: { $ne: 'active' } }
      ] }, { $set: { isOnline: false } }, { returnDocument: 'after' });
      if (updated) {
        sessions.delete(String(user._id));
        emit(updated);
      }
    })));
  };
  const register = socket => {
    if (socket.userRole === 'admin') {
      const admin = socket.user;
      if (admin.isActive && (admin.isSuperAdmin || admin.permissions?.some(p =>
        p.resource === 'technician_jobs' && ['read', 'both'].includes(p.access)))) {
        socket.join(PRESENCE_ROOM);
      }
      return;
    }
    if (socket.userRole !== 'technician') return;
    let lastHeartbeat = -Infinity;
    socket.on('technician:heartbeat', (_payload, ack) => {
      if (now() - lastHeartbeat < 10_000) {
        if (typeof ack === 'function') ack({ success: true, throttled: true });
        return;
      }
      lastHeartbeat = now();
      touch(socket).then(presence => {
        if (typeof ack === 'function') ack({ success: Boolean(presence), ...presence });
      }).catch(() => {
        if (typeof ack === 'function') ack({ success: false, message: 'Presence update failed' });
      });
    });
    socket.on('disconnect', () => { disconnect(socket).catch(() => {}); });
    touch(socket).catch(() => {});
  };
  return {
    register, sweep,
    start() {
      if (timer) return;
      timer = setInterval(() => { sweep().catch(report); }, 15_000);
      timer.unref?.();
    },
    stop() { clearInterval(timer); timer = null; }
  };
}
module.exports = { createTechnicianPresence, isPresenceOnline, PRESENCE_TIMEOUT_MS };
