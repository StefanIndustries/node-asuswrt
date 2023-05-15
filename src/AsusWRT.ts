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
        const logDescription = `[constructor]`;
        this.debugLog(`${logDescription}`, options);
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
        const logDescription = `[getToken]`;
        this.debugLog(`${logDescription}`);
        const cache = this.cacheDictionary.get(<string> baseUrl);
        if (cache && this.isLoggedIn(cache)) {
            this.debugLog(`${logDescription} token found in cache and valid`);
            return cache.Token;
        } else {
            this.debugLog(`${logDescription} token expired or not found`);
            try {
                const newToken = await this.login(baseUrl);
                this.debugLog(`${logDescription} token retrieved from login`);
                this.cacheDictionary.set(<string>baseUrl, <AsusWRTCache>{
                    Token: newToken,
                    TokenDate: Date.now(),
                    RouterIP: baseUrl
                });
                this.debugLog(`${logDescription} token set in cache`);
                return newToken;
            } catch (err) {
                this.errorLog(`${logDescription} ${baseUrl}`, err);
                throw new Error(`${logDescription} ${baseUrl}`);
            }
        }
    }

    private isLoggedIn(cache: AsusWRTCache): boolean {
        const logDescription = `[isLoggedIn]`;
        const isLoggedInResult = cache.Token !== '' && cache.TokenDate !== null && cache.TokenDate < Date.now() + (30 * 60 * 1000);
        this.debugLog(`${logDescription} ${cache.RouterIP}`, isLoggedInResult);
        return isLoggedInResult
    }

    private async login(baseUrl: string): Promise<string> {
        const logDescription = `[login]`;
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
            this.debugLog(`${logDescription} login result`, response.status);
            await this.checkStatus(response);
            const jsonResult = <any> await response.json();
            return jsonResult.asus_token;
        } catch (err) {
            this.errorLog(`${logDescription} ${baseUrl}`, err);
            throw new Error(`${logDescription} ${baseUrl}`);
        }
    }

    private async appGet(payload: string, routerIP?: string): Promise<any> {
        const logDescription = `[appGet]`;
        const path = '/appGet.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path} ${payload}`);
        try {
            const response = await fetch(`${url}${path}`, {
                method: 'POST',
                body: new URLSearchParams({
                    hook: payload
                }),
                headers: await this.getDefaultHeadersIncludingToken(url)
            });
            if (await this.checkStatus(response)) {
                this.debugLog(`${logDescription} ${payload}`, response.status);
                const result = await response.text();
                this.debugLog(`${logDescription} ${payload} result (text)`, result);
                try {
                    return JSON.parse(result);
                } catch (err) {
                    this.errorLog(`${logDescription} parsing JSON`, result);
                }
                return result;
            }
        } catch (err) {
            this.errorLog(`${logDescription} ${url} ${path} ${payload}`, err);
            throw new Error(`${logDescription} ${url} ${path} ${payload}`);
        }
    }

    private async applyAppGET(payload: string, routerIP?: string): Promise<boolean> {
        const logDescription = `[applyAppGET]`;
        const path = '/applyapp.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path} ${payload}`);
        try {
            const response = await fetch(`${url}${path}?${payload}`, {
                method: 'GET',
                headers: await this.getDefaultHeadersIncludingToken(url)
            });
            return await this.checkStatus(response);
        } catch (err) {
            this.errorLog(`${logDescription} ${url} ${path} ${payload}`, err);
            throw new Error(`${logDescription} ${url} ${path} ${payload}`);
        }
    }

    private async applyAppPOST(payload: any, routerIP?: string): Promise<boolean> {
        const logDescription = `[applyAppPOST]`;
        const path = '/applyapp.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path} ${payload}`);
        try {
            const response = await fetch(`${url}${path}`, {
                method: 'POST',
                body: new URLSearchParams(payload),
                headers: await this.getDefaultHeadersIncludingToken(url)
            });
            return await this.checkStatus(response);
        } catch (err) {
            this.errorLog(`${logDescription} ${url} ${path} ${payload}`, err);
            throw new Error(`${logDescription} ${url} ${path} ${payload}`);
        }
    }

    public dispose() {
        this.cacheDictionary.clear();
        this.macIpBinding.clear();
    }

    public async getRouters(): Promise<AsusWRTRouter[]> {
        const logDescription = `[getRouters]`;
        this.debugLog(`${logDescription}`);
        try {
            const cfgClientListResponse = await this.appGet('get_cfg_clientlist()');
            if (cfgClientListResponse && (typeof cfgClientListResponse.get_cfg_clientlist === 'undefined' || !Array.isArray(cfgClientListResponse.get_cfg_clientlist))) {
                const singleRouterResponse = await this.appGet(`nvram_get(productid);nvram_get(apps_sq);nvram_get(lan_hwaddr);nvram_get(lan_ipaddr);nvram_get(lan_proto);nvram_get(x_setting);nvram_get(label_mac);nvram_get(odmpid);nvram_get(cfg_master);nvram_get(cfg_group);`);
                const productid = singleRouterResponse.productid ? singleRouterResponse.productid : singleRouterResponse.model_name;
                const modelName = singleRouterResponse.model_name ? singleRouterResponse.model_name : productid;
                const routers = [<AsusWRTRouter>{
                    productId: productid,
                    modelName: modelName,
                    mac: singleRouterResponse.label_mac,
                    ip: singleRouterResponse.lan_ipaddr,
                    online: true,
                    operationMode: AsusWRTOperationMode.Router
                }];
                routers.forEach(router => {
                    this.macIpBinding.set(router.mac, this.options.BaseUrl!.includes('https://') ? `https://${router.ip}` : `http://${router.ip}`);
                });
                return routers;
            }
            return cfgClientListResponse.get_cfg_clientlist.map((client: any) => {
                const productid = client.productid ? client.productid : client.model_name;
                const modelName = client.model_name ? client.model_name : productid;
                const router = <AsusWRTRouter>{
                    alias: client.alias,
                    modelName: modelName,
                    uiModelName: client.ui_model_name,
                    productId: productid,
                    firmwareVersion: client.fwver,
                    newFirmwareVersion: client.newfwver,
                    ip: client.ip,
                    mac: client.mac,
                    online: !!(client.online && client.online === "1"),
                    operationMode: client.config && client.config.backhalctrl ? AsusWRTOperationMode.AccessPoint : AsusWRTOperationMode.Router
                };
                this.macIpBinding.set(router.mac, this.options.BaseUrl!.includes('https://') ? `https://${router.ip}` : `http://${router.ip}`);
                return router;
            });
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async getAllClients(): Promise<AsusWRTConnectedDevice[]> {
        const logDescription = `[getAllClients]`;
        this.debugLog(`${logDescription}`);
        let allClients: AsusWRTConnectedDevice[] = [];
        try {
            let clientsData = await this.appGet('get_clientlist()');
            if (!clientsData.get_clientlist) {
                this.debugLog(`${logDescription} unable to read get_clientlist`);
                return allClients;
            }
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
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async getWiredClients(routerMac: string): Promise<AsusWRTConnectedDevice[]> {
        const logDescription = `[getWiredClients]`;
        this.debugLog(`${logDescription}`, routerMac);
        let wiredClients: AsusWRTConnectedDevice[] = [];
        try {
            const clientsData = await this.appGet('get_clientlist();get_wiredclientlist()');
            if (!clientsData.get_wiredclientlist || !clientsData.get_wiredclientlist[routerMac]) {
                this.debugLog(`${logDescription} unable to read get_wiredclientlist`);
                return wiredClients;
            }
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
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async getWirelessClients(routerMac: string, band: '2G' | '5G'): Promise<AsusWRTConnectedDevice[]> {
        const logDescription = `[getWirelessClients]`;
        this.debugLog(logDescription, [routerMac, band]);
        let wirelessClients: AsusWRTConnectedDevice[] = [];
        try {
            const clientsData = await this.appGet('get_clientlist();get_wclientlist()');
            if (!clientsData.get_wclientlist || !clientsData.get_wclientlist[routerMac] || !clientsData.get_wclientlist[routerMac][band]) {
                this.debugLog(`${logDescription} unable to read get_wclientlist`);
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
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async getWakeOnLanList(): Promise<AsusWRTWakeOnLanDevice[]> {
        const logDescription = `[getWakeOnLanList]`;
        this.debugLog(`${logDescription}`);
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
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async setLedsEnabled(routerMac: string, enabled: boolean): Promise<boolean> {
        const logDescription = `[setLedsEnabled]`;
        this.debugLog(`${logDescription}`, [routerMac, enabled]);
        try {
            return await this.applyAppGET(`config={"led_val":${enabled ? 1 : 0}}&re_mac=${routerMac}&action_mode=config_changed`);
        } catch (err) {
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async wakeOnLan(deviceMac: string): Promise<boolean> {
        const logDescription = `[wakeOnLan]`;
        this.debugLog(`${logDescription}`, deviceMac);
        try {
            return await this.applyAppPOST({
                current_page: "Main_WOL_Content.asp",
                SystemCmd: `ether-wake -i br0 ${deviceMac}`,
                action_mode: " Refresh "
            });
        } catch (err) {
            this.errorLog(`${logDescription} ${deviceMac}`, err);
            throw new Error(`${logDescription} ${deviceMac} ${err}`);
        }
    }

    public async rebootNetwork(): Promise<boolean> {
        const logDescription = `[rebootNetwork]`;
        this.debugLog(`${logDescription}`);
        try {
            const result = await this.applyAppGET(`action_mode=device_reboot`);
            if (result) {
                this.cacheDictionary.clear();
            }
            return result;
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async rebootDevice(routerMac: string): Promise<boolean> {
        const logDescription = `[rebootDevice]`;
        this.debugLog(`${logDescription}`, routerMac);
        try {
            const result = await this.applyAppPOST({"action_mode": "apply", "rc_service": "reboot"}, this.macIpBinding.get(routerMac));
            return result;
        } catch (err) {
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async getCPUMemoryLoad(routerMac: string): Promise<AsusWRTLoad> {
        const logDescription = `[getCPUMemoryLoad]`;
        this.debugLog(`${logDescription}`, routerMac);
        try {
            const cpuMemoryData = await this.appGet(`cpu_usage(appobj);memory_usage(appobj)`, this.macIpBinding.get(routerMac));
            this.debugLog('test', cpuMemoryData);
            return {
                CPUUsagePercentage: this.getCPUUsagePercentage(cpuMemoryData.cpu_usage),
                MemoryUsagePercentage: this.getMemoryUsagePercentage(cpuMemoryData.memory_usage)
            };
        } catch (err) {
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async getTotalTrafficData(): Promise<AsusWRTTrafficData> {
        const logDescription = `[getTotalTrafficData]`;
        this.debugLog(`${logDescription}`);
        try {
            const trafficData = await this.appGet('netdev(appobj)');
            const trafficReceived = (parseInt(trafficData['netdev']['INTERNET_rx'], 16) * 8 / 1024 / 1024) * 0.125;
            const trafficSent = (parseInt(trafficData['netdev']['INTERNET_tx'], 16) * 8 / 1024 / 1024) * 0.125;
            return {
                trafficReceived: trafficReceived,
                trafficSent: trafficSent
            };
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async getWANStatus(): Promise<AsusWRTWANStatus> {
        const logDescription = `[getWANStatus]`;
        this.debugLog(`${logDescription}`);
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
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async getUptime(routerMac: string): Promise<number> {
        const logDescription = `[getUptime]`;
        this.debugLog(`${logDescription}`, routerMac);
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
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async getOoklaServers(): Promise<AsusWRTOoklaServer[]> {
        const logDescription = `[getOoklaServers]`;
        this.debugLog(`${logDescription}`);
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
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async getOoklaSpeedtestHistory(): Promise<AsusWRTOoklaSpeedtestHistory[]> {
        const logDescription = `[getOoklaSpeedtestHistory]`;
        this.debugLog(`${logDescription}`);
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
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async startOoklaSpeedtest(ooklaServer: AsusWRTOoklaServer): Promise<boolean> {
        const logDescription = `[startOoklaSpeedtest]`;
        const path = '/ookla_speedtest_exe.cgi';
        this.debugLog(`${logDescription}`, ooklaServer);
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
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    private async getDefaultHeadersIncludingToken(baseUrl: string): Promise<any> {
        const logDescription = `[getDefaultHeadersIncludingToken]`;
        this.debugLog(`${logDescription}`, baseUrl);
        return  {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `asus_token=${await this.getToken(baseUrl)}`,
            'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163'
        }
    }

    private getCPUUsagePercentage(cpuUsageObj: any): number {
        const logDescription = `[getCPUUsagePercentage]`;
        this.debugLog(`${logDescription}`, cpuUsageObj);
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
        const logDescription = `[addNumberValueIfExists]`;
        this.debugLog(`${logDescription}`);
        if (object && property && object[property]) {
            return parseInt(object[property]);
        }
        return 0;
    }

    private getMemoryUsagePercentage(memoryUsageObj: any): number {
        const logDescription = `[getMemoryUsagePercentage]`;
        this.debugLog(`${logDescription}`, memoryUsageObj);
        const totalMemory = parseInt(memoryUsageObj.mem_total);
        const memUsed = parseInt(memoryUsageObj.mem_used);
        return (100 / totalMemory) * memUsed;
    }

    private async checkStatus(response: Response): Promise<boolean> {
        const logDescription = `[checkStatus]`;
        if (response.ok) {
            this.debugLog(`${logDescription} OK: `, response.status);
            const clonedResponse = await response.clone().text();
            if (clonedResponse.includes('error_status')) {
                const clonedResponseJson = JSON.parse(clonedResponse);
                if (clonedResponseJson.error_status) {
                    this.errorLog(`${logDescription} NOT OK: ${response.status} desc: `, clonedResponseJson.error_status);
                    this.dispose();
                    throw new Error(`${logDescription} NOT OK: ${response.status} error status: ${clonedResponseJson.error_status}`)
                }
            }
            return true;
        } else {
            this.errorLog(`${logDescription} NOT OK: ${response.status} desc: `, response.statusText);
            throw new Error(`${logDescription} NOT OK: ${response.status} desc: ${response.statusText}`)
        }
    }
}
