import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiLoader, FiMessageCircle, FiPaperclip, FiPlus, FiSearch, FiSend, FiUsers } from 'react-icons/fi';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
import { getImageUrl } from '../utils/helpers';
import './TechnicianChat.css';

const keyOf = message => String(message._id || `${message.createdAt}-${message.senderId}`);
const timeOf = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const dateOf = value => value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
const imageOf = person => {
    const value = person?.role === 'technician' ? person.technicianProfile?.photoUrl : person?.profileImage;
    return getImageUrl(typeof value === 'object' ? value.url : value);
};
const initials = name => String(name || '?').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();

function Avatar({ person, large = false }) {
    const image = imageOf(person);
    return <span className={`chat-avatar${large ? ' chat-avatar-large' : ''}`}>{image ? <img src={image} alt="" /> : initials(person?.name)}</span>;
}

export default function TechnicianChat() {
    const [type, setType] = useState('technician');
    const [conversations, setConversations] = useState([]);
    const [selected, setSelected] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [typing, setTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const endRef = useRef(null);
    const typingTimer = useRef(null);
    const selectedParticipantId = selected?.participant?._id;

    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setSelected(null); setMessages([]);
        adminApi.getChatInbox(type).then(response => {
            if (!active) return;
            const list = response.data?.conversations || [];
            setConversations(list); setSelected(list[0] || null);
        }).catch(() => active && setError(`Unable to load ${type} conversations.`)).finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [type]);

    useEffect(() => {
        if (!selectedParticipantId) return undefined;
        let active = true;
        const id = selectedParticipantId;
        setMessages([]); setError(''); setTyping(false);
        const load = type === 'technician' ? adminApi.getChatMessages(id) : adminApi.getUserChatMessages(id);
        const markRead = type === 'technician' ? adminApi.markChatRead(id) : adminApi.markUserChatRead(id);
        load.then(response => active && setMessages(response.data?.messages || [])).catch(() => active && setError('Unable to load this conversation.'));
        setConversations(current => current.map(item => String(item.participant._id) === String(id) ? { ...item, unreadCount: 0 } : item));
        markRead.catch(() => {});
        socket.emit('chat:join', { participantType: type, participantId: id });
        const addMessage = ({ message }) => {
            if (String(message.participantId || message.technicianId) !== String(id)) return;
            setMessages(current => current.some(item => keyOf(item) === keyOf(message)) ? current : [...current, message]);
            setConversations(current => current.map(item => String(item.participant._id) === String(id)
                ? { ...item, lastMessage: message, unreadCount: 0 }
                : item));
            markRead.catch(() => {});
        };
        const onTyping = payload => payload.participantType === type && String(payload.participantId) === String(id) && payload.senderRole !== 'admin' && setTyping(payload.isTyping);
        socket.on('chat:message', addMessage); socket.on('chat:typing', onTyping);
        return () => { active = false; socket.emit('chat:leave', { participantType: type, participantId: id }); socket.off('chat:message', addMessage); socket.off('chat:typing', onTyping); };
    }, [selectedParticipantId, type]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

    const send = async event => {
        event.preventDefault();
        const id = selected?.participant?._id;
        if (sending || !id || (!text.trim() && !file)) return;
        setSending(true);
        try {
            if (file) {
                if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Choose an image or video file.');
                const formData = new FormData(); formData.append('file', file); if (text.trim()) formData.append('text', text.trim());
                await (type === 'technician' ? adminApi.sendChatMedia(id, formData) : adminApi.sendUserChatMedia(id, formData));
            } else {
                await new Promise((resolve, reject) => socket.emit('chat:send', { participantType: type, participantId: id, text: text.trim() }, result => result?.success ? resolve(result) : reject(new Error(result?.message || 'Message failed.'))));
            }
            setText(''); setFile(null); setError('');
        } catch (sendError) { setError(sendError.response?.data?.message || sendError.message); }
        finally { setSending(false); }
    };

    const onTextChange = event => {
        const value = event.target.value; setText(value);
        if (!selected?.participant?._id) return;
        socket.emit('chat:typing', { participantType: type, participantId: selected.participant._id, isTyping: Boolean(value.trim()) });
        clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => socket.emit('chat:typing', { participantType: type, participantId: selected.participant._id, isTyping: false }), 900);
    };

    const filtered = conversations.filter(item => item.participant.name?.toLowerCase().includes(search.trim().toLowerCase()));
    const person = selected?.participant;
    return <div className="admin-chat-page">
        <header className="admin-chat-heading"><div><span className="admin-chat-kicker"><FiMessageCircle /> SUPPORT INBOX</span><h1>Messages</h1><p>Stay close to every conversation.</p></div><div className="admin-chat-count"><FiUsers /> {conversations.length} {type === 'technician' ? 'technicians' : 'users'}</div></header>
        <section className="admin-chat-layout">
            <aside className="admin-chat-sidebar"><div className="chat-tabs"><button className={type === 'technician' ? 'active' : ''} onClick={() => setType('technician')}>Technicians</button><button className={type === 'user' ? 'active' : ''} onClick={() => setType('user')}>Users</button></div><div className="chat-search"><FiSearch /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search conversations" /></div><div className="chat-list">{loading ? <p className="chat-list-state">Loading conversations...</p> : filtered.map(item => <button key={item.participant._id} className={`chat-list-item ${selected?.participant._id === item.participant._id ? 'selected' : ''}`} onClick={() => setSelected(item)}><Avatar person={item.participant} /><span className="chat-list-copy"><strong>{item.participant.name}</strong><small>{item.lastMessage?.text || (item.lastMessage?.messageType === 'image' ? 'Photo' : item.lastMessage?.messageType === 'video' ? 'Video' : 'No messages yet')}</small></span><span className="chat-list-meta">{dateOf(item.lastMessage?.createdAt)}{item.unreadCount > 0 && <b>{item.unreadCount}</b>}</span></button>)}{!loading && !filtered.length && <p className="chat-list-state">No conversations found.</p>}</div></aside>
            <div className="admin-chat-conversation">{person ? <><div className="admin-chat-conversation-head"><Avatar person={person} large /><div><h2>{person.name}</h2><p>{type === 'technician' ? 'Technician' : 'Customer'} {person.isOnline ? <span className="online-dot">● Online</span> : `· ${person.email || 'Offline'}`}</p></div><button className="chat-head-action" title="New message"><FiPlus /></button></div><div className="admin-chat-thread" aria-live="polite">{!messages.length && !error ? <p className="admin-chat-empty">No messages yet.<br />Start the conversation below.</p> : messages.map(message => <article className={`admin-chat-message ${message.senderRole === 'admin' ? 'mine' : ''}`} key={keyOf(message)}><div className="admin-chat-bubble">{message.messageType === 'image' && <img src={message.media?.url} alt="Chat attachment" />}{message.messageType === 'video' && <video controls src={message.media?.url} />}{message.text && <p>{message.text}</p>}<time>{timeOf(message.createdAt)} {message.senderRole === 'admin' && <FiCheck />}</time></div></article>)}{typing && <div className="admin-chat-typing">{person.name} is typing...</div>}<div ref={endRef} /></div>{error && <p className="admin-chat-error" role="alert">{error}</p>}{file && <div className="chat-attachment">{file.name}<button type="button" onClick={() => setFile(null)} disabled={sending}>×</button></div>}<form className="admin-chat-composer" onSubmit={send}><label title="Attach image or video"><FiPaperclip /><input type="file" accept="image/*,video/*" onChange={event => setFile(event.target.files?.[0] || null)} disabled={sending} /></label><input value={text} onChange={onTextChange} placeholder="Write a message..." maxLength={4000} disabled={sending} /><button type="submit" title="Send message" disabled={sending || (!text.trim() && !file)}>{sending ? <FiLoader className="chat-send-spinner" /> : <FiSend />}</button></form></> : <div className="chat-no-selection"><FiMessageCircle /><h2>Select a conversation</h2><p>Choose a person from the inbox to start chatting.</p></div>}</div>
        </section>
    </div>;
}
