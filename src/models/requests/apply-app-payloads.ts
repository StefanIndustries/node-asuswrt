import { AsusVpnClient } from "../asus-vpn-client";
import { AsusWakeOnLanDevice } from "../asus-wake-on-lan-device";

export function SetLedsPayload(enabled: boolean, mac: string): URLSearchParams {
    return new URLSearchParams({
        config: JSON.stringify({"led_val": enabled ? 1 : 0}),
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

export function WakeOnLanPayload(wolDevice: AsusWakeOnLanDevice): URLSearchParams {
    return new URLSearchParams({
        current_page: "Main_WOL_Content.asp",
        SystemCmd: `ether-wake -i br0 ${wolDevice.mac}`,
        action_mode: " Refresh "
    });
}

export function SetActiveVPNPayload(client?: AsusVpnClient): URLSearchParams {
    if (client) {
        return new URLSearchParams({
            vpnc_proto: `${client.protocol.toLowerCase()}`,
            vpnc_pptp_options_x: "auto",
            vpn_clientx_eas: `${client.unit},`,
            vpn_client_unit: `${client.unit}`,
            [`vpn_client${client.unit}_username`]: `${client.username}`,
            [`vpn_client${client.unit}_password`]: `${client.password}`,
            action_mode: "apply"
        })
    } else {
        return new URLSearchParams({
            vpnc_proto: "disable",
            vpnc_pptp_options_x: "",
            vpn_clientx_eas: "",
            vpn_client_unit: "",
            vpnc_pppoe_username: "",
            vpnc_pppoe_passwd: "",
            vpnc_heartbeat_x: "",
            action_mode: "apply"
        })
    }
}