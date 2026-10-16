import { AsusGuestNetwork } from '../models/asus-guest-network';

export function guestNetworkRadioCount(data: Record<string, unknown>): number {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid guest network response from router');
    }
    if (typeof data.sdn_rl === 'string' && data.sdn_rl.trim() !== '') {
        throw new Error('Guest Network Pro / SDN is not supported by classic guest network actions');
    }
    if (typeof data.wl_ifnames !== 'string' || data.wl_ifnames.trim() === '') {
        throw new Error('Router does not expose classic guest network interfaces');
    }
    const count = data.wl_ifnames.trim().split(/\s+/).length;
    if (count > 4) {
        throw new Error('Unsupported number of wireless radios');
    }
    return count;
}

function nonNegativeInteger(value: unknown): number | null {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        return null;
    }
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
}

export function guestNetworkStateTransformer(
    data: Record<string, unknown>, id: string
): Pick<AsusGuestNetwork, 'enabled' | 'durationSeconds' | 'remainingSeconds'> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid guest network response from router');
    }
    const enabled = data[`${id}_bss_enabled`];
    if (enabled !== '0' && enabled !== '1') {
        throw new Error(`Router returned an invalid enabled state for ${id}`);
    }
    const durationSeconds = nonNegativeInteger(data[`${id}_expire`]);
    if (durationSeconds === null) {
        throw new Error(`Router returned an invalid access duration for ${id}`);
    }
    return {
        enabled: enabled === '1',
        durationSeconds,
        remainingSeconds: nonNegativeInteger(data[`${id}_expire_tmp`])
    };
}

export function guestNetworksTransformer(data: Record<string, unknown>, radioCount: number): AsusGuestNetwork[] {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid guest network response from router');
    }
    const networks: AsusGuestNetwork[] = [];
    for (let unit = 0; unit < radioCount; unit++) {
        // Read the band instead of assuming radio 0 is always 2.4 GHz.
        const bandValue = data[`wl${unit}_nband`];
        const band = bandValue === '2' ? '2.4 GHz' : bandValue === '1' ? '5 GHz' : undefined;
        const vifnames = data[`wl${unit}_vifnames`];
        if (!band || typeof vifnames !== 'string') {
            continue;
        }
        const interfaces = vifnames.trim().split(/\s+/);
        for (let subunit = 1; subunit <= 3; subunit++) {
            const id = `wl${unit}.${subunit}`;
            const ssid = data[`${id}_ssid`];
            const enabled = data[`${id}_bss_enabled`];
            // _mbss=1 is the firmware's marker for a previously configured
            // guest slot. Do not offer untouched factory-default slots.
            if (!interfaces.includes(id) || typeof ssid !== 'string' || ssid.trim() === ''
                || (enabled !== '0' && enabled !== '1')
                || (data[`${id}_mbss`] !== '1' && enabled !== '1')) {
                continue;
            }
            networks.push({
                id, unit, subunit, ssid, band,
                ...guestNetworkStateTransformer(data, id)
            });
        }
    }
    return networks;
}
