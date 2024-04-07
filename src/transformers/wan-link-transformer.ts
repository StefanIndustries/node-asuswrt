import {AsusWanLinkStatus} from "../models/asus-wan-link-status";

export function wanLinkTransformer(wanLink: string): AsusWanLinkStatus {
    let status: any = {};
    wanLink.split('\n').forEach(line => {
        if (line.includes('return') && line.includes('wanlink_')) {
            const key = line.substring(line.indexOf('_') + 1, line.indexOf('('));
            let value = line.substring(line.indexOf('return ') + 7, line.indexOf(';}'));
            if (value.includes(`'`)) {
                status[key] = value.substring(1, value.length - 1);
            } else {
                status[key] = parseInt(value);
            }
        }
    });
    return status as AsusWanLinkStatus;
}