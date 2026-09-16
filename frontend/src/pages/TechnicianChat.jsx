import React, { useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiPaperclip, FiSend, FiImage, FiVideo } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { chatApi } from '../services/api';
import './TechnicianChat.css';

const messageKey = message => String(message._id || `${message.createdAt}-${message.senderId}`);
const formatTime = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function TechnicianChat() {
    const { user } = useAuth();
    const { socket, connected } = useSocket();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [typing, setTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const endRef = useRef(null);
    const typingTimer = useRef(null);
    const technicianId = user?._id;

    useEffect(() => {
        if (!technicianId) return undefined;
        let active = true;
        chatApi.getMessages(technicianId).then(response => {
            if (active) setMessages(response.data?.data?.messages || []);
        }).catch(() => active && setError('Unable to load support messages.'))
            .finally(() => active && setLoading(false));
        chatApi.markRead(technicianId).catch(() => {});
        return () => { active = false; };
    }, [technicianId]);

    useEffect(() => {
        if (!socket || !technicianId) return undefined;
        const addMessage = ({ message }) => {
            if (String(message.technicianId) !== String(technicianId)) return;
            setMessages(current => current.some(item => messageKey(item) === messageKey(message)) ? current : [...current, message]);
            chatApi.markRead(technicianId).catch(() => {});
        };
        const onTyping = payload => payload.senderRole === 'admin' && setTyping(payload.isTyping);
        socket.emit('chat:join', technicianId);
        socket.on('chat:message', addMessage);
        socket.on('chat:typing', onTyping);
        return () => {
            socket.emit('chat:leave', technicianId);
            socket.off('chat:message', addMessage);
            socket.off('chat:typing', onTyping);
        };
    }, [socket, technicianId]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

    const onTextChange = event => {
        const value = event.target.value;
        setText(value);
        if (!socket || !technicianId) return;
        socket.emit('chat:typing', { technicianId, isTyping: Boolean(value.trim()) });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => socket.emit('chat:typing', { technicianId, isTyping: false }), 900);
    };

    const send = async event => {
        event.preventDefault();
        if (sending || (!text.trim() && !file) || !technicianId) return;
        setSending(true); setError('');
        try {
            if (file) {
                if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Choose an image or video file.');
                if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
                if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) throw new Error('Videos must be 50 MB or smaller.');
                const formData = new FormData();
                formData.append('file', file);
                if (text.trim()) formData.append('text', text.trim());
                await chatApi.sendMedia(technicianId, formData);
            } else {
                if (!socket || !connected) throw new Error('Chat is reconnecting. Please try again.');
                await new Promise((resolve, reject) => socket?.emit('chat:send', { technicianId, text: text.trim() }, result => result?.success ? resolve(result) : reject(new Error(result?.message || 'Message failed.'))));
            }
            setText(''); setFile(null);
        } catch (sendError) { setError(sendError.response?.data?.message || sendError.message || 'Message failed.'); }
        finally { setSending(false); }
    };

    return <main className="tech-chat-page">
        <header className="tech-chat-header"><button className="tech-chat-back" onClick={() => navigate('/technician')}>Back to dashboard</button><div><span className="tech-chat-kicker"><FiMessageCircle /> SUPPORT DESK</span><h1>Talk to support</h1><p>Share a question, photo, or video with the operations team.</p></div><span className={`tech-chat-status ${connected ? 'is-online' : ''}`}>{connected ? 'Live' : 'Connecting'}</span></header>
        <section className="tech-chat-shell">
            <div className="tech-chat-thread" aria-live="polite">
                {loading ? <p className="tech-chat-empty">Loading your conversation...</p> : !messages.length ? <p className="tech-chat-empty">Your support conversation will appear here.</p> : messages.map(message => <article className={`tech-chat-message ${message.senderRole === 'technician' ? 'mine' : ''}`} key={messageKey(message)}><div className="tech-chat-bubble">{message.messageType === 'image' && <img src={message.media?.url} alt="Support attachment" />} {message.messageType === 'video' && <video controls src={message.media?.url} />} {message.text && <p>{message.text}</p>}<time>{formatTime(message.createdAt)}</time></div></article>)}
                {typing && <div className="tech-chat-typing">Support is typing<span>•••</span></div>}
                <div ref={endRef} />
            </div>
            {error && <p className="tech-chat-error" role="alert">{error}</p>}
            {file && <div className="tech-chat-attachment"><FiImage />{file.name}<button type="button" onClick={() => setFile(null)}>Remove</button></div>}
            <form className="tech-chat-composer" onSubmit={send}><label className="tech-chat-attach" title="Attach image or video"><FiPaperclip /><input type="file" accept="image/*,video/*,.heic,.heif" onChange={event => setFile(event.target.files?.[0] || null)} /></label><input value={text} onChange={onTextChange} placeholder="Write a message..." maxLength={4000} aria-label="Message" /><button type="submit" disabled={sending || (!text.trim() && !file)} title="Send message"><FiSend /></button></form>
            <small className="tech-chat-hint"><FiVideo /> Images up to 5 MB, videos up to 50 MB</small>
        </section>
    </main>;
}