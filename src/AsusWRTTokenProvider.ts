import {AsusWRTCache} from "./models/AsusWRTCache";
import {AxiosInstance} from "axios";

export class AsusWRTTokenProvider {
    private cacheDictionary = new Map<string, AsusWRTCache>();
    constructor(private axiosInstance: AxiosInstance, private username: string, private password: string) {
        this.axiosInstance.interceptors.request.use(async (request) => {
            if (request.url === '/login.cgi') {
                return request;
            }
            const cache = this.cacheDictionary.get(<string> request.baseURL);
            if (cache && (!this.isLoggedIn(cache) || this.isSessionOlderThan10Minutes(cache))) {
                delete request.headers!['Cookie'];
                request.headers!['Cookie'] = `asus_token=${cache.Token}`
            } else {
                const newToken = await this.login(<string> request.baseURL)
                this.cacheDictionary.set(<string> request.baseURL, <AsusWRTCache> {
                    Token: newToken,
                    TokenDate: Date.now(),
                    RouterIP: request.baseURL
                });
                delete request.headers!['Cookie'];
                request.headers!['Cookie'] = `asus_token=${newToken}`
            }
            return request;
        });
    }

    public disposeCache(): void {
        this.cacheDictionary.clear();
    }

    private isLoggedIn(cache: AsusWRTCache): boolean {
        return cache.TokenDate !== null;
    }

    private isSessionOlderThan10Minutes(cache: AsusWRTCache): boolean {
        if (!cache.TokenDate) {
            return true;
        }
        return (Date.now() - cache.TokenDate) > 10 * 60 * 1000;
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
