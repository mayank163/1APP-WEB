import React, { useEffect, useRef, useState } from 'react';
import {
  FiImage,
  FiMessageCircle,
  FiPaperclip,
  FiPlus,
  FiSend,
  FiVideo,
  FiX,
} from 'react-icons/fi';

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

  return (
    <div className={embedded ? 'floating-support-conversation' : 'tech-chat-page support-chat-page'}>
      <section className="tech-chat-shell support-chat-shell">
        <header className="support-chat-header">
          <div className="support-chat-avatar">
            {embedded ? (
              <FiMessageCircle />
            ) : image ? (
              <img src={image} alt="" />
            ) : (
              initials(user?.name)
            )}
          </div>

          <div className="support-chat-person">
            <h1>{embedded ? 'OneApp Support' : user?.name || 'Customer'}</h1>
            <p>
              {embedded ? (
                connected ? 'Connected · Booking assistance & help' : 'Connecting to support…'
              ) : (
                <>
                  Customer <span>·</span> {user?.email || 'Support conversation'}
                </>
              )}
            </p>
          </div>

          {embedded ? (
            <button
              className="support-chat-new"
              type="button"
              onClick={onClose}
              aria-label="Close support chat"
            >
              <FiX />
            </button>
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
            messages.map((message) => (
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
                  <time>
                    {formatTime(message.createdAt)}{' '}
                    {message.senderRole === participantType && (
                      <span className="support-chat-check">✓</span>
                    )}
                  </time>
                </div>
              </article>
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
            value={text}
            onChange={onTextChange}
            placeholder={embedded ? 'Type your message to Support...' : 'Write a message...'}
            maxLength={4000}
            aria-label="Message"
          />

          <button type="submit" disabled={sending || (!text.trim() && !file)} title="Send message">
            <FiSend />
          </button>
        </form>

        <small className="tech-chat-hint">
          <FiVideo /> Images up to 5 MB, videos up to 50 MB
        </small>
      </section>
    </div>
  );
}
