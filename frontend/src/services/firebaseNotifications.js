import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { toast } from 'react-toastify';
import API from './api';

const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let session = 0;
let pendingSetup = null;
let foregroundUnsubscribe = null;
let workerPromise = null;

const waitForActiveServiceWorker = async registration => {
  if (registration.active?.state === 'activated') return registration;
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('The notification service worker could not be activated. Reload the page and try again.');
  if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });

  await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', onStateChange);
      if (error) reject(error);
      else resolve();
    };
    const onStateChange = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('The notification service worker could not start. Reload the page and try again.'));
    };
    const timeout = setTimeout(() => finish(new Error('Notification setup timed out. Reload the page and try again.')), 15000);
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  });
  return registration;
};

const getServiceWorker = () => {
  if (!workerPromise) {
    // register() also checks for updates; a second update() can race installation.
    workerPromise = navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      .then(waitForActiveServiceWorker)
      .catch(error => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
};

export const stopBrowserNotifications = () => {
  session += 1;
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = null;
  pendingSetup = null;
};

// Startup passes requestPermission: false. Only an explicit click prompts the user.
export const enableBrowserNotifications = async ({ requestPermission = true } = {}) => {
  if (!('Notification' in window)) throw new Error('This browser does not support notifications.');
  if (!window.isSecureContext) throw new Error('Notifications require HTTPS (localhost is allowed for development).');
  if (!('serviceWorker' in navigator)) throw new Error('This browser does not support service workers.');

  const authToken = localStorage.getItem('1App_token');
  if (!authToken) return false;
  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked for this site. Allow them in the browser site settings, then try again.');
  }
  if (Notification.permission !== 'granted' && !requestPermission) return false;

  const missingConfig = Object.entries({ ...config, vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY })
    .filter(([, value]) => !value || value.startsWith('PASTE_'))
    .map(([key]) => key);
  if (missingConfig.length) throw new Error(`Firebase web configuration is incomplete. Missing: ${missingConfig.join(', ')}`);

  if (pendingSetup?.session === session) return pendingSetup.promise;
  const currentSession = session;
  const isCurrentSession = () => currentSession === session && localStorage.getItem('1App_token') === authToken;
  const promise = (async () => {
    // Keep the permission call before asynchronous SDK work to preserve the click gesture.
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error(`Notification permission is ${permission}.`);
    if (!isCurrentSession()) return false;
    if (!await isSupported()) throw new Error('Firebase notifications are not supported in this browser.');
    if (!isCurrentSession()) return false;

    const app = getApps().length ? getApps()[0] : initializeApp(config);
    const messaging = getMessaging(app);
    const registration = await getServiceWorker();
    if (!isCurrentSession()) return false;
    if (!foregroundUnsubscribe) {
      foregroundUnsubscribe = onMessage(messaging, payload => {
        if (!isCurrentSession() || document.visibilityState !== 'visible') return;
        const title = payload.notification?.title || payload.data?.title || 'New notification';
        const body = payload.notification?.body || payload.data?.body || '';
        toast.info(body ? `${title}: ${body}` : title);
        if (Notification.permission === 'granted') {
          registration.showNotification(title, {
            body,
            data: payload.data || {},
            icon: '/logo192.png',
            ...(payload.messageId && { tag: payload.messageId }),
          }).catch(() => {
            console.warn('[Firebase] Browser notification display failed. Check browser and system notification settings.');
          });
        }
      });
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!isCurrentSession()) return false;
    if (!token) throw new Error('Firebase did not return a browser token. Check the Firebase web app and VAPID key configuration.');
    await API.post('/notifications/token', { token });
    if (!isCurrentSession()) return false;
    localStorage.setItem('1App_fcm_token', token);
    return true;
  })();
  pendingSetup = { session: currentSession, promise };
  try {
    return await promise;
  } finally {
    if (pendingSetup?.promise === promise) pendingSetup = null;
  }
};
