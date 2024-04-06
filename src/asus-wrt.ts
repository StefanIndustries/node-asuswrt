import axios, {AxiosInstance} from "axios";
import {AsusOptions} from "./asus-options";
import {AsusRouter} from "./models/asus-router";
import { AsusAccessPoint } from "./models/asus-access-point";
import {AsusClient} from "./models/asus-client";
import {getCfgClientList} from "./models/responses/get-cfg-clientlist";

export class AsusWrt {
    private readonly ax: AxiosInstance;
    private abortController = new AbortController();
    private asusRouter: AsusRouter | undefined = undefined;
    private asusAccessPoints: AsusAccessPoint[] = [];
    private allClients: AsusClient[] = [];

    constructor(private options: AsusOptions) {
        this.ax = axios.create({
            baseURL: options.baseURL,
            signal: this.abortController.signal,
            headers: {
                'User-Agent': 'asusrouter-Android-DUTUtil-1.0.0.3.58-163'
            }
        });
    }

    public async discoverClients(): Promise<AsusClient[]> {
        const client = new AsusClient(this.ax, this.options.baseURL, '', this.options.username, this.options.password);
        await client.authenticate();
        const response = await client.appGet<getCfgClientList>('get_cfg_clientlist()');
        response.get_cfg_clientlist.forEach((client) => {
            const formattedIp = this.options.baseURL!.includes('https://') ? `https://${client.ip}` : `http://${client.ip}`;
            if (client.config.backhalctrl) {
                const accessPoint = this.createAccessPoint(formattedIp, client.mac);
                this.asusAccessPoints.push(accessPoint);
                this.allClients.push(accessPoint);
            } else {
                this.asusRouter = this.createRouter(formattedIp, client.mac);
                this.allClients.push(this.asusRouter);
            }
        });
        return this.allClients;
    }

    public dispose(): void {
        this.abortController.abort();
        this.asusRouter = undefined;
        this.asusAccessPoints = [];
        this.allClients = [];
    }

    private createRouter = (ip: string, mac: string): AsusRouter => new AsusRouter(this.ax, ip, mac, this.options.username, this.options.password);

    private createAccessPoint = (ip: string, mac: string): AsusAccessPoint => new AsusAccessPoint(this.ax, ip, mac, this.options.username, this.options.password);
}
