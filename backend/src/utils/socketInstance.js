/**
 * Singleton holder for the Socket.IO server instance.
 * Call setIO(io) once in server.js, then call getIO() anywhere in the app.
 */
let _io = null;

const setIO = (io) => { _io = io; };
const getIO = () => {
    if (!_io) throw new Error('Socket.IO has not been initialised yet');
    return _io;
};

module.exports = { setIO, getIO };
