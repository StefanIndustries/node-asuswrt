import { AsusWRTRouter } from "./models/AsusWRTRouter";
import { AsusWRTOperationMode } from "./models/AsusWRTOperationMode";
import { AsusWRTConnectedDevice } from "./models/AsusWRTConnectedDevice";
import { AsusWRTLoad } from "./models/AsusWRTLoad";
import { AsusWRTWANStatus } from "./models/AsusWRTWANStatus";
import { AsusWRTTrafficData } from "./models/AsusWRTTrafficData";
import { AsusWRTWakeOnLanDevice } from "./models/AsusWRTWakeOnLanDevice";
import { AsusWRTOoklaServer } from "./models/AsusWRTOoklaServer";
import { AsusWRTOptions } from "./models/AsusWRTOptions";
import { AsusWRTCache } from "./models/AsusWRTCache";
import axios, { AxiosInstance } from "axios";
import { AsusWRTOoklaSpeedtestResult } from "./models/AsusWRTOoklaSpeedtestResult";
import { AsusWRTVPNClient } from "./models/AsusWRTVPNClient";
import https from "node:https";

export class AsusWRT {
    private ax: AxiosInstance;
    private abortController = new AbortController();
    private macIpBinding = new Map<string, string>();
    private cacheDictionary = new Map<string, AsusWRTCache>();

    constructor(private options: AsusWRTOptions) {
        const logDescription = `[constructor]`;
        this.ax = axios.create({
            baseURL: options.BaseUrl,
            timeout: 30000,
            signal: this.abortController.signal,
            headers: { 'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163' },
            httpsAgent: new https.Agent({rejectUnauthorized: !options.IsSelfSignedCertificate}),
        });

        // interceptor to add token to request
        this.ax.interceptors.request.use(async (request) => {
            if (request.url && request.url.includes('login.cgi')) {
                return request;
            }
            const cache = this.cacheDictionary.get(<string> request.baseURL);
            if (cache && this.isLoggedIn(cache)) {
                delete request.headers!['Cookie'];
                request.headers!['Cookie'] = `asus_token=${cache.Token}`
            }
            return request;
        });

        // interceptor to reaquire token on error_status response
        this.ax.interceptors.response.use(async (response) => {
            if (response.config.url !== '/login.cgi' && response.data && response.data.error_status) {
                const newToken = await this.login(<string>response.config.baseURL);
                this.cacheDictionary.set(<string>response.config.baseURL, <AsusWRTCache>{
                    Token: newToken,
                    TokenDate: Date.now(),
                    RouterIP: response.config.baseURL
                });
                delete response.config.headers!['Cookie'];
                response.config.headers!['Cookie'] = `asus_token=${newToken}`;
                return this.ax.request(response.config);
            }
            return response;
        });

        this.ax.interceptors.request.use(request => {
            this.debugLog(`${request.url} request`, request);
            return request;
        });

        this.ax.interceptors.response.use(response => {
            this.debugLog(`${response.request.url} response`, response);
            return response;
        })

        this.ax.interceptors.response.use(response => response, error => {
            this.errorLog(`error`, error);
        });

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
        const isLoggedInResult = cache.Token !== '' && cache.TokenDate !== null;
        this.debugLog(`${logDescription} ${cache.RouterIP}`, isLoggedInResult);
        return isLoggedInResult
    }

    private async login(baseUrl: string): Promise<string> {
        const logDescription = `[login]`;
        const path = '/login.cgi';
        const formattedUsernamePassword = Buffer.from(`${this.options.Username}:${this.options.Password}`).toString('base64');
        this.debugLog(`[login] ${baseUrl}`);
        const response = await this.ax.request({
            baseURL: baseUrl,
            method: 'POST',
            url: path,
            data: new URLSearchParams({
                login_authorization: formattedUsernamePassword
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        this.debugLog(`${logDescription} login result`, response.status);
        if (!response.data.asus_token) {
            throw new Error('No valid token received');
        }
        return response.data.asus_token;
    }

    private async appGet(payload: string, routerIP?: string): Promise<any> {
        const logDescription = `[appGet]`;
        const path = '/appGet.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path} ${payload}`);
        const response = await this.ax.request({
            baseURL: url,
            url: path,
            method: 'POST',
            data: new URLSearchParams({
                hook: payload
            })
        });
        const result = response.data;
        try {
            return JSON.parse(result);
        } catch (err) {
            this.errorLog(`${logDescription} parsing JSON`, result);
        }
        return result;
    }

    private async applyAppGET(payload: string, routerIP?: string): Promise<boolean> {
        const logDescription = `[applyAppGET]`;
        const path = '/applyapp.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path} ${payload}`);
        const response = await this.ax.request({
            baseURL: url,
            url: `${path}?${payload}`,
            method: 'GET',
        });
        return response.status >= 200 && response.status < 300;
    }

    private async applyAppPOST(payload: any, routerIP?: string): Promise<boolean> {
        const logDescription = `[applyAppPOST]`;
        const path = '/applyapp.cgi';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path} ${payload}`);
        const response = await this.ax.request({
            baseURL: url,
            url: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: payload
        });
        return response.status >= 200 && response.status < 300;
    }

    public dispose() {
        this.abortController.abort();
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
            const match = JSON.stringify(uptimeData).match(/(\d+) secs since boot/);
            if (match) {
                const seconds: string = match[1];
                return parseInt(seconds);
            } else {
                return 0;
            }
        } catch (err) {
            this.errorLog(`${logDescription} ${routerMac}`, err);
            throw new Error(`${logDescription} ${routerMac} ${err}`);
        }
    }

    public async getVPNClients(): Promise<any> {
        const logDescription = `[getVPNClients]`;
        this.debugLog(`${logDescription}`);
        try {
            const result = await this.appGet('nvram_get(vpnc_clientlist);nvram_get(vpnc_pptp_options_x_list);nvram_get(vpnc_proto);nvram_get(vpnc_heartbeat_x);nvram_get(vpnc_pppoe_username);nvram_get(vpn_clientx_eas);nvram_get(vpn_client1_state);nvram_get(vpn_client2_state);nvram_get(vpn_client3_state);nvram_get(vpn_client4_state);nvram_get(vpn_client5_state);nvram_get(vpn_client1_errno);nvram_get(vpn_client2_errno);nvram_get(vpn_client3_errno);nvram_get(vpn_client4_errno);nvram_get(vpn_client5_errno);nvram_get(vpnc_state_t);nvram_get(vpnc_sbstate_t);');
            const vpnListUnMapped = result.vpnc_clientlist.split('&#60').map((item: string) => { return item.split('&#62') });
            const vpnList = vpnListUnMapped.map((item: string[]) => {
                return <AsusWRTVPNClient> {
                    description: item[0],
                    protocol: item[1],
                    unit: item[2],
                    username: item[3],
                    password: item[4]
                }
            });
            if (vpnList[0].description === '' && vpnList[0].protocol === undefined) {
                return [];
            }
            return vpnList;
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async setActiveVPNClient(client: AsusWRTVPNClient): Promise<any> {
        const logDescription = `[setActiveVPNClient]`;
        this.debugLog(`${logDescription}`);
        let data: any = {
            "vpnc_proto": `${client.protocol.toLowerCase()}`,
            "vpnc_pptp_options_x": "auto",
            "vpn_clientx_eas": `${client.unit},`,
            "vpn_client_unit": `${client.unit}`,
            [`vpn_client${client.unit}_username`]: `${client.username}`,
            [`vpn_client${client.unit}_password`]: `${client.password}`,
            "action_mode": "apply"
        };
        try {
            const result = await this.applyAppPOST(JSON.stringify(data));
            if (result) {
                return await this.applyAppPOST({"action_mode": "apply", "rc_service": "restart_vpncall;"});
            }
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async disableVPNClient(): Promise<any> {
        const logDescription = `[disableVPNClient]`;
        this.debugLog(`${logDescription}`);
        let data: any = {
            "vpnc_proto": "disable",
            "vpnc_pptp_options_x": "",
            "vpn_clientx_eas": "",
            "vpn_client_unit": "",
            "vpnc_pppoe_username": "",
            "vpnc_pppoe_passwd": "",
            "vpnc_heartbeat_x": "",
            "action_mode": "apply"
        };
        try {
            const result = await this.applyAppPOST(JSON.stringify(data));
            if (result) {
                return await this.applyAppPOST({"action_mode": "apply", "rc_service": "restart_vpncall;"});
            }
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    public async getOoklaServers(): Promise<AsusWRTOoklaServer[]> {
        const logDescription = `[getOoklaServers]`;
        this.debugLog(`${logDescription}`);
        const ooklaServers: AsusWRTOoklaServer[] = [];
        try {
            let ooklaServerData = await this.appGet('ookla_speedtest_get_servers()');
            if (ooklaServerData.ookla_speedtest_get_servers.length === 0) { // sometimes first result is empty...
                ooklaServerData = await this.appGet('ookla_speedtest_get_servers()');
            }
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

    public async getOoklaSpeedtestHistory(): Promise<AsusWRTOoklaSpeedtestResult[]> {
        const logDescription = `[getOoklaSpeedtestHistory]`;
        this.debugLog(`${logDescription}`);
        try {
            const ooklaHistoryData = await this.appGet('ookla_speedtest_get_history()');
            return ooklaHistoryData.ookla_speedtest_get_history.filter((element: any) => element && element.type && element.type === 'result');
        } catch (err) {
            this.errorLog(`${logDescription}`, err);
            throw new Error(`${logDescription} ${err}`);
        }
    }

    private async setOoklaSpeedtestStartTime(): Promise<boolean> {
        const logDescription = `[setOoklaSpeedtestStartTime]`;
        const path = '/set_ookla_speedtest_start_time.cgi';
        this.debugLog(`${logDescription}`);
        const response = await this.ax.request({
            baseURL: this.options.BaseUrl,
            url: path,
            method: 'POST',
            data: new URLSearchParams({
                ookla_start_time: Date.now().toString()
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    private async startOoklaSpeedtest(ooklaServer: AsusWRTOoklaServer): Promise<boolean> {
        const logDescription = `[startOoklaSpeedtest]`;
        const path = '/ookla_speedtest_exe.cgi';
        this.debugLog(`${logDescription}`, ooklaServer);
        const setStartTimeResponse = await this.setOoklaSpeedtestStartTime();
        if (!setStartTimeResponse) {
            return false;
        }
        const response = await this.ax.request({
            baseURL: this.options.BaseUrl,
            url: path,
            method: 'POST',
            data: new URLSearchParams({
                type: '',
                id: `${ooklaServer.id}`
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    private async getOoklaSpeedtestResult(): Promise<AsusWRTOoklaSpeedtestResult> {
        const logDescription = `[getOoklaSpeedtestResult]`;
        let nRetrieveResultAttempts = 0;
        while(nRetrieveResultAttempts < 30) {
            const data = await this.appGet('ookla_speedtest_get_result()');
            const result: AsusWRTOoklaSpeedtestResult = data.ookla_speedtest_get_result.find((element: any) => element.type === 'result');
            if (result) {
                return result;
            }
            nRetrieveResultAttempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error(`${logDescription} unable to retrieve speedtest result`);
    }

    private async writeOoklaSpeedtestResult(result: AsusWRTOoklaSpeedtestResult): Promise<boolean> {
        const logDescription = `[writeOoklaSpeedtestResult]`;
        this.debugLog(`${logDescription}`, result);
        const path = '/ookla_speedtest_write_history.cgi';
        const previousHistory = await this.getOoklaSpeedtestHistory();
        const uglyJsonString = JSON.stringify(result) + `\n` + previousHistory.map((element: any) => JSON.stringify(element)).join(`\n`);
        const response = await this.ax.request({
            url: path,
            method: 'POST',
            data: new URLSearchParams({
                speedTest_history: uglyJsonString
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    public async runOoklaSpeedtest(ooklaServer: AsusWRTOoklaServer): Promise<AsusWRTOoklaSpeedtestResult> {
        const logDescription = `[runOoklaSpeedtestResult]`;
        this.debugLog(`${logDescription}`, ooklaServer);
        await this.setOoklaSpeedtestStartTime();
        await this.startOoklaSpeedtest(ooklaServer);
        const result = await this.getOoklaSpeedtestResult();
        await this.writeOoklaSpeedtestResult(result);
        return result;
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

    private async exportCertificate(routerIP?: string):  Promise<any> {
        const logDescription = `[exportCertificate]`;
        const path = '/cert_key.tar';
        const url = routerIP ? routerIP : this.options.BaseUrl;
        this.debugLog(`${logDescription} ${url} ${path}`);
        const response = await this.ax.request({
            baseURL: url,
            url: path,
            method: 'GET',
            responseType: "stream"
        });
        return response.data;
    }
}
