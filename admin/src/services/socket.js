import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

// Single shared socket instance for the admin portal
const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    withCredentials: true,
    autoConnect: true,
});

socket.on('connect', () => {
    console.log('[Admin Socket] connected:', socket.id);
    socket.emit('admin:join');
});
socket.on('disconnect', () => console.log('[Admin Socket] disconnected'));

export default socket;
