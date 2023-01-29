import axios, {AxiosInstance} from "axios";
import {AsusWRTRouter} from "./models/AsusWRTRouter";
import {AsusWRTOperationMode} from "./models/AsusWRTOperationMode";
import {AsusWRTConnectedDevice} from "./models/AsusWRTConnectedDevice";

export class AsusWRT {
    private loginSessionStart: number | null = null;
    private axiosInstance: AxiosInstance;
    private abortController = new AbortController();

    constructor(baseUrl: string, private username: string, private password: string) {
        this.axiosInstance = axios.create({
            baseURL: baseUrl,
            timeout: 10000,
            headers: { 'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163' }
        })

        this.axiosInstance.interceptors.request.use(async (request) => {
            if (request.url !== '/login.cgi' && (!this.isLoggedIn() || this.isSessionOlderThan10Minutes())) {
                const newToken = await this.login().catch(error => Promise.reject(error));
                const originalRequestConfig = request;
                delete originalRequestConfig.headers!['Cookie'];
                originalRequestConfig.headers!['Cookie'] = newToken;
                return originalRequestConfig;
            }
            return request;
        });

        this.axiosInstance.interceptors.response.use(
            config => config,
            error => {
                return Promise.reject(error);
            }
        );
    }

    private isLoggedIn(): boolean {
        return this.loginSessionStart !== null;
    }

    private isSessionOlderThan10Minutes(): boolean {
        if (!this.loginSessionStart) {
            return true;
        }
        return (Date.now() - this.loginSessionStart) > 10 * 60 * 1000;
    }

    public async login(): Promise<boolean> {
        const path = '/login.cgi';
        const result = await this.axiosInstance({
            method: 'POST',
            url: path,
            data: new URLSearchParams({
                login_authorization: Buffer.from(`${this.username}:${this.password}`).toString('base64')
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            signal: this.abortController.signal
        });
        if (!result.data.asus_token) {
            return Promise.reject(false);
        }
        this.axiosInstance.defaults.headers.common['Cookie'] = `asus_token=${result.data.asus_token}`;
        this.loginSessionStart = Date.now();
        return true;
    }

    private async appGet(payload: string): Promise<any> {
        const path = '/appGet.cgi';
        const result = await this.axiosInstance({
            method: 'POST',
            url: path,
            data: new URLSearchParams({
                hook: payload
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            signal: this.abortController.signal
        });
        return result.data;
    }

    private async applyApp(payload: any): Promise<any> {
        const path = '/applyapp.cgi';
        const result = await this.axiosInstance({
            method: 'POST',
            url: path,
            data: payload,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            signal: this.abortController.signal
        });
        return result.data;
    }

    public dispose() {
        this.abortController.abort();
    }

    public async getRouters(): Promise<AsusWRTRouter[]> {
        const cfgClientListResponse = await this.appGet('get_cfg_clientlist()');
        return cfgClientListResponse.get_cfg_clientlist.map((client: { alias: any; model_name: any; ui_model_name: any; product_id: any; fwver: any; newfwver: any; ip: any; mac: any; online: any; config: { backhalctrl: any; }; }) => {
            return <AsusWRTRouter> {
                alias: client.alias,
                modelName: client.model_name,
                uiModelName: client.ui_model_name,
                productId: client.product_id,
                firmwareVersion: client.fwver,
                newFirmwareVersion: client.newfwver,
                ip: client.ip,
                mac: client.mac,
                online: !!(client.online && client.online === "1"),
                operationMode: client.config && client.config.backhalctrl ? AsusWRTOperationMode.AccessPoint : AsusWRTOperationMode.Router
            }
        });
    }

    public async getWiredClients(routerMac: string): Promise<AsusWRTConnectedDevice[]> {
        let wiredClients: AsusWRTConnectedDevice[] = [];
        const allClientsData = await this.appGet('get_clientlist()');
        const wiredClientsData = await this.appGet('get_wiredclientlist()');
        wiredClientsData.get_wiredclientlist[routerMac].forEach((mac: string) => {
            if (allClientsData.get_clientlist.maclist.includes(mac)) {
                const device = allClientsData.get_clientlist[mac];
                wiredClients.push(<AsusWRTConnectedDevice> {
                    ip: device.ip,
                    mac: device.mac,
                    name: device.name,
                    nickName: device.nickName,
                    dpiDevice: device.dpiDevice,
                    vendor: device.vendor,
                    ipMethod: device.ipMethod,
                    rssi: device.rssi !== "" ? parseInt(device.rssi) : 0
                });
            }
        });
        return wiredClients;
    }
}
