import React, { useEffect, useRef, useState } from 'react';
import {
  FiImage,
  FiMessageCircle,
  FiPaperclip,
  FiPlus,
  FiPhone,
  FiSmile,
  FiShield,
  FiCheck,
  FiSend,
  FiVideo,
  FiX,
} from 'react-icons/fi';

import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { chatApi } from '../services/api';
import './TechnicianChat.css';
import './SupportChatScrollbar.css';

const messageKey = (message) =>
  String(message._id || `${message.createdAt}-${message.senderId}`);
const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
const avatarValue = (user) =>
  typeof user?.profileImage === 'object' ? user.profileImage?.url : user?.profileImage;
const initials = (name) =>
  String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export default function UserChat({ embedded = false, onClose, manageRoom = true }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const composerRef = useRef(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const userId = user?._id;
  const participantType = user?.role === 'technician' ? 'technician' : 'user';

  useEffect(() => {
    if (!userId) return undefined;

    let active = true;

    (participantType === 'technician' ? chatApi.getMessages : chatApi.getUserMessages)(userId)
      .then((response) => active && setMessages(response.data?.data?.messages || []))
      .catch(() => active && setError('Unable to load support messages.'))
      .finally(() => active && setLoading(false));

    (participantType === 'technician' ? chatApi.markRead : chatApi.markUserRead)(userId).catch(() => {});

    return () => {
      active = false;
    };
  }, [userId, participantType]);

  useEffect(() => {
    if (!socket || !userId) return undefined;

    const addMessage = ({ message }) => {
      if (String(message.participantId || message.technicianId) !== String(userId)) return;

      setMessages((current) =>
        current.some((item) => messageKey(item) === messageKey(message))
          ? current
          : [...current, message],
      );

      (participantType === 'technician' ? chatApi.markRead : chatApi.markUserRead)(userId).catch(() => {});
    };

    const onTyping = (payload) =>
      (payload.participantType || 'technician') === participantType &&
      String(payload.participantId || payload.technicianId) === String(userId) &&
      payload.senderRole === 'admin' &&
      setTyping(payload.isTyping);

    const join = () =>
      manageRoom && socket.emit('chat:join', { participantType, participantId: userId });

    join();
    socket.on('connect', join);
    socket.on('chat:message', addMessage);
    socket.on('chat:typing', onTyping);

    return () => {
      socket.off('connect', join);
      if (manageRoom) socket.emit('chat:leave', { participantType, participantId: userId });
      socket.off('chat:message', addMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [socket, userId, manageRoom, participantType]);

  useEffect(() => {
    const thread = endRef.current?.parentElement;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, typing]);

  useEffect(() => () => {
    clearTimeout(typingTimer.current);
  }, []);

  const onTextChange = (event) => {
    const value = event.target.value;
    setText(value);

    if (!socket || !userId) return;

    socket.emit('chat:typing', {
      participantType,
      participantId: userId,
      isTyping: Boolean(value.trim()),
    });

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () =>
        socket.emit('chat:typing', {
          participantType,
          participantId: userId,
          isTyping: false,
        }),
      900,
    );
  };

  const send = async (event) => {
    event.preventDefault();
    if (sending || (!text.trim() && !file) || !userId) return;

    setSending(true);
    setError('');

    try {
      if (file) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          throw new Error('Choose an image or video file.');
        }

        const formData = new FormData();
        formData.append('file', file);

        if (text.trim()) formData.append('text', text.trim());

        await (participantType === 'technician'
          ? chatApi.sendMedia
          : chatApi.sendUserMedia)(userId, formData);
      } else {
        if (!socket || !connected) {
          throw new Error('Chat is reconnecting. Please try again.');
        }

        await new Promise((resolve, reject) =>
          socket.emit(
            'chat:send',
            { participantType, participantId: userId, text: text.trim() },
            (result) =>
              result?.success ? resolve(result) : reject(new Error(result?.message || 'Message failed.')),
          ),
        );
      }

      setText('');
      setFile(null);
    } catch (sendError) {
      setError(sendError.response?.data?.message || sendError.message);
    } finally {
      setSending(false);
    }
  };

  const image = avatarValue(user);
  const draftReply = value => { setText(value); composerRef.current?.focus(); };
  const dayLabel = value => {
    const day = new Date(value);
    return day.toDateString() === new Date().toDateString() ? 'Today' : day.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className={embedded ? 'floating-support-conversation' : 'tech-chat-page support-chat-page'}>
      <section className="tech-chat-shell support-chat-shell">
        <header className="support-chat-header">
          <div className="support-chat-avatar">
            {embedded ? (
              <span className="support-agent-monogram"><FiMessageCircle /></span>
            ) : image ? (
              <img src={image} alt="" />
            ) : (
              initials(user?.name)
            )}
          </div>

          <div className="support-chat-person">
            <div className="support-agent-title"><h1>{embedded ? 'OneApp Support' : user?.name || 'Customer'}</h1>{embedded && <span className={`support-active-badge ${connected ? '' : 'reconnecting'}`}>{connected ? 'Active Support' : 'Connecting'}</span>}</div>
            <p>
              {embedded ? (
                'Booking Assistance & Help'
              ) : (
                <>
                  Customer <span>·</span> {user?.email || 'Support conversation'}
                </>
              )}
            </p>
          </div>

          {embedded ? (
            <div className="support-header-actions">
              <Link className="support-contact-action" to="/contact" title="Contact support" aria-label="Contact support" onClick={onClose}><FiPhone /></Link>
              <button className="support-chat-new" type="button" onClick={onClose} aria-label="Close support chat"><FiX /></button>
            </div>
          ) : (
            <button className="support-chat-new" type="button" title="New message">
              <FiPlus />
            </button>
          )}
        </header>

        <div className="tech-chat-thread" aria-live="polite">
          {loading ? (
            <p className="tech-chat-empty">Loading your conversation...</p>
          ) : !messages.length ? (
            <p className="tech-chat-empty">Your support conversation will appear here.</p>
          ) : (
            messages.map((message, index) => (
              <React.Fragment key={messageKey(message)}>
              {embedded && (index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(message.createdAt).toDateString()) && <div className="support-date-divider"><span>{dayLabel(message.createdAt)}, {formatTime(message.createdAt)}</span></div>}
              <article
                className={`tech-chat-message ${message.senderRole === participantType ? 'mine' : ''}`}
                key={messageKey(message)}
              >
                <div className="tech-chat-bubble">
                  {message.messageType === 'image' && (
                    <img src={message.media?.url} alt="Support attachment" />
                  )}
                  {message.messageType === 'video' && (
                    <video controls src={message.media?.url} />
                  )}
                  {message.text && <p>{message.text}</p>}
                  {!embedded && <time>{formatTime(message.createdAt)}{message.senderRole === participantType && <span className="support-chat-check"> ✓</span>}</time>}
                </div>
                {embedded && <time className="support-message-time">{formatTime(message.createdAt)}{message.senderRole === participantType && <span className={`support-delivery ${message.readBy?.some(reader => String(reader.userId) !== String(userId)) ? 'read' : ''}`} title={message.readBy?.some(reader => String(reader.userId) !== String(userId)) ? 'Read' : 'Sent'}><FiCheck /><FiCheck /></span>}</time>}
              </article>
              </React.Fragment>
            ))
          )}

          {typing && (
            <div className="tech-chat-typing">
              Support is typing<span>•••</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p className="tech-chat-error" role="alert">
            {error}
          </p>
        )}

        {file && (
          <div className="tech-chat-attachment">
            <FiImage />
            {file.name}
            <button type="button" onClick={() => setFile(null)}>
              Remove
            </button>
          </div>
        )}

        {embedded && <div className="support-quick-replies" aria-label="Quick replies">{['Yes, please reschedule to 2 PM 👍', 'Check other dates', 'Talk to an agent'].map(reply => <button type="button" key={reply} onClick={() => draftReply(reply)}>{reply}</button>)}</div>}
        {embedded && emojiOpen && <div className="support-emoji-picker" aria-label="Choose emoji">{['😊', '👍', '🙏', '❤️', '👋', '✅'].map(emoji => <button key={emoji} type="button" onClick={() => { draftReply((text + emoji).slice(0, 4000)); setEmojiOpen(false); }}>{emoji}</button>)}</div>}
        <form className="tech-chat-composer" onSubmit={send}>
          <label className="tech-chat-attach" title="Attach image or video">
            <FiPaperclip />
            <input
              type="file"
              accept="image/*,video/*,.heic,.heif"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <input
            ref={composerRef}
            value={text}
            onChange={onTextChange}
            placeholder={embedded ? 'Type your message to Support...' : 'Write a message...'}
            maxLength={4000}
            aria-label="Message"
          />

          {embedded && <button className="support-emoji-toggle" type="button" aria-label="Choose emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}><FiSmile /></button>}
          <button type="submit" disabled={sending || (!text.trim() && !file)} title="Send message">
            <FiSend />
          </button>
        </form>

        <small className="tech-chat-hint">
          {embedded ? <><FiShield /> Live Support · Your conversation stays in your account</> : <><FiVideo /> Images up to 5 MB, videos up to 50 MB</>}
        </small>
      </section>
    </div>
  );
}
