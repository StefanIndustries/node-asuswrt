import {NetdevData} from "../models/responses/netdev-data";
import {AsusTrafficData} from "../models/asus-traffic-data";

export function trafficDataTransformer(netdevData: NetdevData): AsusTrafficData {
    const trafficReceived = (parseInt(netdevData.netdev.INTERNET_rx, 16) * 8 / 1024 / 1024) * 0.125;
    const trafficSent = (parseInt(netdevData.netdev.INTERNET_tx, 16) * 8 / 1024 / 1024) * 0.125;
    return {
        trafficReceived: trafficReceived,
        trafficSent: trafficSent
    };
}