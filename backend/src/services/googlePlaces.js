const fail = (status, message) => Object.assign(new Error(message), { status });

function requiredText(value, field, maxLength) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        throw fail(400, `${field} must be a nonempty string of at most ${maxLength} characters.`);
    }
    return value.trim();
}

function sessionToken(value) {
    const token = requiredText(value, 'sessionToken', 36);
    if (!/^[A-Za-z0-9_-]+$/.test(token)) throw fail(400, 'sessionToken must contain only URL-safe characters.');
    return token;
}

async function request(path, fieldMask, body, fetchImpl = globalThis.fetch) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key?.trim()) throw fail(503, 'Address search is not configured.');
    try {
        const response = await fetchImpl(`https://places.googleapis.com/v1/${path}`, {
            method: body ? 'POST' : 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': fieldMask,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(10000),
            redirect: 'error',
        });
        if (!response.ok) {
            if (response.status === 429) throw fail(429, 'Address search is busy. Please try again shortly.');
            if (response.status === 404) throw fail(404, 'This place is unavailable. Please search again.');
            throw fail(502, 'Address search is temporarily unavailable.');
        }
        return await response.json();
    } catch (error) {
        if (error.status) throw error;
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            throw fail(504, 'Address search timed out. Please try again.');
        }
        throw fail(502, 'Address search is temporarily unavailable.');
    }
}

async function autocomplete(body = {}, fetchImpl) {
    const input = requiredText(body.input, 'input', 300);
    const token = sessionToken(body.sessionToken);
    const result = await request('places:autocomplete',
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
        { input, sessionToken: token, includeQueryPredictions: false }, fetchImpl);
    return {
        suggestions: (Array.isArray(result?.suggestions) ? result.suggestions : [])
            .map(item => item?.placePrediction)
            .filter(place => typeof place?.placeId === 'string' && place.placeId.trim())
            .map(place => ({
                placeId: place.placeId,
                description: place.text?.text || '',
                mainText: place.structuredFormat?.mainText?.text || place.text?.text || '',
                secondaryText: place.structuredFormat?.secondaryText?.text || '',
            })),
    };
}

async function details(body = {}, fetchImpl) {
    const placeId = requiredText(body.placeId, 'placeId', 512);
    if (!/^[A-Za-z0-9_-]+$/.test(placeId)) throw fail(400, 'placeId contains invalid characters.');
    const token = sessionToken(body.sessionToken);
    const place = await request(`places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(token)}`,
        'id,formattedAddress,addressComponents,location', undefined, fetchImpl);
    const lat = place?.location?.latitude;
    const lng = place?.location?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw fail(422, 'This place has no usable location. Please choose another address or enter it manually.');
    }
    const components = Array.isArray(place.addressComponents) ? place.addressComponents : [];
    const get = (...types) => {
        for (const type of types) {
            const value = components.find(component => component?.types?.includes(type))?.longText;
            if (value) return value;
        }
        return '';
    };
    const address = place.formattedAddress || '';
    return {
        address,
        addressLine: [get('street_number'), get('route')].filter(Boolean).join(' ') || address,
        city: get('locality', 'postal_town', 'sublocality_level_1', 'administrative_area_level_3'),
        state: get('administrative_area_level_1'),
        zipcode: get('postal_code'),
        lat,
        lng,
    };
}

module.exports = { autocomplete, details };
