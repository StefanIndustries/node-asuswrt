import {AxiosInstance} from "axios";
import {AsusClient} from "./asus-client";

export class AsusAccessPoint extends AsusClient {
    constructor(ax: AxiosInstance, ip: string, mac: string, username: string, password: string) {
        super(ax, ip, mac, username, password);
        super.authenticate().then(() => {
            console.log('access point authenticated');
        });
    }
}