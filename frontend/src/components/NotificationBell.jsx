import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import { toast } from 'react-toastify';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';
import { enableBrowserNotifications } from '../services/firebaseNotifications';

const PAGE_LIMIT = 10;

const NotificationBell = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [unread, setUnread] = useState(0);
  const [loadingMore, setLoadingMore] = useState(true);
  const wrapperRef = useRef(null);
  const nextPageRef = useRef(1);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const seenIdsRef = useRef(new Set());

  const loadNotifications = useCallback(async () => {
    if (isLoadingRef.current || !hasMoreRef.current) return;
    isLoadingRef.current = true;
    setLoadingMore(true);
    const page = nextPageRef.current;

    try {
      const { data } = await API.get('/notifications', { params: { page, limit: PAGE_LIMIT } });
      const notifications = data.data?.notifications || [];
      notifications.forEach(notification => seenIdsRef.current.add(notification._id));
      setItems(previous => {
        const existingIds = new Set(previous.map(item => item._id));
        return [...previous, ...notifications.filter(item => !existingIds.has(item._id))];
      });
      setUnread(data.data?.unreadCount || 0);
      const moreAvailable = data.pagination
        ? page < data.pagination.totalPages
        : notifications.length === PAGE_LIMIT;
      hasMoreRef.current = moreAvailable;
      nextPageRef.current = page + 1;
    } catch {
      toast.error('Could not load notifications. Please try again.');
    } finally {
      isLoadingRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNotification = ({ notification }) => {
      if (!notification) return;
      const isNew = !seenIdsRef.current.has(notification._id);
      seenIdsRef.current.add(notification._id);
      setItems(previous => [notification, ...previous.filter(item => item._id !== notification._id)]);
      if (isNew && !notification.isRead) setUnread(count => count + 1);
      toast.info(notification.message ? `${notification.title}: ${notification.message}` : notification.title || 'New notification');
    };
    socket.on('notification:new', onNotification);
    return () => socket.off('notification:new', onNotification);
  }, [socket]);

  const toggle = () => {
    setOpen(value => !value);
    setNotificationError('');
    enableBrowserNotifications().catch(error => setNotificationError(error.message || 'Could not enable browser notifications.'));
  };

  const openNotification = async (item) => {
    if (!item.isRead) {
      setItems(previous => previous.map(notification => notification._id === item._id ? { ...notification, isRead: true } : notification));
      setUnread(count => Math.max(0, count - 1));
      try {
        await API.patch(`/notifications/${encodeURIComponent(item._id)}/read`);
      } catch {
        setItems(previous => previous.map(notification => notification._id === item._id ? { ...notification, isRead: false } : notification));
        setUnread(count => count + 1);
      }
    }

    const jobId = item.data?.jobId;
    if (!jobId) return;
    setOpen(false);
    navigate(`/technician?jobId=${encodeURIComponent(jobId)}`);
  };

  const markAllRead = async () => {
    const previousItems = items;
    const previousUnread = unread;
    setItems(previousItems.map(item => ({ ...item, isRead: true })));
    setUnread(0);
    try {
      await API.patch('/notifications/read-all');
    } catch {
      setItems(previousItems);
      setUnread(previousUnread);
      toast.error('Could not mark notifications as read. Please try again.');
    }
  };

  const handleScroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 48) {
      loadNotifications();
    }
  };

  return (
    <div ref={wrapperRef} className="position-relative">
      <button type="button" className="btn p-0 border-0 bg-transparent text-dark" onClick={toggle} title="Notifications" aria-label="Notifications">
        <FaBell size={18} />
        {unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 9 }}>{unread}</span>}
      </button>
      {open && <div className="position-absolute end-0 mt-3 bg-white shadow border rounded-3 p-2" style={{ width: 320, zIndex: 1100 }}>
        <div className="d-flex align-items-center justify-content-between px-2 py-1">
          <div className="fw-bold">Notifications</div>
          <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={markAllRead} disabled={unread === 0}>
            Mark all read
          </button>
        </div>
        {notificationError && <div className="small text-danger px-2 py-2">{notificationError}</div>}
        <div onScroll={handleScroll} style={{ maxHeight: 320, overflowY: 'auto' }}>
          {items.length === 0 && !loadingMore ? <div className="text-muted small px-2 py-3">No notifications yet.</div> : items.map(item => (
            <button key={item._id} type="button" className="border-top px-2 py-2 text-start w-100 bg-white" onClick={() => openNotification(item)} style={{ borderLeft: 0, borderRight: 0, borderBottom: 0, cursor: item.data?.jobId ? 'pointer' : 'default' }}>
              <div className="small fw-semibold">{!item.isRead && <span className="d-inline-block rounded-circle bg-primary me-1" aria-label="Unread" style={{ width: 6, height: 6 }} />}{item.title}</div>
              <div className="small text-muted">{item.message}</div>
            </button>
          ))}
          {loadingMore && <div className="text-muted small text-center py-2">Loading notifications...</div>}
        </div>
      </div>}
    </div>
  );
};

export default NotificationBell;
