const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AsusWrt } = require('../lib/asus-wrt');

const SPEEDTEST_RESULT = {
    type: 'result', timestamp: '2026-11-09T20:00:00Z',
    download: { bytes: 125000000, elapsed: 10000 }, upload: { bytes: 62500000, elapsed: 10000 }, ping: { latency: 12 }, packetLoss: 0
};

/** Fake httpd: answers {error_status} to any request without a valid token cookie, like the real router. */
function fakeRouter(baseURL, options = {}) {
    const requests = [];
    const wrt = new AsusWrt({ baseURL, username: 'admin', password: 'pw' });
    wrt['ax'].defaults.adapter = async config => {
        requests.push(config.url);
        if (requests.length > 100) {
            throw new Error(`request loop: ${requests.length} requests`);
        }
        const authed = String(config.headers?.Cookie ?? '').includes('asus_token=token');
        const body = String(config.data ?? '');
        let data = {};
        if (config.url === '/login.cgi') data = { asus_token: 'token' };
        else if (!authed || (options.alwaysReject ?? []).includes(config.url)) data = { error_status: '2' };
        else if (body.includes('get_cfg_clientlist')) data = { get_cfg_clientlist: [{ mac: 'AA:BB:CC:00:00:01', ip: '192.168.1.1', config: {} }] };
        else if (body.includes('ookla_speedtest_get_history')) data = { ookla_speedtest_get_history: [] };
        else if (body.includes('ookla_speedtest_get_result')) data = { ookla_speedtest_get_result: options.result ?? [SPEEDTEST_RESULT] };
        return { data, status: 200, statusText: 'OK', headers: {}, config };
    };
    return { wrt, requests };
}

for (const baseURL of ['http://192.168.1.1', 'http://192.168.1.1:80', 'http://192.168.1.1/']) {
    test(`speedtest completes without a request loop for ${baseURL}`, async () => {
        const { wrt, requests } = fakeRouter(baseURL);
        await wrt.discoverClients();
        const result = await wrt.asusRouter.runSpeedtest({ id: 1 });
        assert.equal(result.ping.latency, 12);
        assert.equal(requests.filter(url => url === '/ookla_speedtest_write_history.cgi').length, 1);
        assert.ok(requests.length < 15, `expected a bounded number of requests, got ${requests.length}`);
    });
}

test('a request the router keeps rejecting is retried once, not forever', async () => {
    const { wrt, requests } = fakeRouter('http://192.168.1.1:80', { alwaysReject: ['/appGet.cgi'] });
    await assert.rejects(wrt.discoverClients());
    assert.equal(requests.filter(url => url === '/appGet.cgi').length, 2);
});

test('speedtest result polling tolerates a partially written result file', async () => {
    const { wrt } = fakeRouter('http://192.168.1.1', { result: 'not-an-array' });
    await wrt.discoverClients();
    const router = wrt.asusRouter;
    let polls = 0;
    const appGet = router.appGet.bind(router);
    router.appGet = async (payload, transformer) => {
        if (String(payload).includes('ookla_speedtest_get_result') && ++polls > 1) {
            return { ookla_speedtest_get_result: [SPEEDTEST_RESULT] };
        }
        return appGet(payload, transformer);
    };
    const result = await router.runSpeedtest({ id: 1 });
    assert.equal(result.type, 'result');
    assert.equal(polls, 2);
});
