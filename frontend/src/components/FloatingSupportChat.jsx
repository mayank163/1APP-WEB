import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { FiMessageCircle, FiX } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { chatApi } from '../services/api';
import UserChat from '../pages/UserChat';
import './FloatingSupportChat.css';

export default function FloatingSupportChat() {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const { socket } = useSocket();
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const userId = user?._id;
    const participantType = user?.role === 'technician' ? 'technician' : 'user';
    const chatVisible = open || pathname === (participantType === 'technician' ? '/technician-chat' : '/support-chat');
    useEffect(() => {
        setUnreadCount(0);
        if (!userId) return undefined;
        let active = true;
        let revision = 0;
        const refresh = async () => {
            const current = ++revision;
            try {
                const response = await chatApi.getUnreadCount(participantType, userId);
                if (active && current === revision) setUnreadCount(response.data?.data?.unreadCount || 0);
            } catch { /* Keep the last known count while disconnected. */ }
        };
        const markRead = async () => {
            ++revision;
            setUnreadCount(0);
            try {
                await (participantType === 'technician' ? chatApi.markRead : chatApi.markUserRead)(userId);
            } catch { if (active) refresh(); }
        };
        const matches = payload => String(payload.participantId || payload.technicianId) === String(userId) &&
            (payload.participantType || 'technician') === participantType;
        const onMessage = ({ message }) => {
            if (!message || !matches(message) || message.senderRole !== 'admin') return;
            if (chatVisible) markRead(); else refresh();
        };
        const onRead = payload => {
            if (matches(payload) && String(payload.userId) === String(userId)) refresh();
        };
        const sync = () => chatVisible ? markRead() : refresh();
        sync();
        socket?.on('connect', sync);
        socket?.on('chat:message', onMessage);
        socket?.on('chat:read', onRead);
        window.addEventListener('focus', sync);
        return () => {
            active = false;
            socket?.off('connect', sync);
            socket?.off('chat:message', onMessage);
            socket?.off('chat:read', onRead);
            window.removeEventListener('focus', sync);
        };
    }, [userId, participantType, socket, chatVisible]);
    const launcher = useRef(null);
    const panel = useRef(null);
    const close = () => { setOpen(false); launcher.current?.focus(); };
    useEffect(() => {
        if (!open) return undefined;
        panel.current?.querySelector('button')?.focus();
        const onKey = event => { if (event.key === 'Escape') { setOpen(false); launcher.current?.focus(); } };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);
    return createPortal(<aside className="floating-support" aria-label="Support">
        {open && <section ref={panel} id="floating-support-panel" className="floating-support-panel" role="dialog" aria-label="Chat with Support">
            {user?._id ? <UserChat key={user._id} embedded onClose={close} manageRoom={pathname !== (user.role === 'technician' ? '/technician-chat' : '/support-chat')} /> : <div className="floating-support-signin">
                <button className="floating-support-close" onClick={close} aria-label="Close support chat"><FiX /></button>
                <span className="floating-support-icon"><FiMessageCircle /></span>
                <h2>Chat with Support</h2><p>Sign in to chat with our team about your bookings and get help.</p>
                <Link to="/login" onClick={close}>Sign in to chat</Link>
            </div>}
        </section>}
        <button ref={launcher} className="floating-support-launcher" type="button" onClick={() => open ? close() : setOpen(true)} aria-label={open ? 'Close support chat' : `Chat with Support${unreadCount ? `, ${unreadCount} unread messages` : ''}`} aria-expanded={open} aria-controls={open ? 'floating-support-panel' : undefined}>
            <span className="floating-support-icon">{open ? <FiX /> : <FiMessageCircle />}</span><span className="floating-support-label">Chat with Support</span>
            {!chatVisible && unreadCount > 0 && <span className="floating-support-unread" role="status" aria-label={`${unreadCount} unread support messages`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
    </aside>, document.body);
}
