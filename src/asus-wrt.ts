import axios, { AxiosInstance } from "axios";
import { AsusOptions } from "./asus-options";
import { AsusRouter } from "./classes/asus-router";
import { AsusAccessPoint } from "./classes/asus-access-point";
import { AsusClient } from "./classes/asus-client";
import { Device, getCfgClientList } from "./models/responses/get-cfg-clientlist";
import { AppGetPayloads } from "./models/requests/app-get-payloads";
import * as https from "node:https";
import { AsusConnectedDevice, ConnectionMethod } from "./models/asus-connected-device";

export class AsusWrt {
    public asusRouter: AsusRouter | undefined = undefined;
    public asusAccessPoints: AsusAccessPoint[] = [];
    public allClients: AsusClient[] = [];
    private readonly ax: AxiosInstance;
    private abortController = new AbortController();
    private mainClient: AsusClient | undefined = undefined;

    constructor(private options: AsusOptions) {
        this.ax = axios.create({
            baseURL: options.baseURL,
            signal: this.abortController.signal,
            headers: {
                'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163'
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: !options.isSelfSignedCertificate,
            }),
        });

        this.ax.interceptors.response.use(async (response) => {
            if (response.config.url !== '/login.cgi' && response.data && response.data.error_status) {
                const client = this.allClients.find((client) => client.url === response.config.baseURL);
                await client?.authenticate();
                delete response.config.headers!['Cookie'];
                response.config.headers!['Cookie'] = `asus_token=${client?.asusToken}`;
                return this.ax.request(response.config);
            }
            return response;
        });
    }

    /**
     * Discover and authenticate clients, then retrieve and process the list of clients from the main client.
     *
     * @return {Promise<AsusClient[]>} A promise that resolves to a list of AsusClient instances.
     */
    public async discoverClients(): Promise<AsusClient[]> {
        this.mainClient = new AsusClient(this.ax, this.options.baseURL, '', this.options.username, this.options.password);
        await this.mainClient.authenticate();
        this.allClients = [];
        this.asusRouter = undefined;
        return await this.mainClient.appGet<getCfgClientList, AsusClient[]>(AppGetPayloads.CfgClientList, (response) => {
            response.get_cfg_clientlist.forEach((client) => {
                const formattedUrl = this.options.baseURL!.includes('https://') ? `https://${client.ip}` : this.options.baseURL!.includes('http://') ? `http://${client.ip}` : client.ip;
                if (client.config.backhalctrl) {
                    const accessPoint = this.createAccessPoint(formattedUrl, client);
                    this.asusAccessPoints.push(accessPoint);
                    this.allClients.push(accessPoint);
                } else {
                    this.asusRouter = this.createRouter(formattedUrl, client);
                    this.allClients.push(this.asusRouter);
                }
            });
            return this.allClients;
        });
    }

    /**
     * Updates the connected devices for all clients. This method retrieves data
     * using the main client, attempts to map wired and wifi clients (both 2G and 5G),
     * and updates the `connectedDevices` property for each client.
     *
     * @return {Promise<any>} A promise that resolves when the connected devices have been updated.
     */
    public async updateConnectedDevices(): Promise<any> {
        await this.mainClient!.appGet<ClientList, any>(AppGetPayloads.ClientList, (response) => {
            const allConnectedClients = response.get_clientlist;
            this.allClients.forEach((client) => {
                client.connectedDevices = [];
                const wiredClientList = response.get_wiredclientlist[client.mac];
                if (wiredClientList) {
                    wiredClientList.forEach((wiredClient) => {
                        if (response.get_clientlist[wiredClient]) {
                            client.connectedDevices.push(this.mapClientToAsusClient(allConnectedClients[wiredClient], 'wired'));
                        }
                    });
                }
                if (response.get_wclientlist[client.mac]) {
                    const twoGClientList = response.get_wclientlist[client.mac]['2G'];
                    if (twoGClientList) {
                        twoGClientList.forEach((twoGClient) => {
                            client.connectedDevices.push(this.mapClientToAsusClient(allConnectedClients[twoGClient], '2g'));
                        });
                    }
                    const fiveGClientList = response.get_wclientlist[client.mac]['5G'];
                    if (fiveGClientList) {
                        fiveGClientList.forEach((fiveGClient) => {
                            client.connectedDevices.push(this.mapClientToAsusClient(allConnectedClients[fiveGClient], '5g'));
                        });
                    }
                }
            });
        });
    }

    /**
     * Disposes the current instance by aborting ongoing operations and clearing associated properties.
     *
     * @return {void} No return value.
     */
    public dispose(): void {
        this.abortController.abort();
        this.asusRouter = undefined;
        this.asusAccessPoints = [];
        this.allClients = [];
        this.mainClient = undefined;
    }

    private mapClientToAsusClient(clientEntry: ClientEntry, connectionType: ConnectionMethod): AsusConnectedDevice {
        return <AsusConnectedDevice>{
            connectionMethod: connectionType,
            dpiDevice: clientEntry.dpiDevice,
            ip: clientEntry.ip,
            ipMethod: clientEntry.ipMethod,
            mac: clientEntry.mac,
            name: clientEntry.name,
            nickName: clientEntry.nickName,
            online: clientEntry.isOnline && clientEntry.isOnline === '1',
            rssi: clientEntry.rssi !== "" ? parseInt(clientEntry.rssi) : 0,
            vendor: clientEntry.vendor
        }
    }

    private createRouter = (url: string, deviceInfo: Device): AsusRouter => new AsusRouter(this.ax, url, deviceInfo.mac, this.options.username, this.options.password, deviceInfo);

    private createAccessPoint = (url: string, deviceInfo: Device): AsusAccessPoint => new AsusAccessPoint(this.ax, url, deviceInfo.mac, this.options.username, this.options.password, deviceInfo);
}
