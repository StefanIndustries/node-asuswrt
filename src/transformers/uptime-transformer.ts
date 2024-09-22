import { Uptime } from "../models/responses/uptime";

export function uptimeTransformer(uptime: Uptime): number {
    const match = JSON.stringify(uptime).match(/(\d+) secs since boot/);
    if (match) {
        const seconds: string = match[1];
        return parseInt(seconds);
    } else {
        return 0;
    }
}