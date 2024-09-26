import { AxiosInstance } from "axios";
import { AsusClient } from "./asus-client";
import { Device } from "../models/responses/get-cfg-clientlist";

export class AsusAccessPoint extends AsusClient {
    constructor(ax: AxiosInstance, ip: string, mac: string, username: string, password: string, deviceInfo: Device) {
        super(ax, ip, mac, username, password, deviceInfo);
        super.authenticate().then(() => {
        }).catch((e) => {
            throw new Error(e);
        });
    }
}