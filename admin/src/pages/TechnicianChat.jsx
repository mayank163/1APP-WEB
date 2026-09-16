import React, { useEffect, useRef, useState } from 'react';
import { FiMessageSquare, FiPaperclip, FiSend, FiUsers } from 'react-icons/fi';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
import './TechnicianChat.css';

const keyOf = message => String(message._id || `${message.createdAt}-${message.senderId}`);
const timeOf = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function TechnicianChat() {
    const [technicians, setTechnicians] = useState([]);
    const [selected, setSelected] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [typing, setTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const endRef = useRef(null);
    const typingTimer = useRef(null);

    useEffect(() => {
        adminApi.getTechnicians().then(response => {
            const list = response.data?.technicians || response.technicians || [];
            setTechnicians(list);
            setSelected(list[0] || null);
        }).catch(() => setError('Unable to load technicians.')).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selected?._id) return undefined;
        let active = true;
        setMessages([]); setError('');
        adminApi.getChatMessages(selected._id).then(response => active && setMessages(response.data?.messages || []))
            .catch(() => active && setError('Unable to load this conversation.'));
        adminApi.markChatRead(selected._id).catch(() => {});
        socket.emit('chat:join', selected._id);
        const addMessage = ({ message }) => {
            if (String(message.technicianId) !== String(selected._id)) return;
            setMessages(current => current.some(item => keyOf(item) === keyOf(message)) ? current : [...current, message]);
            adminApi.markChatRead(selected._id).catch(() => {});
        };
        const onTyping = payload => payload.senderRole === 'technician' && setTyping(payload.isTyping);
        socket.on('chat:message', addMessage); socket.on('chat:typing', onTyping);
        return () => {
            active = false; socket.emit('chat:leave', selected._id);
            socket.off('chat:message', addMessage); socket.off('chat:typing', onTyping);
        };
    }, [selected?._id]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

    const send = async event => {
        event.preventDefault();
        if (!selected?._id || (!text.trim() && !file)) return;
        setError('');
        try {
            if (file) {
                if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Choose an image or video file.');
                if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
                if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) throw new Error('Videos must be 50 MB or smaller.');
                const formData = new FormData(); formData.append('file', file); if (text.trim()) formData.append('text', text.trim());
                await adminApi.sendChatMedia(selected._id, formData);
            } else {
                await new Promise((resolve, reject) => socket.emit('chat:send', { technicianId: selected._id, text: text.trim() }, result => result?.success ? resolve(result) : reject(new Error(result?.message || 'Message failed.'))));
            }
            setText(''); setFile(null);
        } catch (sendError) { setError(sendError.response?.data?.message || sendError.message); }
    };

    const onTextChange = event => {
        const value = event.target.value; setText(value);
        if (!selected?._id) return;
        socket.emit('chat:typing', { technicianId: selected._id, isTyping: Boolean(value.trim()) });
        clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => socket.emit('chat:typing', { technicianId: selected._id, isTyping: false }), 900);
    };

    return <div className="admin-chat-page"><header className="admin-chat-heading"><div><span><FiMessageSquare /> OPERATIONS / SUPPORT</span><h1>Technician chat</h1><p>Keep support conversations close to the work.</p></div><div className="admin-chat-count"><FiUsers /> {technicians.length} technicians</div></header><section className="admin-chat-layout"><aside className="admin-chat-list"><h2>Technicians</h2>{loading ? <p>Loading...</p> : technicians.map(technician => <button key={technician._id} className={selected?._id === technician._id ? 'selected' : ''} onClick={() => setSelected(technician)}><strong>{technician.name}</strong><small>{technician.isOnline ? 'Online now' : technician.accountStatus || 'Offline'}</small></button>)}{!technicians.length && !loading && <p>No technicians found.</p>}</aside><div className="admin-chat-conversation"><div className="admin-chat-conversation-head"><div className="admin-chat-avatar">{selected?.name?.slice(0, 1).toUpperCase() || '?'}</div><div><h2>{selected?.name || 'Select a technician'}</h2><p>{selected?.email || 'Choose a technician to open support chat'}</p></div></div><div className="admin-chat-thread" aria-live="polite">{!selected ? <p className="admin-chat-empty">Select a technician to begin.</p> : !messages.length ? <p className="admin-chat-empty">No messages yet. Start the conversation.</p> : messages.map(message => <article className={`admin-chat-message ${message.senderRole === 'admin' ? 'mine' : ''}`} key={keyOf(message)}><div className="admin-chat-bubble">{message.messageType === 'image' && <img src={message.media?.url} alt="Chat attachment" />}{message.messageType === 'video' && <video controls src={message.media?.url} />}{message.text && <p>{message.text}</p>}<time>{timeOf(message.createdAt)}</time></div></article>)}{typing && <div className="admin-chat-typing">Technician is typing...</div>}<div ref={endRef} /></div>{error && <p className="admin-chat-error" role="alert">{error}</p>}{file && <div className="admin-chat-file">{file.name}<button type="button" onClick={() => setFile(null)}>Remove</button></div>}<form className="admin-chat-composer" onSubmit={send}><label title="Attach image or video"><FiPaperclip /><input type="file" accept="image/*,video/*,.heic,.heif" onChange={event => setFile(event.target.files?.[0] || null)} /></label><input value={text} onChange={onTextChange} placeholder={selected ? 'Write to the technician...' : 'Select a technician first'} disabled={!selected} maxLength={4000} /><button type="submit" disabled={!selected || (!text.trim() && !file)}><FiSend /></button></form></div></section></div>;
}