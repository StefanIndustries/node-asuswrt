import axios, {AxiosInstance} from "axios";
import {AsusOptions} from "./asus-options";
import {AsusRouter} from "./classes/asus-router";
import {AsusAccessPoint} from "./classes/asus-access-point";
import {AsusClient} from "./classes/asus-client";
import {getCfgClientList} from "./models/responses/get-cfg-clientlist";
import {AppGetPayloads} from "./models/requests/app-get-payloads";
import * as https from "node:https";

export class AsusWrt {
    private readonly ax: AxiosInstance;
    private abortController = new AbortController();
    public asusRouter: AsusRouter | undefined = undefined;
    public asusAccessPoints: AsusAccessPoint[] = [];
    public allClients: AsusClient[] = [];

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

    public async discoverClients(): Promise<AsusClient[]> {
        const client = new AsusClient(this.ax, this.options.baseURL, '', this.options.username, this.options.password);
        await client.authenticate();
        return await client.appGet<getCfgClientList, AsusClient[]>(AppGetPayloads.CfgClientList, (response) => {
            response.get_cfg_clientlist.forEach((client) => {
                const formattedUrl = this.options.baseURL!.includes('https://') ? `https://${client.ip}` : this.options.baseURL!.includes('http://') ? `http://${client.ip}` : client.ip;
                if (client.config.backhalctrl) {
                    const accessPoint = this.createAccessPoint(formattedUrl, client.mac);
                    this.asusAccessPoints.push(accessPoint);
                    this.allClients.push(accessPoint);
                } else {
                    this.asusRouter = this.createRouter(formattedUrl, client.mac);
                    this.allClients.push(this.asusRouter);
                }
            });
            return this.allClients;
        });
    }

    public dispose(): void {
        this.abortController.abort();
        this.asusRouter = undefined;
        this.asusAccessPoints = [];
        this.allClients = [];
    }

    private createRouter = (url: string, mac: string): AsusRouter => new AsusRouter(this.ax, url, mac, this.options.username, this.options.password);

    private createAccessPoint = (url: string, mac: string): AsusAccessPoint => new AsusAccessPoint(this.ax, url, mac, this.options.username, this.options.password);
}
