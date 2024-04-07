import {AxiosInstance} from "axios";
import {AsusClient} from "./asus-client";
import {AppGetPayloads} from "../models/requests/app-get-payloads";
import {NetdevData} from "../models/responses/netdev-data";
import {trafficDataTransformer} from "../transformers/traffic-data-transformer";
import {AsusTrafficData} from "../models/asus-traffic-data";
import {AsusWanLinkStatus} from "../models/asus-wan-link-status";
import {wanLinkTransformer} from "../transformers/wan-link-transformer";
import {Wollist} from "../models/responses/wollist";
import {AsusWakeOnLanDevice} from "../models/asus-wake-on-lan-device";
import {wollistTransformer} from "../transformers/wollist-transformer";
import {VpnClient} from "../models/responses/vpn-client";
import {AsusVpnClient} from "../models/asus-vpn-client";
import {VpnClientTransformer} from "../transformers/vpn-client-transformer";
import {AsusOoklaServer} from "../models/asus-ookla-server";
import {OoklaSpeedtestServers} from "../models/responses/ookla-speedtest-server";
import {OoklaSpeedtestServersTransformer} from "../transformers/ookla-speedtest-servers-transformer";
import {OoklaSpeedtestHistory} from "../models/responses/ookla-speedtest-history";
import {AsusOoklaSpeedtestResult} from "../models/asus-ookla-speedtest-result";
import {OoklaSpeedtestHistoryTransformer} from "../transformers/ookla-speedtest-history-transformer";

export class AsusRouter extends AsusClient {
    constructor(ax: AxiosInstance, ip: string, mac: string, username: string, password: string) {
        super(ax, ip, mac, username, password);
        super.authenticate().then(() => {
            console.log('router authenticated');
        }).catch((e) => {
            throw new Error(e);
        });
    }

    async getTotalTrafficData(): Promise<AsusTrafficData> {
        return await this.appGet<NetdevData, AsusTrafficData>(AppGetPayloads.TrafficData, trafficDataTransformer);
    }

    async getWANStatus(): Promise<AsusWanLinkStatus> {
        return await this.appGet<string, AsusWanLinkStatus>(AppGetPayloads.WANStatus, wanLinkTransformer);
    }

    async getWakeOnLanDevices(): Promise<AsusWakeOnLanDevice[]> {
        return await this.appGet<Wollist, AsusWakeOnLanDevice[]>(AppGetPayloads.WakeOnLanList, wollistTransformer);
    }

    async getVpnClients(): Promise<AsusVpnClient[]> {
        return await this.appGet<VpnClient, AsusVpnClient[]>(AppGetPayloads.VpnClients, VpnClientTransformer);
    }

    async getOoklaServers(): Promise<AsusOoklaServer[]> {
        return await this.appGet<OoklaSpeedtestServers, AsusOoklaServer[]>(AppGetPayloads.OoklaServers, OoklaSpeedtestServersTransformer);
    }

    // broken for now.
    // async getOoklaSpeedtestHistory(): Promise<AsusOoklaSpeedtestResult[]> {
    //     return await this.appGet<OoklaSpeedtestHistory, AsusOoklaSpeedtestResult[]>(AppGetPayloads.OoklaSpeedtestHistory, OoklaSpeedtestHistoryTransformer);
    // }
}