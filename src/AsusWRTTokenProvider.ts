import {AsusWRTCache} from "./models/AsusWRTCache";
import axios, {AxiosInstance, InternalAxiosRequestConfig} from "axios";

export class AsusWRTTokenProvider {
    private cacheDictionary = new Map<string, AsusWRTCache>();
    constructor(private axiosInstance: AxiosInstance, private username: string, private password: string) {
        this.axiosInstance.interceptors.request.use(async (request) => {
            if (request.url === '/login.cgi') {
                return request;
            }
            const cache = this.cacheDictionary.get(<string> request.baseURL);
            if (cache && this.isLoggedIn(cache)) {
                delete request.headers!['Cookie'];
                request.headers!['Cookie'] = `asus_token=${cache.Token}`
            }
            return request;
        });

        this.axiosInstance.interceptors.response.use(async (response) => {
            if (response.config.url !== '/login.cgi' && response.data && response.data.error_status) {
                const newToken = await this.login(<string>response.config.baseURL);
                this.cacheDictionary.set(<string>response.config.baseURL, <AsusWRTCache>{
                    Token: newToken,
                    TokenDate: Date.now(),
                    RouterIP: response.config.baseURL
                });
                delete response.config.headers!['Cookie'];
                response.config.headers!['Cookie'] = `asus_token=${newToken}`;
                return this.axiosInstance(response.config);
            }
            return response;
        });
    }

    public disposeCache(): void {
        this.cacheDictionary.clear();
    }

    private isLoggedIn(cache: AsusWRTCache): boolean {
        return cache.Token !== '' && cache.TokenDate !== null;
    }

    private async login(baseUrl: string): Promise<string> {
        const path = '/login.cgi';
        const result = await this.axiosInstance({
            baseURL: baseUrl,
            method: 'POST',
            url: path,
            data: new URLSearchParams({
                login_authorization: Buffer.from(`${this.username}:${this.password}`).toString('base64')
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });
        if (!result.data.asus_token) {
            return Promise.reject('No valid token received');
        }
        return result.data.asus_token;
    }
}
