const jwt = require('jsonwebtoken');
const { randomBytes, createPublicKey } = require('crypto');
let cachedKeys;
let keysExpire = 0;
const failure = (message, statusCode = 401) => Object.assign(new Error(message), { statusCode });

exports.createAppleChallenge = () => {
    const nonce = randomBytes(32).toString('hex');
    return {
        nonce,
        challengeToken: jwt.sign({ nonce, type: 'apple-challenge' }, process.env.JWT_SECRET, {
            algorithm: 'HS256', expiresIn: '5m', issuer: '1App', audience: 'apple-auth'
        })
    };
};

exports.verifyAppleIdentity = async (identityToken, challengeToken) => {
    const audiences = [process.env.APPLE_IOS_BUNDLE_ID?.trim()].filter(Boolean);
    if (!audiences.length) throw failure('Apple sign-in is not configured.', 503);
    if (typeof identityToken !== 'string' || identityToken.length > 16384 || typeof challengeToken !== 'string' || challengeToken.length > 4096) {
        throw failure('Apple identity token and challenge token are required.', 400);
    }
    let challenge;
    let decoded;
    try {
        challenge = jwt.verify(challengeToken, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: '1App', audience: 'apple-auth' });
        decoded = jwt.decode(identityToken, { complete: true });
        if (challenge.type !== 'apple-challenge' || !decoded || decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') throw new Error();
    } catch (_) { throw failure('Invalid or expired Apple sign-in request.'); }
    if (!cachedKeys || Date.now() >= keysExpire) {
        try {
            const response = await fetch('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(5000) });
            if (!response.ok) throw new Error();
            const body = await response.json();
            if (!Array.isArray(body.keys)) throw new Error();
            cachedKeys = body.keys;
            keysExpire = Date.now() + 60 * 60 * 1000;
        } catch (_) { throw failure('Apple verification is temporarily unavailable.', 503); }
    }
    const key = cachedKeys.find(k => k.kid === decoded.header.kid && k.kty === 'RSA' && k.alg === 'RS256');
    if (!key) { keysExpire = 0; throw failure('Unknown Apple signing key. Please retry.'); }
    try {
        const claims = jwt.verify(identityToken, createPublicKey({ key, format: 'jwk' }), {
            algorithms: ['RS256'], issuer: 'https://appleid.apple.com', audience: audiences
        });
        if (!claims.sub || !claims.exp || claims.nonce !== challenge.nonce) throw new Error();
        return claims;
    } catch (_) { throw failure('Invalid or expired Apple identity token.'); }
};

// All signing and token encryption keys are backend-only secrets.
const { createCipheriv, createDecipheriv } = require('crypto');
const encryptionKey = () => {
    const key = Buffer.from(process.env.APPLE_TOKEN_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32) throw failure('Apple token encryption is not configured.', 503);
    return key;
};
exports.encryptAppleToken = token => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
};
exports.decryptAppleToken = value => {
    const data = Buffer.from(value, 'base64');
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8');
};
const appleRequest = async (endpoint, clientId, fields) => {
    const allowed = [process.env.APPLE_IOS_BUNDLE_ID?.trim()].filter(Boolean);
    if (!allowed.includes(clientId) || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
        throw failure('Apple server credentials are not configured.', 503);
    }
    let clientSecret;
    try {
        clientSecret = jwt.sign({}, process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), {
            algorithm: 'ES256', keyid: process.env.APPLE_KEY_ID, issuer: process.env.APPLE_TEAM_ID,
            subject: clientId, audience: 'https://appleid.apple.com', expiresIn: '5m'
        });
    } catch (_) { throw failure('Apple server credentials are invalid.', 503); }
    let response;
    try {
        response = await fetch(`https://appleid.apple.com/auth/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
            signal: AbortSignal.timeout(10000)
        });
    } catch (_) { throw failure('Apple authorization is temporarily unavailable. Please retry.', 503); }
    if (!response.ok) {
        let body;
        try { body = await response.json(); } catch (_) { /* Non-JSON upstream failure. */ }
        // Only expose known OAuth codes; never return tokens or raw Apple responses.
        const messages = {
            invalid_client: 'Apple rejected the server credentials. Check Team ID, Key ID, the Sign in with Apple key association, and bundle ID.',
            invalid_grant: 'Apple rejected the authorization code. Start a fresh Apple sign-in and send its code exactly once with the matching identity token.',
            invalid_request: 'Apple rejected the token request parameters.',
            unauthorized_client: 'This Apple client is not authorized for this operation.',
            unsupported_grant_type: 'Apple rejected the authorization grant type.',
            invalid_scope: 'Apple rejected the requested scope.'
        };
        const code = typeof body?.error === 'string' && Object.prototype.hasOwnProperty.call(messages, body.error) ? body.error : null;
        const message = code ? `Apple authorization failed (${code}). ${messages[code]}` : 'Apple authorization failed. Please authorize with Apple again or retry.';
        throw failure(message, response.status >= 500 ? 503 : 400);
    }
    if (endpoint === 'revoke') return;
    try { return await response.json(); }
    catch (_) { throw failure('Invalid response from Apple.', 502); }
};
exports.exchangeAppleCode = async (authorizationCode, claims, challengeToken) => {
    if (typeof authorizationCode !== 'string' || !authorizationCode.trim() || authorizationCode.length > 4096) {
        throw failure('Apple authorizationCode is required.', 400);
    }
    // Validate encryption configuration before consuming a single-use code.
    encryptionKey();
    const tokens = await appleRequest('token', claims.aud, {
        grant_type: 'authorization_code', code: authorizationCode
    });
    const exchanged = await exports.verifyAppleIdentity(tokens.id_token, challengeToken);
    if (exchanged.sub !== claims.sub || exchanged.aud !== claims.aud || typeof tokens.refresh_token !== 'string' || !tokens.refresh_token) {
        throw failure('Apple authorization does not match this sign-in.', 401);
    }
    return { subject: claims.sub, clientId: claims.aud, refreshToken: exports.encryptAppleToken(tokens.refresh_token) };
};
exports.revokeAppleGrant = async grant => appleRequest('revoke', grant.clientId, {
    token: exports.decryptAppleToken(grant.refreshToken), token_type_hint: 'refresh_token'
});
