const assert = require('node:assert/strict');
const { test } = require('node:test');
const axios = require('axios');
const { AsusClient } = require('../lib/classes/asus-client');
const { AsusLoginError } = require('../lib/asus-wrt');
const { AsusTester } = require('../lib/asus-tester');

function loginAdapter(body) {
    return async config => ({ data: body, status: 200, statusText: 'OK', headers: {}, config });
}

const locked = { error_status: '7', captcha_on: '0', last_time_lock_warning: '0', remaining_lock_time: '125', lock_version: '1' };

test('authenticate reports a temporary lock for error 7', async () => {
    const client = new AsusClient(axios.create({ adapter: loginAdapter(locked) }), 'http://router', '', 'admin', 'pw');
    await assert.rejects(client.authenticate(), error => {
        assert.ok(error instanceof AsusLoginError);
        assert.equal(error.isLocked, true);
        assert.equal(error.remainingLockSeconds, 125);
        assert.match(error.message, /temporarily locked.*125 seconds/);
        assert.doesNotMatch(error.message, /username or password/i);
        return true;
    });
});

test('authenticate reports invalid credentials for other errors', async () => {
    const client = new AsusClient(axios.create({ adapter: loginAdapter({ error_status: '3' }) }), 'http://router', '', 'admin', 'pw');
    await assert.rejects(client.authenticate(), error => {
        assert.ok(error instanceof AsusLoginError);
        assert.equal(error.isLocked, false);
        assert.match(error.message, /Invalid username or password/);
        return true;
    });
});

test('diagnostics report a locked router instead of bad credentials', async () => {
    const tester = new AsusTester({ baseURL: 'http://router', username: 'admin', password: 'pw' });
    tester['ax'] = axios.create({ adapter: loginAdapter(locked) });
    const result = await tester.runDiagnostics();
    tester.dispose();
    assert.equal(result.isAuthValid, false);
    assert.equal(result.isLocked, true);
    assert.match(result.message, /temporarily locked/);
});
