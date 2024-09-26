import { AsusResponse } from "./asus-response";

export interface OoklaSpeedtestServers extends AsusResponse {
    ookla_speedtest_get_servers: OoklaSpeedtestServer[];
}

interface OoklaSpeedtestServer {
    id: number;
    host: string;
    port: number;
    name: string;
    location: string;
    country: string;
}