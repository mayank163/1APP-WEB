// Credentials stay on the server. PAYPAL_ENV defaults to sandbox.
const isConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
const currency = () => (process.env.PAYPAL_CURRENCY || 'USD').toUpperCase();

async function request(path, { method = 'GET', body, requestId } = {}) {
    if (!isConfigured()) throw new Error('PayPal payments are not configured.');
    const environment = process.env.PAYPAL_ENV || 'sandbox';
    if (!['sandbox', 'live'].includes(environment)) throw new Error('PAYPAL_ENV must be sandbox or live.');
    const base = environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15000)
    });
    if (!tokenResponse.ok) throw new Error('Unable to authenticate with PayPal.');
    const token = await tokenResponse.json();
    const response = await fetch(`${base}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
            ...(requestId ? { 'PayPal-Request-Id': requestId } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('PayPal could not complete this request. Please retry.');
    return response.json();
}

module.exports = {
    isConfigured,
    currency,
    createOrder: ({ attemptId, amount }) => request('/v2/checkout/orders', {
        method: 'POST', requestId: `create-${attemptId}`,
        body: {
            intent: 'CAPTURE',
            purchase_units: [{ custom_id: attemptId, amount: { currency_code: currency(), value: (amount / 100).toFixed(2) } }]
        }
    }),
    getOrder: id => request(`/v2/checkout/orders/${encodeURIComponent(id)}`),
    captureOrder: (id, attemptId) => request(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
        method: 'POST', body: {}, requestId: `capture-${attemptId}`
    })
};
