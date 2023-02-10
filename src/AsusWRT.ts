import axios, {AxiosInstance, AxiosRequestConfig} from "axios";
import {AsusWRTRouter} from "./models/AsusWRTRouter";
import {AsusWRTOperationMode} from "./models/AsusWRTOperationMode";
import {AsusWRTConnectedDevice} from "./models/AsusWRTConnectedDevice";
import {AsusWRTTokenProvider} from "./AsusWRTTokenProvider";
import {AsusWRTLoad} from "./models/AsusWRTLoad";
import {AsusWRTWANStatus} from "./models/AsusWRTWANStatus";
import {AsusWRTTrafficData} from "./models/AsusWRTTrafficData";

export class AsusWRT {
    private axiosInstance: AxiosInstance;
    private abortController = new AbortController();
    private asusTokenProvider: AsusWRTTokenProvider;
    private macIpBinding = new Map<string, string>();

    constructor(baseUrl: string, private username: string, private password: string, private debug?: boolean) {
        this.axiosInstance = axios.create({
            baseURL: baseUrl,
            timeout: 30000,
            headers: { 'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163' }
        });

        this.asusTokenProvider = new AsusWRTTokenProvider(this.axiosInstance, username, password);

        if (this.debug) {
            this.axiosInstance.interceptors.request.use(async (request) => {
                console.log("url", request.url);
                console.log("data", request.data);
                return request;
            });

            this.axiosInstance.interceptors.response.use(async (response) => {
                console.log("response status", response.status);
                console.log("response data", response.data);
                return response;
            });
        }

        this.getRouters().then(routers => {
            routers.forEach(router => {
                this.macIpBinding.set(router.mac, this.axiosInstance.defaults.baseURL!.includes('https://') ? `https://${router.ip}` : `http://${router.ip}`);
            });
        });
    }

    private async appGet(payload: string, routerIP?: string): Promise<any> {
        const path = '/appGet.cgi';
        const config: AxiosRequestConfig = {
            method: 'POST',
            url: path,
            data: new URLSearchParams({
                hook: payload
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            signal: this.abortController.signal
        };
        if (routerIP) {
            config.baseURL = routerIP;
        }
        const result = await this.axiosInstance(config).catch(err => {
            if (this.debug) {
                console.log(err);
            }
            return Promise.reject(err);
        });
        return result!.data;
    }

    private async applyApp(payload: string, routerIP?: string): Promise<boolean> {
        const path = '/applyapp.cgi';
        const config: AxiosRequestConfig = {
            method: 'GET',
            url: `${path}?${payload}`,
            signal: this.abortController.signal
        };
        if (routerIP) {
            config.baseURL = routerIP;
        }
        const result = await this.axiosInstance(config).catch(err => {
            if (this.debug) {
                console.log(err);
            }
            return Promise.reject(err);
        })
        return result.status === 200
    }

    public dispose() {
        this.abortController.abort();
        this.asusTokenProvider.disposeCache();
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
        const clientsData = await this.appGet('get_clientlist();get_wiredclientlist()');
        clientsData.get_wiredclientlist[routerMac].forEach((mac: string) => {
            if (clientsData.get_clientlist.maclist.includes(mac)) {
                const device = clientsData.get_clientlist[mac];
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

    public async getWirelessClients(routerMac: string, band: '2G' | '5G'): Promise<AsusWRTConnectedDevice[]> {
        let wirelessClients: AsusWRTConnectedDevice[] = [];
        const clientsData = await this.appGet('get_clientlist();get_wclientlist()');
        if (!clientsData.get_wclientlist[routerMac][band]) {
            return wirelessClients;
        }
        clientsData.get_wclientlist[routerMac][band].forEach((mac: string) => {
            if (clientsData.get_clientlist.maclist.includes(mac)) {
                const device = clientsData.get_clientlist[mac];
                wirelessClients.push(<AsusWRTConnectedDevice> {
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
        return wirelessClients;
    }

    public async setLedsEnabled(routerMac: string, enabled: boolean): Promise<boolean> {
        return await this.applyApp(`config={"led_val":${enabled ? 1 : 0}}&re_mac=${routerMac}&action_mode=config_changed`);
    }

    public async rebootNetwork(): Promise<boolean> {
        const result = await this.applyApp(`action_mode=device_reboot`);
        if (result) {
            this.asusTokenProvider.disposeCache();
        }
        return result;
    }

    public async getCPUMemoryLoad(routerMac: string): Promise<AsusWRTLoad> {
        const cpuMemoryData = await this.appGet(`cpu_usage(appobj);memory_usage(appobj)`, this.macIpBinding.get(routerMac));
        return {
            CPUUsagePercentage: this.getCPUUsagePercentage(cpuMemoryData.cpu_usage),
            MemoryUsagePercentage: this.getMemoryUsagePercentage(cpuMemoryData.memory_usage)
        };
    }

    public async getTotalTrafficData(): Promise<AsusWRTTrafficData> {
        const trafficData = await this.appGet('netdev(appobj)');
        const trafficReceived = (parseInt(trafficData['netdev']['INTERNET_rx'], 16) * 8 / 1024 / 1024) * 0.125;
        const trafficSent = (parseInt(trafficData['netdev']['INTERNET_tx'], 16) * 8 / 1024 / 1024) * 0.125;
        return {
            trafficReceived: trafficReceived,
            trafficSent: trafficSent
        };
    }

    public async getWANStatus(): Promise<AsusWRTWANStatus> {
        let status: any = {};
        const wanData = <string> await this.appGet('wanlink()');
        wanData.split('\n').forEach(line => {
            if (line.includes('return') && line.includes('wanlink_')) {
                const key = line.substring(line.indexOf('_') + 1, line.indexOf('('));
                let value = line.substring(line.indexOf('return ') + 7, line.indexOf(';}'));
                if (value.includes(`'`)) {
                    status[key] = value.substring(1, value.length - 1);
                } else {
                    status[key] = parseInt(value);
                }
            }
        });
        return <AsusWRTWANStatus> status;
    }

    public async getUptime(routerMac: string): Promise<number> {
        const uptimeData = await this.appGet('uptime()', this.macIpBinding.get(routerMac));
        if (uptimeData && typeof uptimeData === 'string') {
            let uptimeSeconds = uptimeData.substring(uptimeData.indexOf(':'));
            uptimeSeconds = uptimeSeconds.substring(uptimeSeconds.indexOf("(") + 1);
            uptimeSeconds = uptimeSeconds.substring(0, uptimeSeconds.indexOf(" "));
            return parseInt(uptimeSeconds);
        } else {
            return 0;
        }
    }

    private getCPUUsagePercentage(cpuUsageObj: any): number {
        let totalAvailable = 0;
        let totalUsed = 0;
        for (let i = 1; i < 16; i++) {
            totalAvailable += this.addNumberValueIfExists(cpuUsageObj, `cpu${i}_total`);
        }
        for (let i = 1; i < 16; i++) {
            totalUsed += this.addNumberValueIfExists(cpuUsageObj, `cpu${i}_usage`);
        }
        return (100 / totalAvailable) * totalUsed;
    }

    private addNumberValueIfExists(object: any, property: string): number {
        if (object[property]) {
            return parseInt(object[property]);
        }
        return 0;
    }

    private getMemoryUsagePercentage(memoryUsageObj: any): number {
        const totalMemory = parseInt(memoryUsageObj.mem_total);
        const memUsed = parseInt(memoryUsageObj.mem_used);
        return (100 / totalMemory) * memUsed;
    }
}
