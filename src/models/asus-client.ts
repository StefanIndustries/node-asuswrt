import {LoginResult} from "./responses/login-result";
import {AxiosInstance, AxiosResponse} from "axios";
import {URLSearchParams} from "node:url";
import {AsusResponse} from "./responses/asus-response";

export class AsusClient {
    asusToken: string = '';
    ip: string = '';
    mac: string = '';
    axios: AxiosInstance;
    username: string = '';
    password: string = '';

    constructor(ax: AxiosInstance, ip: string, username: string, password: string) {
        this.ip = ip;
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

    async appGet(payload: string): Promise<any> {
        const path = '/appGet.cgi';
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
        try {
            return JSON.parse(result);
        } catch (e) {
            console.error(`failed to parse response: ${e}`);
        }
        return result;
    }

    private async applyAppGET(payload: string): Promise<boolean> {
        const path = '/applyapp.cgi';
        const response = await this.axios.request({
            baseURL: this.ip,
            url: `${path}?${payload}`,
            method: 'GET',
        });
        return response.status >= 200 && response.status < 300;
    }

    private async applyAppPOST(payload: any): Promise<boolean> {
        const logDescription = `[applyAppPOST]`;
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
}