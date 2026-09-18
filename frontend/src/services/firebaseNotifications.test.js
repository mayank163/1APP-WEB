jest.mock('firebase/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
}));
jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  isSupported: jest.fn(),
  onMessage: jest.fn(),
}));
jest.mock('react-toastify', () => ({ toast: { info: jest.fn() } }));
jest.mock('./api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const firebaseEnvironmentKeys = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_VAPID_KEY',
];
const originalEnvironment = Object.fromEntries(
  firebaseEnvironmentKeys.map(key => [key, process.env[key]])
);
const originalProperties = [
  [window, 'Notification'],
  [window, 'isSecureContext'],
  [navigator, 'serviceWorker'],
  [document, 'visibilityState'],
].map(([object, key]) => [object, key, Object.getOwnPropertyDescriptor(object, key)]);

let enableBrowserNotifications;
let stopBrowserNotifications;
let messaging;
let toast;
let registerToken;
let registration;
let unsubscribe;

beforeEach(() => {
  jest.resetModules();
  localStorage.clear();
  localStorage.setItem('1App_token', 'authenticated-session');
  firebaseEnvironmentKeys.forEach(key => {
    process.env[key] = 'test-firebase-value';
  });

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission: 'granted', requestPermission: jest.fn().mockResolvedValue('granted') },
  });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  registration = {
    active: { state: 'activated' },
    showNotification: jest.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: jest.fn().mockResolvedValue(registration) },
  });

  const firebaseApp = require('firebase/app');
  firebaseApp.getApps.mockReturnValue([{}]);
  messaging = require('firebase/messaging');
  messaging.getMessaging.mockReturnValue({});
  messaging.isSupported.mockResolvedValue(true);
  messaging.getToken.mockResolvedValue('browser-token');
  unsubscribe = jest.fn();
  messaging.onMessage.mockReturnValue(unsubscribe);
  toast = require('react-toastify').toast;
  registerToken = require('./api').default.post;
  registerToken.mockResolvedValue({});
  ({ enableBrowserNotifications, stopBrowserNotifications } = require('./firebaseNotifications'));
});

afterEach(() => {
  stopBrowserNotifications();
  localStorage.clear();
});

afterAll(() => {
  originalProperties.forEach(([object, key, descriptor]) => {
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else delete object[key];
  });
  Object.entries(originalEnvironment).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});

test('restores notifications on startup when permission is already granted', async () => {
  await expect(enableBrowserNotifications({ requestPermission: false })).resolves.toBe(true);

  expect(Notification.requestPermission).not.toHaveBeenCalled();
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
    '/firebase-messaging-sw.js', { scope: '/' }
  );
  expect(messaging.getToken).toHaveBeenCalledWith(expect.anything(), {
    vapidKey: 'test-firebase-value',
    serviceWorkerRegistration: registration,
  });
  expect(registerToken).toHaveBeenCalledWith('/notifications/token', { token: 'browser-token' });
  expect(localStorage.getItem('1App_fcm_token')).toBe('browser-token');
});

test('startup leaves default permission untouched until an explicit click', async () => {
  Notification.permission = 'default';

  await expect(enableBrowserNotifications({ requestPermission: false })).resolves.toBe(false);

  expect(Notification.requestPermission).not.toHaveBeenCalled();
  expect(messaging.isSupported).not.toHaveBeenCalled();
  expect(messaging.getToken).not.toHaveBeenCalled();
  expect(registerToken).not.toHaveBeenCalled();
});

test('an explicit click requests permission before asynchronous Firebase support checks', async () => {
  Notification.permission = 'default';
  const permission = deferred();
  Notification.requestPermission.mockReturnValue(permission.promise);

  const setup = enableBrowserNotifications();

  expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  expect(messaging.isSupported).not.toHaveBeenCalled();
  Notification.permission = 'granted';
  permission.resolve('granted');

  await expect(setup).resolves.toBe(true);
  expect(messaging.isSupported).toHaveBeenCalledTimes(1);
});

test('foreground messages display a toast and a service-worker browser notification', async () => {
  await enableBrowserNotifications({ requestPermission: false });
  const receiveMessage = messaging.onMessage.mock.calls[0][1];
  const payload = {
    messageId: 'message-123',
    notification: { title: 'Job available', body: 'A new job needs your attention.' },
    data: { url: '/jobs/job-123' },
  };

  receiveMessage(payload);

  expect(toast.info).toHaveBeenCalledWith('Job available: A new job needs your attention.');
  expect(registration.showNotification).toHaveBeenCalledWith('Job available', {
    body: 'A new job needs your attention.',
    data: payload.data,
    icon: '/logo192.png',
    tag: 'message-123',
  });

  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  receiveMessage(payload);
  expect(registration.showNotification).toHaveBeenCalledTimes(1);
});

test('concurrent and repeated setup keeps only one foreground listener', async () => {
  await Promise.all([
    enableBrowserNotifications({ requestPermission: false }),
    enableBrowserNotifications({ requestPermission: false }),
  ]);
  expect(messaging.getToken).toHaveBeenCalledTimes(1);
  expect(registerToken).toHaveBeenCalledTimes(1);

  await enableBrowserNotifications({ requestPermission: false });

  expect(messaging.onMessage).toHaveBeenCalledTimes(1);
  expect(navigator.serviceWorker.register).toHaveBeenCalledTimes(1);
});

test('registration failures reach the caller and a subsequent attempt retries successfully', async () => {
  registerToken.mockRejectedValueOnce(new Error('Token registration failed'));

  await expect(enableBrowserNotifications()).rejects.toThrow('Token registration failed');
  expect(localStorage.getItem('1App_fcm_token')).toBeNull();

  await expect(enableBrowserNotifications()).resolves.toBe(true);
  expect(registerToken).toHaveBeenCalledTimes(2);
  expect(messaging.onMessage).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('1App_fcm_token')).toBe('browser-token');
});

test('does not cache the Firebase token until the backend confirms registration', async () => {
  const registrationStarted = deferred();
  const acknowledgement = deferred();
  registerToken.mockImplementationOnce(() => {
    registrationStarted.resolve();
    return acknowledgement.promise;
  });

  const setup = enableBrowserNotifications();
  await registrationStarted.promise;
  expect(localStorage.getItem('1App_fcm_token')).toBeNull();

  acknowledgement.resolve({});
  await expect(setup).resolves.toBe(true);
  expect(localStorage.getItem('1App_fcm_token')).toBe('browser-token');
});

test('cleanup followed by immediate startup survives React StrictMode cancellation', async () => {
  const oldSupportCheck = deferred();
  messaging.isSupported.mockReturnValueOnce(oldSupportCheck.promise);
  const oldSetup = enableBrowserNotifications({ requestPermission: false });

  stopBrowserNotifications();
  const newSetup = enableBrowserNotifications({ requestPermission: false });
  await expect(newSetup).resolves.toBe(true);
  oldSupportCheck.resolve(true);

  await expect(oldSetup).resolves.toBe(false);
  expect(messaging.onMessage).toHaveBeenCalledTimes(1);
  expect(registerToken).toHaveBeenCalledTimes(1);
  messaging.onMessage.mock.calls[0][1]({ data: { title: 'Current session', body: 'Works' } });
  expect(registration.showNotification).toHaveBeenCalledWith(
    'Current session', expect.objectContaining({ body: 'Works' })
  );
});

test('session cleanup cancels pending old tokens and preserves the new account listener', async () => {
  const tokenRequested = deferred();
  const oldToken = deferred();
  messaging.getToken.mockImplementationOnce(() => {
    tokenRequested.resolve();
    return oldToken.promise;
  });
  const oldSetup = enableBrowserNotifications({ requestPermission: false });
  await tokenRequested.promise;
  const oldReceiveMessage = messaging.onMessage.mock.calls[0][1];

  stopBrowserNotifications();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  localStorage.setItem('1App_token', 'new-authenticated-session');
  await expect(enableBrowserNotifications({ requestPermission: false })).resolves.toBe(true);
  oldToken.resolve('stale-browser-token');

  await expect(oldSetup).resolves.toBe(false);
  expect(registerToken).toHaveBeenCalledTimes(1);
  expect(registerToken).toHaveBeenCalledWith('/notifications/token', { token: 'browser-token' });
  expect(localStorage.getItem('1App_fcm_token')).toBe('browser-token');
  expect(messaging.onMessage).toHaveBeenCalledTimes(2);

  oldReceiveMessage({ data: { title: 'Old account' } });
  expect(registration.showNotification).not.toHaveBeenCalled();
  messaging.onMessage.mock.calls[1][1]({ data: { title: 'New account' } });
  expect(registration.showNotification).toHaveBeenCalledWith(
    'New account', expect.objectContaining({ body: '' })
  );
});
