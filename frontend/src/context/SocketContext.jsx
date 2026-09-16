import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('1App_token');
        if (!token) return undefined;
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            withCredentials: true,
        });

        socketRef.current = socket;
        setSocket(socket);

        socket.on('connect', () => setConnected(true));
        socket.on('connect_error', error => {
            console.error('[Socket] connection failed:', error.message);
            setConnected(false);
        });
        socket.on('disconnect', () => setConnected(false));

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setSocket(null);
            setConnected(false);
        };
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
