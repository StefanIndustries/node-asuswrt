import {AsusResponse} from "./asus-response";

export interface getCfgClientList extends AsusResponse {
    get_cfg_clientlist: DeviceList;
}

interface BandInfo {
    unit: number;
}

interface Capability {
    [key: string]: number | { Ver: number, Count: number, Ports: { [key: string]: { Def: number, Type: number, SubType: number, index: number, amas_ethernet: string } } };
}

interface Config {
    wireless?: {
        wl0_radio: string,
        wl1_radio: string
    },
    misc?: {
        cfg_alias: string
    },
    backhalctrl?: {
        amas_ethernet: string
    },
    link_aggregation?: {
        lacp_enabled: string
    },
    ctrl_led?: {
        led_val: string
    },
    prefer_ap?: {
        amas_wlc_target_bssid: string,
        amas_wlc0_target_bssid: string,
        amas_wlc1_target_bssid: string
    }
}

interface WiredPort {
    wan_port_count?: number,
    wan_port?: {
        [key: string]: {
            link_rate: string
        }
    }
}

interface Device {
    alias: string;
    model_name: string;
    ui_model_name: string;
    icon_model_name: string;
    product_id: string;
    frs_model_name: string;
    fwver: string;
    newfwver: string;
    ip: string;
    mac: string;
    online: string;
    ap2g: string;
    ap5g: string;
    ap5g1: string;
    apdwb: string;
    ap6g: string;
    wired_mac: string[];
    pap2g: string;
    rssi2g: string;
    pap5g: string;
    rssi5g: string;
    pap6g: string;
    rssi6g: string;
    level: string;
    re_path: string;
    config: Config;
    sta2g: string;
    sta5g: string;
    sta6g: string;
    capability: Capability;
    ap2g_ssid: string;
    ap5g_ssid: string;
    ap5g1_ssid: string;
    ap6g_ssid: string;
    pap2g_ssid: string;
    pap5g_ssid: string;
    pap6g_ssid: string;
    wired_port: WiredPort;
    plc_status: any;
    band_num: string;
    tcode: string;
    misc_info: { [key: string]: string };
    ap2g_fh: string;
    ap5g_fh: string;
    ap5g1_fh: string;
    ap6g_fh: string;
    ap2g_ssid_fh: string;
    ap5g_ssid_fh: string;
    ap5g1_ssid_fh: string;
    ap6g_ssid_fh: string;
    band_info: { [key: string]: BandInfo };
}

type DeviceList = Device[];