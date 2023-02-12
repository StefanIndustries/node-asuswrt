import axios, {AxiosInstance, AxiosRequestConfig} from "axios";
import {AsusWRTRouter} from "./models/AsusWRTRouter";
import {AsusWRTOperationMode} from "./models/AsusWRTOperationMode";
import {AsusWRTConnectedDevice} from "./models/AsusWRTConnectedDevice";
import {AsusWRTTokenProvider} from "./AsusWRTTokenProvider";
import {AsusWRTLoad} from "./models/AsusWRTLoad";
import {AsusWRTWANStatus} from "./models/AsusWRTWANStatus";
import {AsusWRTTrafficData} from "./models/AsusWRTTrafficData";
import {AsusWRTWakeOnLanDevice} from "./models/AsusWRTWakeOnLanDevice";
import {AsusWRTOoklaServer} from "./models/AsusWRTOoklaServer";
import {AsusWRTOoklaSpeedtestHistory} from "./models/AsusWRTOoklaSpeedtestHistory";

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
                console.log("url", request.baseURL! + request.url);
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
            baseURL: routerIP ? routerIP : this.axiosInstance.defaults.baseURL,
            signal: this.abortController.signal
        };
        const result = await this.axiosInstance(config).catch(err => {
            if (this.debug) {
                console.log(err);
            }
            return Promise.reject(err);
        });
        return result!.data;
    }

    private async applyAppGET(payload: string, routerIP?: string): Promise<boolean> {
        const path = '/applyapp.cgi';
        const config: AxiosRequestConfig = {
            method: 'GET',
            url: `${path}?${payload}`,
            baseURL: routerIP ? routerIP : this.axiosInstance.defaults.baseURL,
            signal: this.abortController.signal
        };
        const result = await this.axiosInstance(config).catch(err => {
            if (this.debug) {
                console.log(err);
            }
            return Promise.reject(err);
        })
        return result.status === 200
    }

    private async applyAppPOST(payload: any, routerIP?: string): Promise<boolean> {
        const path = '/applyapp.cgi';
        const config: AxiosRequestConfig = {
            method: 'POST',
            url: `${path}`,
            data: new URLSearchParams(payload),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            baseURL: routerIP ? routerIP : this.axiosInstance.defaults.baseURL,
            signal: this.abortController.signal
        };
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

    public async getAllClients(): Promise<AsusWRTConnectedDevice[]> {
        let allClients: AsusWRTConnectedDevice[] = [];
        const clientsData = await this.appGet('get_clientlist()');
        clientsData.get_clientlist.maclist.forEach((macAddr: string) => {
            const device = clientsData.get_clientlist[macAddr];
            allClients.push(<AsusWRTConnectedDevice> {
                ip: device.ip,
                mac: device.mac,
                name: device.name,
                nickName: device.nickName,
                dpiDevice: device.dpiDevice,
                vendor: device.vendor,
                ipMethod: device.ipMethod,
                rssi: device.rssi !== "" ? parseInt(device.rssi) : 0,
                online: device.isOnline && device.isOnline === '1'
            });
        });
        return allClients;
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
                    rssi: device.rssi !== "" ? parseInt(device.rssi) : 0,
                    online: device.isOnline && device.isOnline === '1'
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
                    rssi: device.rssi !== "" ? parseInt(device.rssi) : 0,
                    online: device.isOnline && device.isOnline === '1'
                });
            }
        });
        return wirelessClients;
    }

    public async getWakeOnLanList(): Promise<AsusWRTWakeOnLanDevice[]> {
        let wolClients: AsusWRTWakeOnLanDevice[] = [];
        const wolClientsData = await this.appGet('nvram_get(wollist);');
        const wollistUnsplitted = wolClientsData.wollist;
        const wollistSplitted =  wollistUnsplitted.split('&#60');
        if (wollistSplitted.length > 0) {
            wollistSplitted.forEach((item: any) => {
                if (item.indexOf('&#62') > 0) {
                    const splittedItem = item.split('&#62');
                    wolClients.push({
                        name: splittedItem[0],
                        mac: splittedItem[1]
                    });
                }
            });
        }
        return wolClients;
    }

    public async setLedsEnabled(routerMac: string, enabled: boolean): Promise<boolean> {
        return await this.applyAppGET(`config={"led_val":${enabled ? 1 : 0}}&re_mac=${routerMac}&action_mode=config_changed`);
    }

    public async wakeOnLan(deviceMac: string): Promise<boolean> {
        return await this.applyAppPOST({
            current_page: "Main_WOL_Content.asp",
            SystemCmd: `ether-wake -i br0 ${deviceMac}`,
            action_mode: " Refresh "
        });
    }

    public async rebootNetwork(): Promise<boolean> {
        const result = await this.applyAppGET(`action_mode=device_reboot`);
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

    public async getOoklaServers(): Promise<AsusWRTOoklaServer[]> {
        const ooklaServers: AsusWRTOoklaServer[] = [];
        const ooklaServerData = await this.appGet('ookla_speedtest_get_servers()');
        ooklaServerData.ookla_speedtest_get_servers.forEach((server: { id: number; host: string; port: number; name: string; location: string; country: string; }) => {
            if (server.id) {
                ooklaServers.push({
                    id: server.id,
                    host: server.host,
                    port: server.port,
                    name: server.name,
                    location: server.location,
                    country: server.country
                });
            }
        })
        return ooklaServers;
    }

    public async getOoklaSpeedtestHistory(): Promise<AsusWRTOoklaSpeedtestHistory[]> {
        const ooklaSpeedtestHistory: AsusWRTOoklaSpeedtestHistory[] = [];
        const ooklaHistoryData = await this.appGet('ookla_speedtest_get_history()');
        ooklaHistoryData.ookla_speedtest_get_history.forEach((entry: { timestamp: any; ping: { jitter: any; latency: any; }; download: { bandwidth: any; bytes: any; elapsed: any; }; upload: { bandwidth: any; bytes: any; elapsed: any; }; packetLoss: any; isp: any; }) => {
            if (entry.timestamp) {
                ooklaSpeedtestHistory.push({
                    timestamp: new Date(entry.timestamp),
                    ping: {
                        jitter: entry.ping.jitter,
                        latency: entry.ping.latency
                    },
                    download: {
                        bandwidth: entry.download.bandwidth,
                        bytes: entry.download.bytes,
                        elapsed: entry.download.elapsed
                    },
                    upload: {
                        bandwidth: entry.upload.bandwidth,
                        bytes: entry.upload.bytes,
                        elapsed: entry.upload.elapsed
                    },
                    packetLoss: entry.packetLoss,
                    isp: entry.isp
                });
            }
        });
        return ooklaSpeedtestHistory;
    }

    public async startOoklaSpeedtest(ooklaServer: AsusWRTOoklaServer): Promise<boolean> {
        const config: AxiosRequestConfig = {
            method: 'POST',
            url: '/ookla_speedtest_exe.cgi',
            data: new URLSearchParams({
                type: '',
                id: `${ooklaServer.id}`
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            signal: this.abortController.signal
        };
        const result = await this.axiosInstance(config).catch(err => {
            if (this.debug) {
                console.log(err);
            }
            return Promise.reject(err);
        });
        return result.status === 200;
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
