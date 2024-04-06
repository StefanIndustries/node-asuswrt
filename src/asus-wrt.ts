import axios, {AxiosInstance, AxiosResponse} from "axios";
import {AsusOptions} from "./asus-options";
import {AsusResponse} from "./models/responses/asus-response";
import {AsusRouter} from "./models/asus-router";
import { AsusAccessPoint } from "./models/asus-access-point";
import {AsusClient} from "./models/asus-client";

export class AsusWrt {
    private readonly ax: AxiosInstance;
    private abortController = new AbortController();
    private asusRouter: AsusRouter;
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

        this.discoverClients().then(() => {
            console.log('clients discovered');
        });
    }

    private async discoverClients() {
        const client = new AsusClient(this.ax, this.options.baseURL, this.options.username, this.options.password);
        await client.authenticate();
        const response = await client.appGet('get_cfg_clientlist()');
        const clientList = response.get_cfg_clientlist;
        console.log(clientList);
    }

    private createRouter(): AsusRouter {
        return new AsusRouter(this.ax, this.options.baseURL, this.options.username, this.options.password);
    }

    private createAccessPoint(ip: string): AsusAccessPoint {
        const accessPoint = new AsusAccessPoint(this.ax, ip, this.options.username, this.options.password);
        this.asusAccessPoints.push(accessPoint);
        return accessPoint;
    }
}
