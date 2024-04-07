import {AsusOoklaServer} from "./asus-ookla-server";

export interface AsusOoklaSpeedtestResult {
    type: string;
    timestamp: string;
    ping: PingData;
    download: NetworkSpeedData;
    upload: NetworkSpeedData;
    packetLoss: number;
    isp: string;
    interface: NetworkInterface;
    server: ServerData;
    result: TestResult;
}

interface PingData {
    jitter: number;
    latency: number;
    low: number;
    high: number;
}

interface NetworkSpeedData {
    bandwidth: number;
    bytes: number;
    elapsed: number;
}

interface NetworkInterface {
    internalIp: string;
    name: string;
    macAddr: string;
    isVpn: boolean;
    externalIp: string;
}

interface ServerData {
    id: number;
    host: string;
    port: number;
    name: string;
    location: string;
    country: string;
    ip: string;
}

interface TestResult {
    id: string;
    persisted: boolean;
}