import {OoklaSpeedtestServers} from "../models/responses/ookla-speedtest-server";
import {AsusOoklaServer} from "../models/asus-ookla-server";

export function OoklaSpeedtestServersTransformer(speedtestServers: OoklaSpeedtestServers): AsusOoklaServer[] {
    const ooklaServers: AsusOoklaServer[] = [];
    speedtestServers.ookla_speedtest_get_servers.forEach((server: { id: number; host: string; port: number; name: string; location: string; country: string; }) => {
        if (server.id) {
            ooklaServers.push({
                id: server.id,
                host: server.host,
                port: server.port,
                name: server.name,
                location: server.location,
                country: server.country
            });
        }
    })
    return ooklaServers;
}