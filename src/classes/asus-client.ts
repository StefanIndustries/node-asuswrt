import {LoginResult} from "../models/responses/login-result";
import {AxiosInstance, AxiosResponse} from "axios";
import {URLSearchParams} from "node:url";
import {SystemUsage} from "../models/responses/system-usage";
import {AppGetPayloads} from "../models/requests/app-get-payloads";
import {ApplyAppPayloads} from "../models/requests/apply-app-payloads";
import {ApplyAppPostPayloads} from "../models/requests/apply-app-post-payloads";
import {systemUsageTransformer} from "../transformers/system-usage-transformer";
import {AsusCpuMemLoad} from "../models/asus-cpu-mem-load";
import {AppGetTransformer} from "../transformers/app-get-transformer";
import {Uptime} from "../models/responses/uptime";
import {uptimeTransformer} from "../transformers/uptime-transformer";

export class AsusClient {
    asusToken: string = '';
    ip: string = '';
    mac: string = '';
    axios: AxiosInstance;
    username: string = '';
    password: string = '';

    constructor(ax: AxiosInstance, ip: string, mac: string, username: string, password: string) {
        this.ip = ip;
        this.mac = mac;
        this.axios = ax;
        this.username = username;
        this.password = password;
    }

    async authenticate(): Promise<LoginResult> {
        const path = '/login.cgi';
        const formattedUsernamePassword = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        const loginResult = <AxiosResponse<LoginResult>> await this.axios.request({
            method: 'POST',
            baseURL: this.ip,
            url: path,
            data: new URLSearchParams({
                login_authorization: formattedUsernamePassword
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        if (loginResult.data.error_status) {
            throw new Error(loginResult.data.error_status);
        }
        this.asusToken = loginResult.data.asus_token;
        return loginResult.data;
    }

    async appGet<T, TT>(payload: AppGetPayloads, appGetTransformer: AppGetTransformer<T, TT>): Promise<TT> {
        const path = '/appGet.cgi';
        try {
            const response = await this.axios.request({
                baseURL: this.ip,
                url: path,
                method: 'POST',
                data: new URLSearchParams({
                    hook: payload
                }),
                headers: {
                    'Cookie': `asus_token=${this.asusToken}`
                }
            });
            const result = response.data;
            return appGetTransformer(<T> result);
        } catch (err) {
            throw new Error(`failed to get ${payload}: ${err}`);
        }
    }

    async applyAppGET(payload: ApplyAppPayloads): Promise<boolean> {
        const path = '/applyapp.cgi';
        const response = await this.axios.request({
            baseURL: this.ip,
            url: `${path}?${payload}`,
            method: 'GET',
        });
        return response.status >= 200 && response.status < 300;
    }

    async applyAppPOST(payload: ApplyAppPostPayloads): Promise<boolean> {
        const path = '/applyapp.cgi';
        const response = await this.axios.request({
            baseURL: this.ip,
            url: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: payload
        });
        return response.status >= 200 && response.status < 300;
    }

    async getCPUMemoryLoad(): Promise<AsusCpuMemLoad> {
        return await this.appGet<SystemUsage, AsusCpuMemLoad>(AppGetPayloads.SystemUsage, systemUsageTransformer);
    }

    async getUptimeSeconds(): Promise<number> {
        return await this.appGet<Uptime, number>(AppGetPayloads.Uptime, uptimeTransformer);
    }
}