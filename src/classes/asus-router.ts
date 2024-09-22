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
import {RebootNetworkPayload, SetActiveVPNPayload, WakeOnLanPayload} from "../models/requests/apply-app-payloads";

export class AsusRouter extends AsusClient {
    constructor(ax: AxiosInstance, url: string, mac: string, username: string, password: string) {
        super(ax, url, mac, username, password);
        super.authenticate().then(() => {}).catch((e) => {
            throw new Error(e);
        });
    }

    /**
     * Fetches the total traffic data from the application.
     *
     * @return {Promise<AsusTrafficData>} A promise that resolves with the total traffic data.
     */
    async getTotalTrafficData(): Promise<AsusTrafficData> {
        return await this.appGet<NetdevData, AsusTrafficData>(AppGetPayloads.TrafficData, trafficDataTransformer);
    }

    /**
     * Fetches the status of the Wide Area Network (WAN) connection.
     *
     * @return {Promise<AsusWanLinkStatus>} A promise that resolves to the status of the WAN connection.
     */
    async getWANStatus(): Promise<AsusWanLinkStatus> {
        return await this.appGet<string, AsusWanLinkStatus>(AppGetPayloads.WANStatus, wanLinkTransformer);
    }

    /**
     * Retrieves the list of Wake-on-LAN devices.
     *
     * @return {Promise<AsusWakeOnLanDevice[]>} A promise that resolves to an array of AsusWakeOnLanDevice objects.
     */
    async getWakeOnLanDevices(): Promise<AsusWakeOnLanDevice[]> {
        return await this.appGet<Wollist, AsusWakeOnLanDevice[]>(AppGetPayloads.WakeOnLanList, wollistTransformer);
    }

    /**
     * Sends a Wake-on-LAN (WoL) request to the specified device.
     *
     * @param {AsusWakeOnLanDevice} wolDevice - The Wake-on-LAN device information required to send the request.
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating the success of the WoL request.
     */
    async callWakeOnLan(wolDevice: AsusWakeOnLanDevice): Promise<boolean> {
        return await this.applyAppPOST(WakeOnLanPayload(wolDevice));
    }

    /**
     * Retrieves a list of VPN clients.
     *
     * @return {Promise<AsusVpnClient[]>} A promise that resolves to an array of AsusVpnClient objects representing the VPN clients.
     */
    async getVpnClients(): Promise<AsusVpnClient[]> {
        return await this.appGet<VpnClient, AsusVpnClient[]>(AppGetPayloads.VpnClients, VpnClientTransformer);
    }

    /**
     * Sets the active VPN client for the application. If no client is provided, the current active VPN client is set.
     *
     * @param {AsusVpnClient} [client] - An optional parameter representing the Asus VPN client to be set as active.
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the operation was successful.
     */
    async setActiveVpnClient(client?: AsusVpnClient): Promise<boolean> {
        if (client) {
            return await this.applyAppPOST(SetActiveVPNPayload(client));
        } else {
            return await this.applyAppPOST(SetActiveVPNPayload());
        }
    }

    /**
     * Retrieves a list of Ookla servers.
     *
     * @return {Promise<AsusOoklaServer[]>} A promise that resolves to an array of AsusOoklaServers.
     */
    async getOoklaServers(): Promise<AsusOoklaServer[]> {
        return await this.appGet<OoklaSpeedtestServers, AsusOoklaServer[]>(AppGetPayloads.OoklaServers, OoklaSpeedtestServersTransformer);
    }

    /**
     * Retrieves the history of Ookla speed tests.
     *
     * @return {Promise<AsusOoklaSpeedtestResult[]>} A promise that resolves to an array of AsusOoklaSpeedtestResult objects representing the speed test history.
     */
    async getOoklaSpeedtestHistory(): Promise<AsusOoklaSpeedtestResult[]> {
        return await this.appGet<OoklaSpeedtestHistory, AsusOoklaSpeedtestResult[]>(AppGetPayloads.OoklaSpeedtestHistory, OoklaSpeedtestHistoryTransformer);
    }

    /**
     * Fetches the certificate from the specified endpoint.
     *
     * @return {Promise<any>} A promise that resolves to the retrieved certificate data in a stream format.
     */
    async getCertificate(): Promise<any> {
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: '/cert_key.tar',
            method: 'GET',
            responseType: "stream"
        });
        return response.data;
    }

    /**
     * Runs a speedtest using the specified Ookla server, updates the history,
     * and returns the result.
     *
     * @param {AsusOoklaServer} ooklaServer - The server to be used for the speedtest.
     * @return {Promise<AsusOoklaSpeedtestResult>} The result of the speedtest.
     */
    async runSpeedtest(ooklaServer: AsusOoklaServer): Promise<AsusOoklaSpeedtestResult> {
        let history: AsusOoklaSpeedtestResult[] = [];
        try {
            history = await this.getOoklaSpeedtestHistory();
        } catch (e) {
            console.log(e);
            console.log('History is broken. writing empty history on next result');
        }
        await this.setOoklaSpeedtestStartTime();
        await this.startOoklaSpeedtest(ooklaServer);
        const result = await this.getOoklaSpeedtestResult();
        await this.writeOoklaSpeedtestResult(history, result);
        return result;
    }

    /**
     * Initiates a network reboot by triggering the appropriate API call.
     *
     * @return {Promise<boolean>} A promise that resolves to true if the reboot command was successfully
     *                            issued, otherwise false.
     */
    async rebootNetwork(): Promise<boolean> {
        return await this.applyAppPOST(RebootNetworkPayload());
    }

    private async setOoklaSpeedtestStartTime(): Promise<boolean> {
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: '/set_ookla_speedtest_start_time.cgi',
            method: 'POST',
            data: new URLSearchParams({
                ookla_start_time: Date.now().toString()
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    private async startOoklaSpeedtest(ooklaServer: AsusOoklaServer): Promise<boolean> {
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: `/ookla_speedtest_exe.cgi`,
            method: 'POST',
            data: new URLSearchParams({
                type: '',
                id: `${ooklaServer.id}`
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    private async getOoklaSpeedtestResult(): Promise<AsusOoklaSpeedtestResult> {
        let nRetrieveResultAttempts = 0;
        while(nRetrieveResultAttempts < 30) {
            nRetrieveResultAttempts++;
            const data = await this.appGet<any, any>(AppGetPayloads.OoklaSpeedtestResult, (data: any) => data);
            const resultFound: AsusOoklaSpeedtestResult = data.ookla_speedtest_get_result.find((element: any) => element.type === 'result');
            if (resultFound) {
                return resultFound;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error(`unable to retrieve speedtest result`);
    }

    private async writeOoklaSpeedtestResult(history: AsusOoklaSpeedtestResult[], result: AsusOoklaSpeedtestResult): Promise<boolean> {
        const rebuiltHistory = history.map((element) => JSON.stringify(element)).join(`\n`);
        const resultString = JSON.stringify(result);
        const uglyJsonString = history.length > 0 ? `${resultString}\n${rebuiltHistory}` : resultString;
        const requestBody = new URLSearchParams({ speedTest_history: uglyJsonString });
        const response = await this.customAxRequest({
            url: '/ookla_speedtest_write_history.cgi',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: requestBody
        });
        return response.status >= 200 && response.status < 300;
    }
}