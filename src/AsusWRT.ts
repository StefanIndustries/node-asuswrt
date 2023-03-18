import {AsusWRTRouter} from "./models/AsusWRTRouter";
import {AsusWRTOperationMode} from "./models/AsusWRTOperationMode";
import {AsusWRTConnectedDevice} from "./models/AsusWRTConnectedDevice";
import {AsusWRTLoad} from "./models/AsusWRTLoad";
import {AsusWRTWANStatus} from "./models/AsusWRTWANStatus";
import {AsusWRTTrafficData} from "./models/AsusWRTTrafficData";
import {AsusWRTWakeOnLanDevice} from "./models/AsusWRTWakeOnLanDevice";
import {AsusWRTOoklaServer} from "./models/AsusWRTOoklaServer";
import {AsusWRTOoklaSpeedtestHistory} from "./models/AsusWRTOoklaSpeedtestHistory";
import {AsusWRTOptions} from "./models/AsusWRTOptions";
import {AsusWRTCache} from "./models/AsusWRTCache";
import fetch, {Response} from "node-fetch";

export class AsusWRT {
    private macIpBinding = new Map<string, string>();
    private cacheDictionary = new Map<string, AsusWRTCache>();

    constructor(private options: AsusWRTOptions) {
        this.debugLog(`[CONSTRUCTOR]`, options);
        this.getRouters().then(routers => {
            this.debugLog('init found routers', routers);
            routers.forEach(router => {
                this.macIpBinding.set(router.mac, this.options.BaseUrl!.includes('https://') ? `https://${router.ip}` : `http://${router.ip}`);
            });
        });
    }

    private debugLog(logDescription: string, logData?: any) {
        if (this.options.InfoLogCallback) {
            const logTitle = `[${this.constructor.name}] [INFO] ${logDescription}`;
            if (logData) {
                this.options.InfoLogCallback(logTitle, logData);
            } else {
                this.options.InfoLogCallback(logTitle);
            }
        }
    }

    private errorLog(logDescription: string, logData?: any) {
        if (this.options.ErrorLogCallback) {
            const logTitle = `[${this.constructor.name}] [ERROR] ${logDescription}`;
            if (logData) {
                this.options.ErrorLogCallback(logTitle, logData);
            } else {
                this.options.ErrorLogCallback(logTitle);
            }
        }
    }

    private async getToken(baseUrl: string): Promise<string> {
        this.debugLog(`[getToken]`);
        const cache = this.cacheDictionary.get(<string> baseUrl);
        if (cache && this.isLoggedIn(cache)) {
            this.debugLog(`[getToken] token found in cache and valid`);
            return cache.Token;
        } else {
            this.debugLog(`[getToken] token expired or not found`);
            try {
                const newToken = await this.login(baseUrl);
                this.debugLog(`[getToken] token retrieved from login`);
                this.cacheDictionary.set(<string>baseUrl, <AsusWRTCache>{
                    Token: newToken,
                    TokenDate: Date.now(),
                    RouterIP: baseUrl
                });
                this.debugLog(`[getToken] token set in cache`);
                return newToken;
            } catch (err) {
                this.errorLog(`[getToken] ${baseUrl}`, err);
                throw new Error(`[getToken] ${baseUrl}`);
            }
        }
    }

    private isLoggedIn(cache: AsusWRTCache): boolean {
        const isLoggedInResult = cache.Token !== '' && cache.TokenDate !== null && cache.TokenDate < Date.now() - (10 * 60 * 1000);
        this.debugLog(`[isLoggedIn] ${cache.RouterIP}`, isLoggedInResult);
        return isLoggedInResult
    }

    private async login(baseUrl: string): Promise<string> {
        const path = '/login.cgi';
        const formattedUsernamePassword = Buffer.from(`${this.options.Username}:${this.options.Password}`).toString('base64');
        this.debugLog(`[login] ${baseUrl}`);
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    login_authorization: formattedUsernamePassword
                })
            });
            this.debugLog(`[login] login result`, response.status);
            if (!await this.checkStatus(response)) {
                this.errorLog('[login]', response);
                throw new Error('[login]');
            } else {
                const jsonResult = <any> await response.json();
                return jsonResult.asus_token;
            }
        } catch (err) {
            this.errorLog(`[login] ${baseUrl}`, err);
            throw new Error(`[login] ${baseUrl}`);
        }
    }

    private async appGet(payload: string, routerIP?: string): Promise<any> {
        const path = '/appGet.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`[appGet] ${url} ${path} ${payload}`);
        try {
            const response = await fetch(`${url}${path}`, {
                method: 'POST',
                body: new URLSearchParams({
                    hook: payload
                }),
                headers: await this.getDefaultHeadersIncludingToken(url)
            })
            if (await this.checkStatus(response)) {
                this.debugLog(`[appGet] ${payload}`, response.status);
                const result = await response.text();
                try {
                    return JSON.parse(result);
                } catch (err) {
                    this.errorLog('[appGet] parsing JSON', result);
                }
                return result;
            }
        } catch (err) {
            this.errorLog(`[appGet] ${url} ${path} ${payload}`, err);
            throw new Error(`[appGet] ${url} ${path} ${payload}`);
        }
    }

    private async applyAppGET(payload: string, routerIP?: string): Promise<boolean> {
        const path = '/applyapp.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`[applyAppGET] ${url} ${path} ${payload}`);
        try {
            const response = await fetch(`${url}${path}?${payload}`, {
                method: 'GET',
                headers: await this.getDefaultHeadersIncludingToken(url)
            });
            return await this.checkStatus(response);
        } catch (err) {
            this.errorLog(`[applyAppGET] ${url} ${path} ${payload}`, err);
            throw new Error(`[applyAppGET] ${url} ${path} ${payload}`);
        }
    }

    private async applyAppPOST(payload: any, routerIP?: string): Promise<boolean> {
        const path = '/applyapp.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`[applyAppPOST] ${url} ${path} ${payload}`);
        try {
            const response = await fetch(`${url}${path}`, {
                method: 'POST',
                body: new URLSearchParams(payload),
                headers: await this.getDefaultHeadersIncludingToken(url)
            });
            return await this.checkStatus(response);
        } catch (err) {
            this.errorLog(`[applyAppPOST] ${url} ${path} ${payload}`, err);
            throw new Error(`[applyAppPOST] ${url} ${path} ${payload}`);
        }
    }

    public dispose() {
        this.cacheDictionary.clear();
        this.macIpBinding.clear();
    }

    //
    public async getRouters(): Promise<AsusWRTRouter[]> {
        this.debugLog('[getRouters]');
        try {
            const cfgClientListResponse = await this.appGet('get_cfg_clientlist()');
            return cfgClientListResponse.get_cfg_clientlist.map((client: { alias: any; model_name: any; ui_model_name: any; product_id: any; fwver: any; newfwver: any; ip: any; mac: any; online: any; config: { backhalctrl: any; }; }) => {
                return <AsusWRTRouter>{
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
        } catch (err) {
            this.errorLog(`[getRouters]`, err);
            throw new Error(`[getRouters] ${err}`);
        }
    }

    public async getAllClients(): Promise<AsusWRTConnectedDevice[]> {
        this.debugLog(`[getAllClients]`);
        let allClients: AsusWRTConnectedDevice[] = [];
        try {
            const clientsData = await this.appGet('get_clientlist()');
            clientsData.get_clientlist.maclist.forEach((macAddr: string) => {
                const device = clientsData.get_clientlist[macAddr];
                allClients.push(<AsusWRTConnectedDevice>{
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
        } catch (err) {
            this.errorLog(`[getAllClients]`, err);
            throw new Error(`[getAllClients] ${err}`);
        }
    }

    public async getWiredClients(routerMac: string): Promise<AsusWRTConnectedDevice[]> {
        this.debugLog(`[getWiredClients]`, routerMac);
        let wiredClients: AsusWRTConnectedDevice[] = [];
        try {
            const clientsData = await this.appGet('get_clientlist();get_wiredclientlist()');
            clientsData.get_wiredclientlist[routerMac].forEach((mac: string) => {
                if (clientsData.get_clientlist.maclist.includes(mac)) {
                    const device = clientsData.get_clientlist[mac];
                    wiredClients.push(<AsusWRTConnectedDevice>{
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
        } catch (err) {
            this.errorLog(`[getWirelessClients] ${routerMac}`, err);
            throw new Error(`[getWirelessClients] ${routerMac} ${err}`);
        }
    }

    public async getWirelessClients(routerMac: string, band: '2G' | '5G'): Promise<AsusWRTConnectedDevice[]> {
        this.debugLog(`[getWirelessClients]`, [routerMac, band]);
        let wirelessClients: AsusWRTConnectedDevice[] = [];
        try {
            const clientsData = await this.appGet('get_clientlist();get_wclientlist()');
            if (!clientsData.get_wclientlist[routerMac][band]) {
                return wirelessClients;
            }
            clientsData.get_wclientlist[routerMac][band].forEach((mac: string) => {
                if (clientsData.get_clientlist.maclist.includes(mac)) {
                    const device = clientsData.get_clientlist[mac];
                    wirelessClients.push(<AsusWRTConnectedDevice>{
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
        } catch (err) {
            this.errorLog(`[getWirelessClients] ${routerMac}`, err);
            throw new Error(`[getWirelessClients] ${routerMac} ${err}`);
        }
    }

    public async getWakeOnLanList(): Promise<AsusWRTWakeOnLanDevice[]> {
        this.debugLog(`[getWakeOnLanList]`);
        let wolClients: AsusWRTWakeOnLanDevice[] = [];
        try {
            const wolClientsData = await this.appGet('nvram_get(wollist);');
            const wollistUnsplitted = wolClientsData.wollist;
            const wollistSplitted = wollistUnsplitted.split('&#60');
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
        } catch (err) {
            this.errorLog(`[getWakeOnLanList]`, err);
            throw new Error(`[getWakeOnLanList] ${err}`);
        }
    }

    public async setLedsEnabled(routerMac: string, enabled: boolean): Promise<boolean> {
        this.debugLog(`[setLedsEnabled]`, [routerMac, enabled]);
        try {
            return await this.applyAppGET(`config={"led_val":${enabled ? 1 : 0}}&re_mac=${routerMac}&action_mode=config_changed`);
        } catch (err) {
            this.errorLog(`[setLedsEnabled] ${routerMac}`, err);
            throw new Error(`[setLedsEnabled] ${routerMac} ${err}`);
        }
    }

    public async wakeOnLan(deviceMac: string): Promise<boolean> {
        this.debugLog(`[wakeOnLan]`, deviceMac);
        try {
            return await this.applyAppPOST({
                current_page: "Main_WOL_Content.asp",
                SystemCmd: `ether-wake -i br0 ${deviceMac}`,
                action_mode: " Refresh "
            });
        } catch (err) {
            this.errorLog(`[wakeOnLan] ${deviceMac}`, err);
            throw new Error(`[wakeOnLan] ${deviceMac} ${err}`);
        }
    }

    public async rebootNetwork(): Promise<boolean> {
        this.debugLog(`[rebootNetwork]`);
        try {
            const result = await this.applyAppGET(`action_mode=device_reboot`);
            if (result) {
                this.cacheDictionary.clear();
            }
            return result;
        } catch (err) {
            this.errorLog(`[rebootNetwork]`, err);
            throw new Error(`[rebootNetwork] ${err}`);
        }
    }

    public async getCPUMemoryLoad(routerMac: string): Promise<AsusWRTLoad> {
        this.debugLog(`[getCPUMemoryLoad]`, routerMac);
        try {
            const cpuMemoryData = await this.appGet(`cpu_usage(appobj);memory_usage(appobj)`, this.macIpBinding.get(routerMac));
            this.debugLog('test', cpuMemoryData);
            return {
                CPUUsagePercentage: this.getCPUUsagePercentage(cpuMemoryData.cpu_usage),
                MemoryUsagePercentage: this.getMemoryUsagePercentage(cpuMemoryData.memory_usage)
            };
        } catch (err) {
            this.errorLog(`[getCPUMemoryLoad] ${routerMac}`, err);
            throw new Error(`[getCPUMemoryLoad] ${routerMac} ${err}`);
        }
    }

    public async getTotalTrafficData(): Promise<AsusWRTTrafficData> {
        this.debugLog(`[getTotalTrafficData]`);
        try {
            const trafficData = await this.appGet('netdev(appobj)');
            const trafficReceived = (parseInt(trafficData['netdev']['INTERNET_rx'], 16) * 8 / 1024 / 1024) * 0.125;
            const trafficSent = (parseInt(trafficData['netdev']['INTERNET_tx'], 16) * 8 / 1024 / 1024) * 0.125;
            return {
                trafficReceived: trafficReceived,
                trafficSent: trafficSent
            };
        } catch (err) {
            this.errorLog(`[getTotalTrafficData]`, err);
            throw new Error(`[getTotalTrafficData] ${err}`);
        }
    }

    public async getWANStatus(): Promise<AsusWRTWANStatus> {
        this.debugLog(`[getWANStatus]`);
        let status: any = {};
        try {
            const wanData = <string>await this.appGet('wanlink()');
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
            return <AsusWRTWANStatus>status;
        } catch (err) {
            this.errorLog(`[getUptime]`, err);
            throw new Error(`[getUptime] ${err}`);
        }
    }

    public async getUptime(routerMac: string): Promise<number> {
        this.debugLog(`[getUptime]`, routerMac);
        try {
            const uptimeData = await this.appGet('uptime()', this.macIpBinding.get(routerMac));
            if (uptimeData && typeof uptimeData === 'string') {
                let uptimeSeconds = uptimeData.substring(uptimeData.indexOf(':'));
                uptimeSeconds = uptimeSeconds.substring(uptimeSeconds.indexOf("(") + 1);
                uptimeSeconds = uptimeSeconds.substring(0, uptimeSeconds.indexOf(" "));
                return parseInt(uptimeSeconds);
            } else {
                return 0;
            }
        } catch (err) {
            this.errorLog(`[getUptime] ${routerMac}`, err);
            throw new Error(`[getUptime] ${routerMac} ${err}`);
        }
    }

    public async getOoklaServers(): Promise<AsusWRTOoklaServer[]> {
        this.debugLog(`[getOoklaServers]`);
        const ooklaServers: AsusWRTOoklaServer[] = [];
        try {
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
        } catch (err) {
            this.errorLog(`[getOoklaServers]`, err);
            throw new Error(`[getOoklaServers] ${err}`);
        }
    }

    public async getOoklaSpeedtestHistory(): Promise<AsusWRTOoklaSpeedtestHistory[]> {
        this.debugLog(`[getOoklaSpeedtestHistory]`);
        const ooklaSpeedtestHistory: AsusWRTOoklaSpeedtestHistory[] = [];
        try {
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
        } catch (err) {
            this.errorLog(`[getOoklaSpeedtestHistory]`, err);
            throw new Error(`[getOoklaSpeedtestHistory] ${err}`);
        }
    }

    public async startOoklaSpeedtest(ooklaServer: AsusWRTOoklaServer): Promise<boolean> {
        const path = '/ookla_speedtest_exe.cgi';
        this.debugLog(`[startOoklaSpeedtest]`, ooklaServer);
        try {
            const response = await fetch(`${this.options.BaseUrl}${path}`, {
                method: 'POST',
                body: new URLSearchParams({
                    type: '',
                    id: `${ooklaServer.id}`
                }),
                headers: await this.getDefaultHeadersIncludingToken(this.options.BaseUrl)
            })
            return this.checkStatus(response);
        } catch (err) {
            this.errorLog(`[startOoklaSpeedtest]`, err);
            throw new Error(`[startOoklaSpeedtest] ${err}`);
        }
    }

    private async getDefaultHeadersIncludingToken(baseUrl: string): Promise<any> {
        this.debugLog(`[getDefaultHeadersIncludingToken]`, baseUrl);
        return  {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `asus_token=${await this.getToken(baseUrl)}`,
            'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163'
        }
    }

    private getCPUUsagePercentage(cpuUsageObj: any): number {
        this.debugLog(`[getCPUUsagePercentage]`, cpuUsageObj);
        let totalAvailable = 0;
        let totalUsed = 0;
        for (let i = 1; i < 16; i++) {
            totalAvailable += this.addNumberValueIfExists(cpuUsageObj, `cpu${i}_total`);
        }
        for (let i = 1; i < 16; i++) {
            totalUsed += this.addNumberValueIfExists(cpuUsageObj, `cpu${i}_usage`);
        }
        if (totalAvailable > 0 && totalUsed > 0) {
            return (100 / totalAvailable) * totalUsed;
        } else {
            return 0;
        }
    }

    private addNumberValueIfExists(object: any, property: string): number {
        this.debugLog(`[addNumberValueIfExists]`);
        if (object && property && object[property]) {
            return parseInt(object[property]);
        }
        return 0;
    }

    private getMemoryUsagePercentage(memoryUsageObj: any): number {
        this.debugLog(`[getMemoryUsagePercentage]`, memoryUsageObj);
        const totalMemory = parseInt(memoryUsageObj.mem_total);
        const memUsed = parseInt(memoryUsageObj.mem_used);
        return (100 / totalMemory) * memUsed;
    }

    private async checkStatus(response: Response): Promise<boolean> {
        try {
            if (response.ok) {
                this.debugLog(`[checkStatus] OK: `, response.status);
                return true;
            } else {
                this.errorLog(`[checkStatus] NOT OK: ${response.status} desc: `, response.statusText);
                return false;
            }
        } catch (err) {
            this.errorLog(`[checkStatus] response error: ${response.status}`, err);
            return false;
        }
    }
}
