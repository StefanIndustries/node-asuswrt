import { AsusOoklaServer } from "./asus-ookla-server";

export interface AsusOoklaSpeedtestResult {
    type: string;
    timestamp: string;
    ping: {
        jitter: number;
        latency: number;
        low: number;
        high: number;
    },
    download: {
        bandwidth: number;
        bytes: number;
        elapsed: number;
    },
    upload: {
        bandwidth: number;
        bytes: number;
        elapsed: number;
    },
    packetLoss: number;
    isp: string;
    interface: {
        internalIp: string;
        name: string;
        macAddr: string;
        isVpn: boolean;
        externalIp: string;
    },
    server: AsusOoklaServer,
    result: {
        id: string;
        persisted: boolean;
    }
}