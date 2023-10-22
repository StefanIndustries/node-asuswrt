import { AsusWRTOoklaServer } from "./AsusWRTOoklaServer";

export interface AsusWRTOoklaSpeedtestResult {
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
    server: AsusWRTOoklaServer,
    result: {
        id: string;
        persisted: boolean;
    }
}