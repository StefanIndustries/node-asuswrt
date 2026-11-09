/** Temperatures in °C as shown on the web UI's Temperature page. Sensors the model lacks are left out. */
export interface AsusTemperatures {
    cpu?: number;
    radio2g?: number;
    radio5g?: number;
    /** Second 5 GHz radio on tri-band models. */
    radio5g2?: number;
    radio6g?: number;
}

export interface AsusFirmwareInfo {
    /** Installed firmware, for example 3.0.0.4.388_33812-gab9863d. */
    version: string;
    /** Internal product id, for example RT-AX89U. */
    productId: string;
    /** Marketing model name, for example RT-AX89X (falls back to productId). */
    model: string;
    /** True when the router's last firmware check found a newer version. */
    updateAvailable: boolean;
    /** Latest version reported by the router's last firmware check, if known. */
    latestVersion?: string;
}

export interface AsusEthernetPort {
    /** Port label as shown by the router, for example "WAN", "LAN 1" or "10G SFP+". */
    name: string;
    connected: boolean;
    /** Negotiated link speed in Mbit/s; 0 when disconnected, undefined for an unknown speed code. */
    speedMbps?: number;
    /** Raw speed code from the router (X = no link, M = 100M, G = 1G, Q = 2.5G, F = 5G, T = 10G). */
    speedCode: string;
}

export type AsusWifiBand = '2.4 GHz' | '5 GHz' | '6 GHz';

export interface AsusWirelessChannel {
    /** Radio unit (wl0, wl1, ...). */
    unit: number;
    band?: AsusWifiBand;
    /** Current control channel; 0 when the radio reports none. */
    channel: number;
}

export interface AsusDhcpLease {
    mac: string;
    hostname: string;
}

export interface AsusPublicIpInfo {
    activeWanUnit: number;
    /** IP address on the router's WAN interface. */
    wanIp: string;
    /** Public IP the router detected on the internet side, if the check has completed. */
    publicIp?: string;
    /** True when the WAN IP differs from the public IP (double NAT / CGNAT); undefined if unknown. */
    behindNat?: boolean;
}
