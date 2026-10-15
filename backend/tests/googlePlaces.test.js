const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const places = require('../src/services/googlePlaces');
const originalKey = process.env.GOOGLE_PLACES_API_KEY;
beforeEach(() => { process.env.GOOGLE_PLACES_API_KEY = 'test-server-key'; });
afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});
const token = '12345678-1234-4234-8234-123456789abc';
const ok = body => async () => ({ ok: true, json: async () => body });
const component = (type, longText) => ({ types: [type], longText });

test('autocomplete forwards the session token and normalizes only place predictions', async () => {
    const result = await places.autocomplete({ input: ' Main ', sessionToken: token }, async (url, options) => {
        assert.equal(url, 'https://places.googleapis.com/v1/places:autocomplete');
        assert.deepEqual(JSON.parse(options.body), { input: 'Main', sessionToken: token, includeQueryPredictions: false });
        assert.equal(options.headers['X-Goog-Api-Key'], 'test-server-key');
        assert.match(options.headers['X-Goog-FieldMask'], /placeId/);
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal);
        return { ok: true, json: async () => ({ suggestions: [
            { queryPrediction: { text: { text: 'ignore' } } },
            { placePrediction: { placeId: 'place-1', text: { text: 'Main, City' }, structuredFormat: { mainText: { text: 'Main' }, secondaryText: { text: 'City' } } } },
            { placePrediction: {} },
        ] }) };
    });
    assert.deepEqual(result, { suggestions: [{ placeId: 'place-1', description: 'Main, City', mainText: 'Main', secondaryText: 'City' }] });
    assert.deepEqual(await places.autocomplete({ input: 'Main', sessionToken: token }, ok({})), { suggestions: [] });
});

test('invalid inputs are rejected before any upstream request', async () => {
    const unexpected = async () => { assert.fail('Must not call Google'); };
    for (const body of [{}, { input: 123, sessionToken: token }, { input: 'x'.repeat(301), sessionToken: token }, { input: 'Main', sessionToken: '../bad' }, { input: 'Main', sessionToken: 'a'.repeat(37) }]) {
        await assert.rejects(places.autocomplete(body, unexpected), { status: 400 });
    }
    for (const placeId of ['', '../place', 'place?key=secret', {}, 'a'.repeat(513)]) {
        await assert.rejects(places.details({ placeId, sessionToken: token }, unexpected), { status: 400 });
    }
});

test('details maps address types with ordered city fallback and accepts zero coordinates', async () => {
    const data = await places.details({ placeId: 'place-1', sessionToken: token }, async (url, options) => {
        assert.equal(url, `https://places.googleapis.com/v1/places/place-1?sessionToken=${token}`);
        assert.equal(options.method, 'GET');
        assert.equal(options.headers['X-Goog-FieldMask'], 'id,formattedAddress,addressComponents,location');
        return { ok: true, json: async () => ({
            formattedAddress: '12 Main, City', location: { latitude: 0, longitude: 0 },
            addressComponents: [component('sublocality_level_1', 'Neighborhood'), component('locality', 'City'), component('route', 'Main'), component('street_number', '12'), component('postal_code', '00123')],
        }) };
    });
    assert.deepEqual(data, { address: '12 Main, City', addressLine: '12 Main', city: 'City', state: '', zipcode: '00123', lat: 0, lng: 0 });
    const fallback = await places.details({ placeId: 'place-1', sessionToken: token }, ok({ formattedAddress: 'Town', location: { latitude: 1, longitude: 2 } }));
    assert.equal(fallback.addressLine, 'Town');
    assert.equal(fallback.city, '');
});

test('details rejects missing, nonnumeric, and out-of-range coordinates', async () => {
    for (const location of [undefined, { latitude: '0', longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }]) {
        await assert.rejects(places.details({ placeId: 'place-1', sessionToken: token }, ok({ location })), { status: 422 });
    }
});

test('missing configuration, upstream failures and timeouts return controlled errors', async () => {
    const body = { input: 'Main', sessionToken: token };
    delete process.env.GOOGLE_PLACES_API_KEY;
    await assert.rejects(places.autocomplete(body, async () => assert.fail('Network called')), { status: 503 });
    process.env.GOOGLE_PLACES_API_KEY = 'test-server-key';
    for (const [upstream, expected] of [[403, 502], [429, 429], [500, 502], [404, 404]]) {
        await assert.rejects(places.autocomplete(body, async () => ({ ok: false, status: upstream })), error => error.status === expected && !error.message.includes('test-server-key'));
    }
    await assert.rejects(places.autocomplete(body, async () => { throw new Error('secret upstream URL'); }), { status: 502, message: 'Address search is temporarily unavailable.' });
    await assert.rejects(places.autocomplete(body, async () => { throw Object.assign(new Error(), { name: 'TimeoutError' }); }), { status: 504 });
    await assert.rejects(places.autocomplete(body, async () => ({ ok: true, json: async () => { throw new SyntaxError(); } })), { status: 502 });
});

test('mounted routes enforce authentication and return the Flutter response envelope', async () => {
    const express = require('express');
    const authPath = require.resolve('../src/middleware/auth');
    const previousAuth = require.cache[authPath];
    const originalFetch = global.fetch;
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
        protect: (req, res, next) => {
            if (req.headers.authorization !== 'Bearer test') return res.status(401).json({ success: false });
            req.user = { _id: 'test-user' }; next();
        },
    } };
    const app = express();
    app.use(express.json());
    const routesPath = require.resolve('../src/routes/placesRoutes');
    delete require.cache[routesPath];
    app.use('/api/places', require(routesPath));
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}/api/places`;
        const post = (path, body, auth = true) => originalFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test' } : {}) }, body: JSON.stringify(body) });
        let upstreamCalls = 0;
        global.fetch = async () => { upstreamCalls++; return { ok: true, json: async () => ({}) }; };
        assert.equal((await post('/autocomplete', {}, false)).status, 401);
        assert.equal((await post('/details', {}, false)).status, 401);
        assert.equal((await post('/details', {})).status, 400);
        assert.equal(upstreamCalls, 0);
        const response = await post('/autocomplete', { input: 'Main', sessionToken: token });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { success: true, data: { suggestions: [] } });
        global.fetch = ok({ formattedAddress: 'Main', location: { latitude: 0, longitude: 2 } });
        const details = await post('/details', { placeId: 'place-1', sessionToken: token });
        assert.equal(details.status, 200);
        assert.equal((await details.json()).data.lat, 0);
        for (let i = 0; i < 117; i++) await post('/autocomplete', { input: 'Main', sessionToken: token });
        const limited = await post('/autocomplete', { input: 'Main', sessionToken: token });
        assert.equal(limited.status, 429);
        assert.equal((await limited.json()).success, false);
    } finally {
        global.fetch = originalFetch;
        if (previousAuth) require.cache[authPath] = previousAuth;
        else delete require.cache[authPath];
        delete require.cache[routesPath];
        await new Promise(resolve => server.close(resolve));
    }
});
