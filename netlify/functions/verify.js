const ALLOWED_ORIGINS = new Set([
    'https://belalhamdan.com',
    'https://pixel.belalhamdan.com',
    'https://rainbow-caramel-bcc9e2.netlify.app'
]);

exports.handler = async event => {
    const origin = event.headers?.origin || event.headers?.Origin;
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Origin',
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://belalhamdan.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(403, { error: 'Origin not allowed' });
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

    let payload;
    try {
        if (typeof event.body !== 'string' || event.body.length > 4096) throw new Error();
        payload = JSON.parse(event.body);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
    } catch {
        return reply(400, { error: 'Invalid request' });
    }
    if (payload.action !== 'verify' && payload.action !== 'admin_token') {
        return reply(400, { error: 'Unknown action' });
    }
    // Intentionally trust the player's editable role for the archive's cookie puzzle.
    if (payload.action === 'admin_token' && payload.role !== 'admin') {
        return reply(403, { error: 'Admin role required' });
    }
    if (payload.action === 'verify' && (!Array.isArray(payload.frags)
        || payload.frags.length !== 4
        || !payload.frags.every(frag => typeof frag === 'string' && frag.trim().length > 0 && frag.length <= 64))) {
        return reply(400, { error: 'Provide four fragments' });
    }

    let expected;
    try {
        expected = JSON.parse(process.env.PIXEL_EXPECTED_FRAGMENTS);
        if (!Array.isArray(expected) || expected.length !== 4
            || !expected.every(frag => typeof frag === 'string' && frag.trim().length > 0 && frag.length <= 64)) {
            throw new Error();
        }
        expected = expected.map(frag => frag.trim().toUpperCase());
    } catch {
        return reply(503, { error: 'Verification unavailable' });
    }

    if (payload.action === 'admin_token') return reply(200, { fragment: expected[3] });
    const checks = expected.map((answer, index) => payload.frags[index].trim().toUpperCase() === answer);
    return reply(200, { success: checks.every(Boolean), checks });
};
