const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadWorker(app, windows = []) {
  const listeners = new Map();
  const calls = { shown: [], opened: [], skipped: 0, claimed: 0, firebaseClicks: 0 };
  let backgroundHandler;
  const addEventListener = (name, listener) => {
    listeners.set(name, [...(listeners.get(name) || []), listener]);
  };
  const self = {
    location: { origin: 'https://app.example', href: 'https://app.example/firebase-messaging-sw.js' },
    addEventListener,
    registration: {
      showNotification: (...args) => {
        calls.shown.push(args);
        return Promise.resolve('displayed');
      },
    },
    skipWaiting: async () => { calls.skipped += 1; },
    clients: {
      matchAll: async () => windows,
      openWindow: async url => { calls.opened.push(url); },
      claim: async () => { calls.claimed += 1; },
    },
  };
  const context = {
    self,
    URL,
    importScripts: () => assert.ok(listeners.get('notificationclick')?.length, 'click listener precedes Firebase imports'),
    firebase: {
      initializeApp: () => {},
      messaging: () => {
        addEventListener('notificationclick', () => { calls.firebaseClicks += 1; });
        return { onBackgroundMessage: handler => { backgroundHandler = handler; } };
      },
    },
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, '..', app, 'public/firebase-messaging-sw.js'), 'utf8'), context);

  async function dispatch(name, extra = {}) {
    const pending = [];
    const event = {
      ...extra,
      stopped: false,
      stopImmediatePropagation() { this.stopped = true; },
      waitUntil(promise) { pending.push(promise); },
    };
    for (const listener of listeners.get(name) || []) {
      if (event.stopped) break;
      listener(event);
    }
    await Promise.all(pending);
    return event;
  }

  return {
    calls,
    background: payload => backgroundHandler(payload),
    dispatch,
    click: data => dispatch('notificationclick', { notification: { data, close() { calls.closed = true; } } }),
  };
}

for (const [app, route] of [['frontend', '/technician'], ['admin', '/technician-jobs']]) {
  test(`${app}: Firebase notification payloads are not displayed twice`, async () => {
    const worker = loadWorker(app);
    await worker.background({ notification: { title: 'New job', body: 'Details' }, data: { jobId: '123' } });
    assert.equal(worker.calls.shown.length, 0);
  });

  test(`${app}: data-only payloads display once and return the display promise`, async () => {
    const worker = loadWorker(app);
    const payload = { title: 'New job', body: 'Details', jobId: '123' };
    assert.equal(await worker.background({ data: payload }), 'displayed');
    assert.equal(worker.calls.shown.length, 1);
    assert.equal(worker.calls.shown[0][0], payload.title);
    assert.equal(worker.calls.shown[0][1].data, payload);
    await worker.background({ data: { jobId: '123' } });
    assert.equal(worker.calls.shown.length, 1);
  });

  for (const dataShape of ['FCM_MSG', 'direct']) {
    test(`${app}: ${dataShape} notification clicks open the correct encoded job URL`, async () => {
      const worker = loadWorker(app);
      const data = { jobId: 'job/123?x=1', target: 'admin' };
      await worker.click(dataShape === 'FCM_MSG' ? { FCM_MSG: { data } } : data);
      assert.deepEqual(worker.calls.opened, [`https://app.example${route}?jobId=job%2F123%3Fx%3D1`]);
      assert.equal(worker.calls.closed, true);
      assert.equal(worker.calls.firebaseClicks, 0);
    });
  }

  test(`${app}: notifications without jobs open the app root`, async () => {
    const worker = loadWorker(app);
    await worker.click({ FCM_MSG: { notification: { title: 'Account updated' } } });
    assert.deepEqual(worker.calls.opened, ['https://app.example/']);
  });

  test(`${app}: click navigates and focuses a same-origin tab`, async () => {
    const navigated = [];
    let focused = 0;
    const worker = loadWorker(app, [
      { url: 'https://other.example/', navigate: () => assert.fail('must not navigate another origin') },
      {
        url: 'https://app.example/',
        navigate: async url => {
          navigated.push(url);
          return { focus: async () => { focused += 1; } };
        },
      },
    ]);
    await worker.click({ jobId: '123' });
    assert.deepEqual(navigated, [`https://app.example${route}?jobId=123`]);
    assert.equal(focused, 1);
    assert.deepEqual(worker.calls.opened, []);
  });

  test(`${app}: an existing destination tab is focused without reloading`, async () => {
    let focused = 0;
    const worker = loadWorker(app, [
      { url: 'https://app.example/', navigate: () => assert.fail('prefer the destination tab') },
      {
        url: `https://app.example${route}?jobId=123`,
        focus: async () => { focused += 1; },
        navigate: () => assert.fail('do not reload the destination tab'),
      },
    ]);
    await worker.click({ jobId: '123' });
    assert.equal(focused, 1);
    assert.deepEqual(worker.calls.opened, []);
  });

  for (const navigate of [async () => null, async () => { throw new Error('Tab closed'); }]) {
    test(`${app}: click opens a new window if the existing tab closes`, async () => {
      const worker = loadWorker(app, [{ url: 'https://app.example/', navigate }]);
      await worker.click({ jobId: '123' });
      assert.deepEqual(worker.calls.opened, [`https://app.example${route}?jobId=123`]);
    });
  }

  test(`${app}: worker upgrades skip waiting and claim clients`, async () => {
    const worker = loadWorker(app);
    await worker.dispatch('install');
    await worker.dispatch('activate');
    await worker.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    assert.equal(worker.calls.skipped, 2);
    assert.equal(worker.calls.claimed, 1);
  });
}
