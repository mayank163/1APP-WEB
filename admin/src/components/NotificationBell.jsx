import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
import { enableBrowserNotifications } from '../services/firebaseNotifications';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const unread = items.filter(item => !item.isRead).length;

  useEffect(() => {
    adminApi.getNotifications().then(response => setItems(response.data?.notifications || [])).catch(() => {});
    const onNotification = ({ notification }) => {
      if (!notification) return;
      setItems(previous => [notification, ...previous.filter(item => item._id !== notification._id)].slice(0, 50));
      toast.info(notification.message ? `${notification.title}: ${notification.message}` : notification.title || 'New notification');
    };
    socket.on('notification:new', onNotification);
    return () => socket.off('notification:new', onNotification);
  }, []);

  const toggle = () => {
    setOpen(value => !value);
    setNotificationError('');
    enableBrowserNotifications().catch(error => setNotificationError(error.message || 'Could not enable browser notifications.'));
  };

  const openNotification = async (item) => {
    if (!item.isRead) {
      setItems(previous => previous.map(notification => notification._id === item._id ? { ...notification, isRead: true } : notification));
      try {
        await adminApi.markNotificationRead(item._id);
      } catch {
        setItems(previous => previous.map(notification => notification._id === item._id ? { ...notification, isRead: false } : notification));
      }
    }

    const jobId = item.data?.jobId;
    if (!jobId) return;
    setOpen(false);
    navigate(`/technician-jobs?jobId=${encodeURIComponent(jobId)}`);
  };

  return (
    <div className="position-relative">
      <button type="button" className="btn p-0 border-0 bg-transparent" onClick={toggle} title="Notifications" aria-label="Notifications" style={{ color: '#A5732F' }}>
        <FaBell size={18} />
        {unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 9 }}>{unread}</span>}
      </button>
      {open && <div className="position-absolute end-0 mt-3 bg-white shadow border rounded-3 p-2" style={{ width: 340, zIndex: 1100 }}>
        <div className="fw-bold px-2 py-1">Notifications</div>
        {notificationError && <div className="small text-danger px-2 py-2">{notificationError}</div>}
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {items.length === 0 ? <div className="text-muted small px-2 py-3">No notifications yet.</div> : items.map(item => (
            <button key={item._id} type="button" className="border-top px-2 py-2 text-start w-100 bg-white" onClick={() => openNotification(item)} style={{ borderLeft: 0, borderRight: 0, borderBottom: 0, cursor: item.data?.jobId ? 'pointer' : 'default' }}><div className="small fw-semibold">{!item.isRead && <span className="d-inline-block rounded-circle bg-primary me-1" aria-label="Unread" style={{ width: 6, height: 6 }} />}{item.title}</div><div className="small text-muted">{item.message}</div></button>
          ))}
        </div>
      </div>}
    </div>
  );
};

export default NotificationBell;
