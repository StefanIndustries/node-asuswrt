import {AxiosInstance} from "axios";
import {AsusClient} from "./asus-client";

export class AsusRouter extends AsusClient {
    constructor(ax: AxiosInstance, ip: string, mac: string, username: string, password: string) {
        super(ax, ip, mac, username, password);
        super.authenticate().then(() => {
            console.log('router authenticated');
        }).catch((e) => {
            throw new Error(e);
        });
    }
}