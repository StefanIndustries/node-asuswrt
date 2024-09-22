export function SetLedsPayload(enabled: boolean, mac: string): URLSearchParams {
    return new URLSearchParams({
        config: JSON.stringify({ "led_val": enabled ? 1 : 0 }),
        re_mac: mac,
        action_mode: "config_changed"
    });
}

export function RebootNodePayload(mac: string): URLSearchParams {
    return new URLSearchParams({
        device_list: mac,
        action_mode: "device_reboot"
    });
}

export function RebootNetworkPayload(): URLSearchParams {
    return new URLSearchParams({
        action_mode: "device_reboot"
    });
}