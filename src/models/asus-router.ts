import {AxiosInstance} from "axios";
import {AsusClient} from "./asus-client";

export class AsusRouter extends AsusClient {
    constructor(ax: AxiosInstance, ip: string, username: string, password: string) {
        super(ax, ip, username, password);
        super.authenticate().then(r => {
            console.log('router authenticated');
        }).catch((e) => {
            throw new Error(e);
        });
    }
}