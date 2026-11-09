import {
    AsusDhcpLease, AsusEthernetPort, AsusFirmwareInfo, AsusPublicIpInfo, AsusTemperatures, AsusWifiBand, AsusWirelessChannel
} from "../models/asus-router-info";

const WIFI_UNITS = [0, 1, 2, 3];

function record(data: unknown, what: string): Record<string, unknown> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Invalid ${what} response from router`);
    }
    return data as Record<string, unknown>;
}

const str = (value: unknown): string => typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);

/** Firmware check stores versions as e.g. "3004_388_33812-gab9863d". */
function formatWebsVersion(info: string): string | undefined {
    const [firm, build, ...ext] = info.split('_');
    if (!firm || !build) {
        return undefined;
    }
    const dottedFirm = /^\d{4}$/.test(firm) ? firm.split('').join('.') : firm;
    return `${dottedFirm}.${build}${ext.length ? `_${ext.join('_')}` : ''}`;
}

export function firmwareInfoTransformer(data: unknown): AsusFirmwareInfo {
    const d = record(data, 'firmware');
    const firmver = str(d.firmver), buildno = str(d.buildno), extendno = str(d.extendno);
    if (!firmver || !buildno) {
        throw new Error('Router did not return its firmware version');
    }
    const productId = str(d.productid);
    const flag = str(d.webs_state_flag);
    return {
        version: `${firmver}.${buildno}${extendno ? `_${extendno}` : ''}`,
        productId,
        model: str(d.odmpid) || productId,
        // 1 = new firmware available, 2 = important/forced update available.
        updateAvailable: flag === '1' || flag === '2',
        latestVersion: formatWebsVersion(str(d.webs_state_info))
    };
}

const PORT_SPEEDS: Record<string, number> = { X: 0, M: 100, G: 1000, Q: 2500, F: 5000, T: 10000 };

export function ethernetPortsTransformer(data: unknown): AsusEthernetPort[] {
    const status = record(record(data, 'port status').get_wan_lan_status, 'port status');
    const portSpeed = record(status.portSpeed, 'port status');
    return Object.entries(portSpeed).map(([name, code]) => {
        const speedCode = str(code);
        return { name, connected: speedCode !== 'X' && speedCode !== '', speedMbps: PORT_SPEEDS[speedCode], speedCode };
    });
}

function band(nband: string): AsusWifiBand | undefined {
    return nband === '2' ? '2.4 GHz' : nband === '1' ? '5 GHz' : nband === '4' ? '6 GHz' : undefined;
}

export function wirelessChannelsTransformer(data: unknown): AsusWirelessChannel[] {
    const d = record(data, 'wireless channel');
    if (!Array.isArray(d.wl_control_channel)) {
        throw new Error('Router did not return wireless channels');
    }
    const channels = d.wl_control_channel;
    const radioCount = str(d.wl_ifnames).trim().split(/\s+/).filter(Boolean).length || channels.length;
    return WIFI_UNITS.slice(0, Math.min(radioCount, channels.length)).map(unit => ({
        unit,
        band: band(str(d[`wl${unit}_nband`])),
        channel: Number.parseInt(str(channels[unit]), 10) || 0
    }));
}

export function dhcpLeasesTransformer(data: unknown): AsusDhcpLease[] {
    const list = record(data, 'DHCP lease').dhcpLeaseMacList;
    if (!Array.isArray(list)) {
        throw new Error('Router did not return DHCP leases');
    }
    return list
        .filter((entry): entry is unknown[] => Array.isArray(entry) && typeof entry[0] === 'string' && entry[0] !== '')
        .map(([mac, hostname]) => {
            let name = str(hostname);
            try { name = decodeURIComponent(name); } catch { /* keep raw name */ }
            return { mac: str(mac).toUpperCase(), hostname: name };
        });
}

export function publicIpTransformer(data: unknown): AsusPublicIpInfo {
    const d = record(data, 'public IP');
    const activeWanUnit = Number.parseInt(str(d.get_wan_unit), 10) || 0;
    const wanIp = str(d[`wan${activeWanUnit}_ipaddr`]);
    // realip_state 2 = the router finished detecting its public IP.
    const publicIp = str(d[`wan${activeWanUnit}_realip_state`]) === '2' ? str(d[`wan${activeWanUnit}_realip_ip`]) || undefined : undefined;
    return {
        activeWanUnit,
        wanIp,
        publicIp,
        behindNat: publicIp && wanIp ? publicIp !== wanIp : undefined
    };
}

/**
 * Parses ajax_coretmp.asp, which is JavaScript that differs per model, e.g.
 * `fanctrl_info = ["1", "54", "58", "1802"]; curr_cpuTemp = "49"; curr_coreTmp_2 = fanctrl_info[1];`
 * or `curr_coreTmp_2_raw = "45&deg;C";`. Values are read without executing the script.
 */
export function temperaturesTransformer(page: unknown): AsusTemperatures {
    if (typeof page !== 'string') {
        throw new Error('Invalid temperature response from router');
    }
    const arrays: Record<string, string[]> = {};
    for (const m of page.matchAll(/(\w+)\s*=\s*\[([^\]]*)\]/g)) {
        arrays[m[1]] = [...m[2].matchAll(/["']([^"']*)["']|(-?[\d.]+)/g)].map(v => v[1] ?? v[2]);
    }
    const values: Record<string, number> = {};
    for (const m of page.matchAll(/(\w+)\s*=\s*(?:["']([^"']*)["']|(\w+)\[(\d+)\]|(-?\d+(?:\.\d+)?))\s*;/g)) {
        const [, name, quoted, arrayName, index, bare] = m;
        const raw = quoted ?? bare ?? arrays[arrayName]?.[Number(index)];
        const value = Number.parseFloat(raw ?? '');
        if (Number.isFinite(value)) {
            values[name.replace(/_raw$/, '')] = value;
        }
    }
    const result: AsusTemperatures = {
        cpu: values.curr_cpuTemp,
        radio2g: values.curr_coreTmp_2 ?? values.curr_coreTmp_wl0,
        radio5g: values.curr_coreTmp_5 ?? values.curr_coreTmp_51 ?? values.curr_coreTmp_wl1,
        radio5g2: values.curr_coreTmp_52 ?? values.curr_coreTmp_5_2 ?? values.curr_coreTmp_wl2,
        radio6g: values.curr_coreTmp_6 ?? values.curr_coreTmp_wl3,
    };
    (Object.keys(result) as (keyof AsusTemperatures)[]).forEach(key => result[key] === undefined && delete result[key]);
    // Models without sensors (e.g. RT-AX52 Pro) return the script with empty values: report no temperatures.
    if (Object.keys(result).length === 0 && !/curr_(cpuTemp|coreTmp)/.test(page)) {
        throw new Error('Router did not return temperatures');
    }
    return result;
}
