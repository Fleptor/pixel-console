const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/verify.js');

// Deliberately unrelated to the real puzzle's solution.
const fixtures = ['FIRST-FIXTURE', 'SECOND-FIXTURE', 'THIRD-FIXTURE', 'LAST-FIXTURE'];
process.env.PIXEL_EXPECTED_FRAGMENTS = JSON.stringify(fixtures);
const event = body => ({ httpMethod: 'POST', headers: { origin: 'https://belalhamdan.com' }, body: JSON.stringify(body) });
const verify = frags => handler(event({ action: 'verify', frags }));

test('correct ordered fragments return only boolean results', async () => {
    const response = await verify(fixtures.map(value => ` ${value.toLowerCase()} `));
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { success: true, checks: [true, true, true, true] });
    assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('incorrect and out-of-order fragments fail without revealing answers', async () => {
    for (const values of [['wrong', ...fixtures.slice(1)], [...fixtures].reverse()]) {
        const response = await verify(values);
        const data = JSON.parse(response.body);
        assert.equal(data.success, false);
        assert.equal(data.checks.length, 4);
        assert.ok(data.checks.every(value => typeof value === 'boolean'));
        for (const answer of fixtures) assert.ok(!response.body.includes(answer));
    }
});

test('malformed submissions never pass verification', async () => {
    for (const frags of [null, {}, 'text', [], fixtures.slice(1), [...fixtures, 'extra'], [1, 2, 3, 4], ['', ...fixtures.slice(1)], ['x'.repeat(65), ...fixtures.slice(1)]]) {
        assert.equal((await verify(frags)).statusCode, 400);
    }
    for (const body of ['{', 'null', '[]', 'true', ' '.repeat(4097)]) {
        assert.equal((await handler({ ...event({}), body })).statusCode, 400);
    }
    assert.equal((await handler(event({ action: 'unknown' }))).statusCode, 400);
});

test('only the exact admin role reveals the final fragment', async () => {
    for (const role of [undefined, null, '', 'guest', 'Admin', 'superadmin', 'admin=true']) {
        const response = await handler(event({ action: 'admin_token', role }));
        assert.equal(response.statusCode, 403);
        assert.ok(!response.body.includes(fixtures[3]));
    }
    const response = await handler(event({ action: 'admin_token', role: 'admin' }));
    assert.deepEqual(JSON.parse(response.body), { fragment: fixtures[3] });
});

test('CORS preflight and method restrictions', async () => {
    const preflight = await handler({ ...event({}), httpMethod: 'OPTIONS' });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers['Access-Control-Allow-Origin'], 'https://belalhamdan.com');
    assert.equal(preflight.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
    assert.equal((await handler({ ...event({}), httpMethod: 'GET' })).statusCode, 405);
    const denied = await handler({ ...event({ action: 'verify', frags: fixtures }), headers: { Origin: 'https://unrelated.example' } });
    assert.equal(denied.statusCode, 403);
});

test('missing or malformed server configuration fails closed', async () => {
    const saved = process.env.PIXEL_EXPECTED_FRAGMENTS;
    try {
        for (const value of [undefined, 'invalid', '[]', '[null,null,null,null]']) {
            if (value === undefined) delete process.env.PIXEL_EXPECTED_FRAGMENTS;
            else process.env.PIXEL_EXPECTED_FRAGMENTS = value;
            const response = await verify(fixtures);
            assert.equal(response.statusCode, 503);
            assert.deepEqual(JSON.parse(response.body), { error: 'Verification unavailable' });
        }
    } finally {
        process.env.PIXEL_EXPECTED_FRAGMENTS = saved;
    }
});
