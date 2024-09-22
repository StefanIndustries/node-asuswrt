import { LoginResult } from "../models/responses/login-result";
import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { URLSearchParams } from "node:url";
import { SystemUsage } from "../models/responses/system-usage";
import { AppGetPayloads } from "../models/requests/app-get-payloads";
import { systemUsageTransformer } from "../transformers/system-usage-transformer";
import { AsusCpuMemLoad } from "../models/asus-cpu-mem-load";
import { AppGetTransformer } from "../transformers/app-get-transformer";
import { Uptime } from "../models/responses/uptime";
import { uptimeTransformer } from "../transformers/uptime-transformer";
import { RebootNodePayload, SetLedsPayload } from "../models/requests/apply-app-payloads";
import { AsusConnectedDevice } from "../models/asus-connected-device";

export class AsusClient {
    asusToken: string = '';
    url: string = '';
    mac: string = '';
    axios: AxiosInstance;
    username: string = '';
    password: string = '';
    connectedDevices: AsusConnectedDevice[] = [];

    constructor(ax: AxiosInstance, url: string, mac: string, username: string, password: string) {
        this.url = url;
        this.mac = mac;
        this.axios = ax;
        this.username = username;
        this.password = password;
    }

    async authenticate(): Promise<LoginResult> {
        const path = '/login.cgi';
        const formattedUsernamePassword = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        const loginResult = <AxiosResponse<LoginResult>>await this.axios.request({
            method: 'POST',
            baseURL: this.url,
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

    async appGet<T, TT>(payload: AppGetPayloads, appGetTransformer?: AppGetTransformer<T, TT>): Promise<TT> {
        const path = '/appGet.cgi';
        try {
            const response = await this.axios.request({
                baseURL: this.url,
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
            if (appGetTransformer) {
                return appGetTransformer(<T>result);
            } else {
                return result;
            }
        } catch (err) {
            throw new Error(`failed to get ${payload}: ${err}`);
        }
    }

    async applyAppPOST(payload: URLSearchParams): Promise<boolean> {
        const path = '/applyapp.cgi';
        const response = await this.axios.request({
            url: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: payload.toString()
        });
        return response.status >= 200 && response.status < 300;
    }

    async customAxRequest(request: AxiosRequestConfig): Promise<AxiosResponse> {
        return await this.axios.request(request);
    }

    /**
     * Retrieves the current CPU and memory load statistics.
     *
     * @return {Promise<AsusCpuMemLoad>} A promise that resolves to an object containing CPU and memory load metrics.
     */
    async getCPUMemoryLoad(): Promise<AsusCpuMemLoad> {
        return await this.appGet<SystemUsage, AsusCpuMemLoad>(AppGetPayloads.SystemUsage, systemUsageTransformer);
    }

    /**
     * Retrieves the uptime of the app in seconds.
     *
     * @return {Promise<number>} A promise that resolves with the uptime in seconds.
     */
    async getUptimeSeconds(): Promise<number> {
        return await this.appGet<Uptime, number>(AppGetPayloads.Uptime, uptimeTransformer);
    }

    /**
     * Asynchronously sets the LED status for the device.
     *
     * @param {boolean} enabled - A boolean flag indicating whether the LEDs should be enabled (true) or disabled (false).
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating the success status of the operation.
     */
    async setLeds(enabled: boolean): Promise<boolean> {
        return await this.applyAppPOST(SetLedsPayload(enabled, this.mac));
    }

    /**
     * Reboots the node associated with the current instance.
     *
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating the success of the reboot operation.
     */
    async reboot(): Promise<boolean> {
        return await this.applyAppPOST(RebootNodePayload(this.mac));
    }
}