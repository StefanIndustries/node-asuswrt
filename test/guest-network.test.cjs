const assert = require('node:assert/strict');
const { test } = require('node:test');
const axios = require('axios');
const { AsusRouter } = require('../lib/classes/asus-router');
const { guestNetworkRadioCount, guestNetworksTransformer } = require('../lib/transformers/guest-networks-transformer');
const { SetGuestNetworkPayload } = require('../lib/models/requests/guest-network-payloads');

function guestData() {
    return {
        wl_ifnames: 'eth1 eth2', sdn_rl: '', wl_unit: '-1', wl_subunit: '-1',
        wl0_nband: '2', wl0_vifnames: 'wl0.1 wl0.2 wl0.3',
        wl1_nband: '1', wl1_vifnames: 'wl1.1 wl1.2 wl1.3',
        'wl0.1_ssid': 'Visitors', 'wl0.1_mbss': '1', 'wl0.1_bss_enabled': '1',
        'wl0.1_expire': '43200', 'wl0.1_expire_tmp': '41640',
        'wl1.1_ssid': 'Visitors', 'wl1.1_mbss': '1', 'wl1.1_bss_enabled': '0',
        'wl1.1_expire': '0', 'wl1.1_expire_tmp': '0',
        // An untouched factory slot must not be offered for enabling.
        'wl0.2_ssid': 'ASUS_Guest2', 'wl0.2_mbss': '', 'wl0.2_bss_enabled': '0',
        'wl0.2_expire': '0', 'wl0.2_expire_tmp': '0'
    };
}

async function fakeRouter(options = {}) {
    const data = guestData();
    const writes = [];
    const requests = [];
    let verificationReadFailures = options.verificationReadFailures ?? 0;
    const ax = axios.create({ adapter: async config => {
        requests.push(config);
        let body;
        if (config.url === '/login.cgi') {
            body = { asus_token: 'fixture-token' };
        } else if (config.url === '/appGet.cgi') {
            if (writes.length > 0 && verificationReadFailures > 0) {
                verificationReadFailures--;
                throw new axios.AxiosError('Router temporarily unreachable during wireless restart', 'ECONNRESET');
            }
            const hook = new URLSearchParams(config.data).get('hook');
            if (writes.length > 0 && options.onRead) await options.onRead({ data, writes, hook, config });
            // Only return attributes explicitly requested, like the real endpoint.
            body = {};
            for (const match of hook.matchAll(/nvram_get\(([^)]+)\)/g)) {
                body[match[1]] = data[match[1]] ?? '';
            }
        } else if (config.url === '/applyapp.cgi') {
            const payload = new URLSearchParams(config.data);
            writes.push(payload);
            data.wl_unit = payload.get('wl_unit');
            data.wl_subunit = payload.get('wl_subunit');
            if (options.onApply) await options.onApply(payload);
            if (options.apply !== false) {
                const id = `wl${payload.get('wl_unit')}.${payload.get('wl_subunit')}`;
                data[`${id}_bss_enabled`] = payload.get(`${id}_bss_enabled`);
                if (payload.has(`${id}_expire`)) {
                    data[`${id}_expire`] = payload.get(`${id}_expire`);
                    data[`${id}_expire_tmp`] = options.resetCountdown === false
                        ? '30' : payload.get(`${id}_expire`);
                }
            }
            if (options.restartFinished !== false) {
                data.wl_unit = '-1';
                data.wl_subunit = '-1';
            }
            body = options.response ?? { modify: '1' };
        } else {
            throw new Error(`Unexpected request ${config.url}`);
        }
        return { data: body, status: 200, statusText: 'OK', headers: {}, config };
    }});
    const router = new AsusRouter(ax, 'http://router.test:8080', 'fixture-mac', 'admin', 'fixture-only', {});
    await router.authenticate();
    return { router, data, writes, requests };
}

function immediatePolling(t) {
    let now = 0;
    t.mock.method(Date, 'now', () => now);
    t.mock.method(global, 'setTimeout', (callback, delay) => {
        now += delay;
        queueMicrotask(callback);
        return 0;
    });
    return { advance(milliseconds) { now += milliseconds; }, elapsed() { return now; } };
}

test('discovers enabled and disabled configured networks without merging identical SSIDs', () => {
    const data = guestData();
    const networks = guestNetworksTransformer(data, guestNetworkRadioCount(data));
    assert.deepEqual(networks.map(({ id, band, enabled }) => ({ id, band, enabled })), [
        { id: 'wl0.1', band: '2.4 GHz', enabled: true },
        { id: 'wl1.1', band: '5 GHz', enabled: false }
    ]);
    assert.equal(networks[0].remainingSeconds, 41640);
});

test('uses reported radio bands and ignores nonexistent interfaces', () => {
    const data = guestData();
    data.wl0_nband = '1';
    data.wl1_nband = '2';
    data.wl1_vifnames = 'wl1.2 wl1.3';
    assert.equal(guestNetworksTransformer(data, 2)[0].band, '5 GHz');
    assert.equal(guestNetworksTransformer(data, 2).length, 1);
});

test('rejects SDN, login HTML, missing metadata, and malformed duration', () => {
    assert.throws(() => guestNetworkRadioCount({ ...guestData(), sdn_rl: '<1>Guest>1' }), /SDN/);
    assert.throws(() => guestNetworkRadioCount('<html>Login</html>'), /Invalid/);
    assert.throws(() => guestNetworkRadioCount({}), /interfaces/);
    assert.throws(() => guestNetworksTransformer({ ...guestData(), 'wl0.1_expire': '120abc' }, 2), /invalid access duration/);
});

test('returns an empty discovery result when no guest slots are configured', async () => {
    const { router, data } = await fakeRouter();
    for (const id of ['wl0.1', 'wl1.1']) {
        data[`${id}_mbss`] = '';
        data[`${id}_bss_enabled`] = '0';
    }
    assert.deepEqual(await router.getGuestNetworks(), []);
});

test('builds a minimal timed request with the selectors needed to reset the countdown', () => {
    const payload = SetGuestNetworkPayload('wl0.1', true, 7200);
    assert.deepEqual(Object.fromEntries(payload), {
        action_mode: 'apply', rc_service: 'restart_wireless;restart_firewall;',
        wl_unit: '0', wl_subunit: '1', 'wl0.1_bss_enabled': '1', 'wl0.1_expire': '7200'
    });
    assert.equal(SetGuestNetworkPayload('wl0.1', true).get('wl0.1_expire'), '0');
    assert.equal(SetGuestNetworkPayload('wl0.1', false).has('wl0.1_expire'), false);
});

test('rejects primary Wi-Fi IDs, invalid slots, and invalid durations before any request', async () => {
    const { router, requests, writes } = await fakeRouter();
    const before = requests.length;
    for (const id of ['wl0', 'wl0.0', 'wl0.4', 'wl4.1', 'wl0.1;reboot', undefined]) {
        await assert.rejects(router.setGuestNetworkEnabled(id, true, 60), /Invalid guest/);
    }
    for (const seconds of [-1, 1.5, NaN, Infinity, '120', 2592001]) {
        await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, seconds), /duration/);
    }
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', 'true', 60), /boolean/);
    assert.equal(requests.length, before);
    assert.equal(writes.length, 0);
});

test('timed enable authenticates the write to the correct router and reads back the reset countdown', async () => {
    const { router, data, requests, writes } = await fakeRouter();
    data['wl1.1_expire_tmp'] = '1000';
    assert.equal(await router.setGuestNetworkEnabled('wl0.1', true, 120), true);
    assert.equal(data['wl0.1_expire_tmp'], '120');
    assert.equal(data['wl1.1_expire_tmp'], '1000');
    const request = requests.find(request => request.url === '/applyapp.cgi');
    assert.equal(request.baseURL, 'http://router.test:8080');
    assert.equal(request.headers.Cookie, 'asus_token=fixture-token');
    assert.ok(request.timeout > 0);
    assert.equal(writes.length, 1);
    const reads = requests.filter(request => request.url === '/appGet.cgi');
    assert.equal(reads.length, 3); // metadata, discovery, then one selected-slot verification
    const verificationHook = new URLSearchParams(reads[2].data).get('hook');
    assert.match(verificationHook, /nvram_get\(wl_unit\)/);
    assert.match(verificationHook, /nvram_get\(wl0\.1_expire_tmp\)/);
    assert.doesNotMatch(verificationHook, /wl_ifnames|wl1\.|wl0\.2/);
    assert.ok(requests.filter(request => request.url === '/appGet.cgi')
        .every(request => !String(request.data).includes('wpa_psk')));
});

test('unlimited enable clears the countdown; disable preserves configured duration', async () => {
    const { router, data } = await fakeRouter();
    await router.setGuestNetworkEnabled('wl0.1', true);
    assert.equal(data['wl0.1_expire_tmp'], '0');
    data['wl0.1_expire'] = '300';
    await router.setGuestNetworkEnabled('wl0.1', false);
    assert.equal(data['wl0.1_bss_enabled'], '0');
    assert.equal(data['wl0.1_expire'], '300');
});

test('refuses a missing or unconfigured target without applying changes', async () => {
    const { router, writes } = await fakeRouter();
    await assert.rejects(router.setGuestNetworkEnabled('wl0.2', true, 60), /not configured/);
    assert.equal(writes.length, 0);
    await router.setGuestNetworkEnabled('wl0.1', true, 60); // rejected operation does not poison the queue
    assert.equal(writes.length, 1);
});

test('does not report success for HTTP-200 login HTML or router error responses', async () => {
    for (const response of ['<html>Login</html>', { error_status: '2' }]) {
        const { router } = await fakeRouter({ response });
        await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 60), /rejected/);
    }
});

test('does not report timed success if the duration changed but the countdown did not reset', async t => {
    immediatePolling(t);
    const { router } = await fakeRouter({ resetCountdown: false });
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 600), /Could not confirm/);
});

test('does not report success when the router acknowledges but ignores a change', async t => {
    immediatePolling(t);
    const { router } = await fakeRouter({ apply: false });
    await assert.rejects(router.setGuestNetworkEnabled('wl1.1', true, 120), /Could not confirm/);
});

test('rejects an ignored repeated enable even when the old countdown is within tolerance', async t => {
    immediatePolling(t);
    const { router, data } = await fakeRouter({ apply: false, response: { modify: '0' } });
    data['wl0.1_expire'] = '240';
    data['wl0.1_expire_tmp'] = '210';
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 240), /Could not confirm/);
});

test('confirms a refreshed repeated countdown without requiring a modify acknowledgement', async () => {
    const { router, data } = await fakeRouter({ response: { modify: '0' } });
    data['wl0.1_expire'] = '240';
    data['wl0.1_expire_tmp'] = '150';
    assert.equal(await router.setGuestNetworkEnabled('wl0.1', true, 240), true);
});

test('a naturally decreasing old countdown does not prove a shorter timer was reset', async t => {
    immediatePolling(t);
    const { router, data } = await fakeRouter({ onRead: ({ data }) => {
        data['wl0.1_expire_tmp'] = '210';
    }});
    data['wl0.1_expire'] = '300';
    data['wl0.1_expire_tmp'] = '250';
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 240), /Could not confirm/);
});

test('confirms repeated unlimited enable by observing restart selectors become idle', async t => {
    immediatePolling(t);
    let reads = 0;
    const { router, data } = await fakeRouter({ restartFinished: false, onRead: ({ data }) => {
        if (++reads === 2) {
            data.wl_unit = '-1';
            data.wl_subunit = '-1';
        }
    }});
    data['wl0.1_expire'] = '0';
    data['wl0.1_expire_tmp'] = '0';
    assert.equal(await router.setGuestNetworkEnabled('wl0.1', true), true);
    assert.equal(reads, 2);
});

test('does not accept already-matching unlimited state without evidence of a restart', async t => {
    immediatePolling(t);
    const { router, data } = await fakeRouter({ apply: false });
    data['wl0.1_expire'] = '0';
    data['wl0.1_expire_tmp'] = '0';
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true), /Could not confirm/);
});

test('waits for restart completion even if an already-enabled unlimited network matches readback', async t => {
    immediatePolling(t);
    const { router, data } = await fakeRouter({ restartFinished: false });
    data['wl0.1_expire'] = '0';
    data['wl0.1_expire_tmp'] = '0';
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true), /Could not confirm/);
});

test('recovers when a wireless restart temporarily interrupts state readback', async t => {
    immediatePolling(t);
    const { router, writes } = await fakeRouter({ verificationReadFailures: 2 });
    assert.equal(await router.setGuestNetworkEnabled('wl0.1', true, 120), true);
    assert.equal(writes.length, 1); // verification retries never resend the apply request
});

test('permanent read failures and cancellation stop verification immediately', async t => {
    immediatePolling(t);
    for (const error of [new axios.CanceledError('disposed'),
        new axios.AxiosError('Invalid request option', 'ERR_BAD_OPTION_VALUE'), new axios.AxiosError(
        'Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, { status: 403 }
    )]) {
        let reads = 0;
        const { router } = await fakeRouter({ onRead: () => { reads++; throw error; } });
        await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 120), value => value === error);
        assert.equal(reads, 1);
    }
});

test('malformed state readback preserves the protocol error instead of retrying', async () => {
    let reads = 0;
    const { router } = await fakeRouter({ onRead: ({ data }) => {
        reads++;
        data['wl0.1_expire'] = 'not-a-duration';
    }});
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 120), /invalid access duration/);
    assert.equal(reads, 1);
});

test('verification obeys its elapsed deadline and retains the last transport error', async t => {
    const clock = immediatePolling(t);
    let reads = 0;
    const { router, writes } = await fakeRouter({ onRead: ({ config }) => {
        reads++;
        assert.ok(config.timeout > 0 && config.timeout <= 10000);
        clock.advance(config.timeout); // model a request consuming its full timeout
        throw new axios.AxiosError('read timed out', 'ETIMEDOUT');
    }});
    await assert.rejects(router.setGuestNetworkEnabled('wl0.1', true, 120), /last read error: read timed out/);
    assert.equal(clock.elapsed(), 60000);
    assert.equal(reads, 5);
    assert.equal(writes.length, 1);
});

test('a disable keeps the cross-radio queue locked until its restart completes', async t => {
    immediatePolling(t);
    let announce;
    let release;
    const verificationStarted = new Promise(resolve => { announce = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let reads = 0;
    const { router, writes } = await fakeRouter({ restartFinished: false, onRead: async ({ data, writes }) => {
        if (writes.length === 1 && ++reads === 2) {
            announce();
            await gate;
        }
        if (reads >= 2) {
            data.wl_unit = '-1';
            data.wl_subunit = '-1';
        }
    }});
    const first = router.setGuestNetworkEnabled('wl0.1', false);
    await verificationStarted;
    const second = router.setGuestNetworkEnabled('wl1.1', true, 120);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes.length, 1);
    release();
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(writes.length, 2);
});

test('serializes overlapping changes across radios until the first change is verified', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let announce;
    const firstApply = new Promise(resolve => { announce = resolve; });
    let applications = 0;
    const { router, writes, data } = await fakeRouter({ onApply: async () => {
        applications++;
        if (applications === 1) { announce(); await gate; }
    }});
    const first = router.setGuestNetworkEnabled('wl0.1', true, 120);
    await firstApply;
    const second = router.setGuestNetworkEnabled('wl1.1', true, 300);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes.length, 1);
    release();
    await Promise.all([first, second]);
    assert.equal(writes.length, 2);
    assert.equal(data['wl0.1_expire_tmp'], '120');
    assert.equal(data['wl1.1_expire_tmp'], '300');
});
