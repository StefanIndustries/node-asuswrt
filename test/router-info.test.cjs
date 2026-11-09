const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    firmwareInfoTransformer, ethernetPortsTransformer, wirelessChannelsTransformer,
    dhcpLeasesTransformer, publicIpTransformer, temperaturesTransformer
} = require('../lib/transformers/router-info-transformers');

// Fixtures recorded from an RT-AX89X on 3.0.0.4.388_33812 (addresses anonymised).

test('firmware info formats installed and latest versions', () => {
    const info = firmwareInfoTransformer({
        firmver: '3.0.0.4', buildno: '388', extendno: '33812-gab9863d', productid: 'RT-AX89U', odmpid: 'RT-AX89X',
        webs_state_flag: '1', webs_state_info: '3004_388_34000-gabcdef0'
    });
    assert.deepEqual(info, {
        version: '3.0.0.4.388_33812-gab9863d', productId: 'RT-AX89U', model: 'RT-AX89X',
        updateAvailable: true, latestVersion: '3.0.0.4.388_34000-gabcdef0'
    });
    assert.equal(firmwareInfoTransformer({ firmver: '3.0.0.4', buildno: '388', webs_state_flag: '0', productid: 'RT-AX88U' }).updateAvailable, false);
    assert.throws(() => firmwareInfoTransformer({ firmver: '' }), /firmware version/);
});

test('ethernet ports decode link speed codes', () => {
    const ports = ethernetPortsTransformer({ get_wan_lan_status: {
        portSpeed: { 'WAN': 'X', '10G base-T': 'T', 'LAN 1': 'G', 'LAN 2': 'M', 'LAN 3': 'Q', 'LAN 4': 'Z' },
        portCount: { wanCount: 3, lanCount: 8 }
    } });
    assert.deepEqual(ports, [
        { name: 'WAN', connected: false, speedMbps: 0, speedCode: 'X' },
        { name: '10G base-T', connected: true, speedMbps: 10000, speedCode: 'T' },
        { name: 'LAN 1', connected: true, speedMbps: 1000, speedCode: 'G' },
        { name: 'LAN 2', connected: true, speedMbps: 100, speedCode: 'M' },
        { name: 'LAN 3', connected: true, speedMbps: 2500, speedCode: 'Q' },
        { name: 'LAN 4', connected: true, speedMbps: undefined, speedCode: 'Z' }
    ]);
});

test('wireless channels only include existing radios with their band', () => {
    assert.deepEqual(wirelessChannelsTransformer({
        wl_control_channel: ['11', '128', '0', '0'], wl_ifnames: 'ath1 ath0',
        wl0_nband: '2', wl1_nband: '1', wl2_nband: '', wl3_nband: ''
    }), [
        { unit: 0, band: '2.4 GHz', channel: 11 },
        { unit: 1, band: '5 GHz', channel: 128 }
    ]);
    assert.throws(() => wirelessChannelsTransformer({}), /wireless channels/);
});

test('dhcp leases decode hostnames', () => {
    assert.deepEqual(dhcpLeasesTransformer({ dhcpLeaseMacList: [
        ['aa:bb:cc:00:00:01', 'Soundtouch%2D300'], ['AA:BB:CC:00:00:02', 'heater%5Fmibt'], ['', 'ignored'], ['AA:BB:CC:00:00:03', '%E0%A4%A']
    ] }), [
        { mac: 'AA:BB:CC:00:00:01', hostname: 'Soundtouch-300' },
        { mac: 'AA:BB:CC:00:00:02', hostname: 'heater_mibt' },
        { mac: 'AA:BB:CC:00:00:03', hostname: '%E0%A4%A' }
    ]);
});

test('public ip detects double NAT on the active WAN', () => {
    const base = { get_wan_unit: 0, wan0_ipaddr: '203.0.113.5', wan0_realip_state: '2', wan0_realip_ip: '203.0.113.5', wan1_ipaddr: '0.0.0.0' };
    assert.deepEqual(publicIpTransformer(base), { activeWanUnit: 0, wanIp: '203.0.113.5', publicIp: '203.0.113.5', behindNat: false });
    assert.equal(publicIpTransformer({ ...base, wan0_ipaddr: '100.64.1.2' }).behindNat, true);
    assert.deepEqual(publicIpTransformer({ ...base, wan0_realip_state: '0' }), { activeWanUnit: 0, wanIp: '203.0.113.5', publicIp: undefined, behindNat: undefined });
});

test('temperatures parse fan-controlled and raw page formats', () => {
    assert.deepEqual(temperaturesTransformer(
        'fanctrl_info = ["1", "54", "58", "1802"];\ncurr_cpuTemp = "49";\ncurr_rxData = fanctrl_info[3];\n' +
        'curr_coreTmp_2 = fanctrl_info[1];\ncurr_coreTmp_5 = fanctrl_info[2];\n'
    ), { cpu: 49, radio2g: 54, radio5g: 58 });
    assert.deepEqual(temperaturesTransformer(
        'curr_coreTmp_2_raw = "45&deg;C";\ncurr_coreTmp_51_raw = "50&deg;C";\ncurr_coreTmp_52_raw = "52&deg;C";\ncurr_cpuTemp = "61.5";\n'
    ), { cpu: 61.5, radio2g: 45, radio5g: 50, radio5g2: 52 });
    // RT-AX52 Pro: no sensors.
    assert.deepEqual(temperaturesTransformer(
        'fanctrl_info = ;\ncurr_cpuTemp = "";\ncurr_rxData = fanctrl_info[3];\ncurr_coreTmp_2 = fanctrl_info[1];\ncurr_coreTmp_5 = fanctrl_info[2];\n'
    ), {});
    assert.throws(() => temperaturesTransformer('<html>login</html>'), /temperatures/);
});
