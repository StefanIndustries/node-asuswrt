import { MAX_GUEST_DURATION_SECONDS } from '../asus-guest-network';

export const GuestNetworkMetadataPayload = 'nvram_get(wl_ifnames);nvram_get(sdn_rl);';

export function GuestNetworkStatePayload(id: string): string {
    validateGuestNetworkId(id);
    return ['wl_unit', 'wl_subunit', `${id}_bss_enabled`, `${id}_expire`, `${id}_expire_tmp`]
        .map(key => `nvram_get(${key});`).join('');
}

export function GuestNetworksPayload(radioCount: number): string {
    const keys: string[] = [];
    for (let unit = 0; unit < radioCount; unit++) {
        keys.push(`wl${unit}_nband`, `wl${unit}_vifnames`);
        for (let subunit = 1; subunit <= 3; subunit++) {
            for (const field of ['ssid', 'mbss', 'bss_enabled', 'expire', 'expire_tmp']) {
                keys.push(`wl${unit}.${subunit}_${field}`);
            }
        }
    }
    return keys.map(key => `nvram_get(${key});`).join('');
}

export function validateGuestNetworkId(id: string): void {
    if (typeof id !== 'string' || !/^wl[0-3]\.[1-3]$/.test(id)) {
        throw new Error('Invalid guest network ID; select a discovered guest network');
    }
}

export function validateGuestNetworkDuration(durationSeconds: number): void {
    if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_GUEST_DURATION_SECONDS) {
        throw new Error('Guest network duration must be an integer between 0 and 2592000 seconds');
    }
}

export function SetGuestNetworkPayload(id: string, enabled: boolean, durationSeconds = 0): URLSearchParams {
    validateGuestNetworkId(id);
    validateGuestNetworkDuration(durationSeconds);
    if (typeof enabled !== 'boolean') {
        throw new Error('Guest network enabled state must be a boolean');
    }
    const [unit, subunit] = id.substring(2).split('.');
    const payload = new URLSearchParams({
        action_mode: 'apply',
        rc_service: 'restart_wireless;restart_firewall;',
        // ASUSWRT uses these selectors during the wireless restart to copy
        // this network's _expire into _expire_tmp, even if _expire is unchanged.
        wl_unit: unit,
        wl_subunit: subunit,
        [`${id}_bss_enabled`]: enabled ? '1' : '0'
    });
    if (enabled) {
        payload.set(`${id}_expire`, durationSeconds.toString());
    }
    return payload;
}
