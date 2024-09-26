import { AsusResponse } from "./asus-response";

export interface NetdevData extends AsusResponse {
    netdev: {
        BRIDGE_rx: string;
        BRIDGE_tx: string;
        INTERNET_rx: string;
        INTERNET_tx: string;
        WIRED_rx: string;
        WIRED_tx: string;
        WIRELESS0_rx: string;
        WIRELESS0_tx: string;
        WIRELESS1_rx: string;
        WIRELESS1_tx: string;
    }
}