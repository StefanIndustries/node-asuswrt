export interface AsusConnectedDevice {
    ip: string,
    mac: string,
    name: string,
    nickName: string,
    dpiDevice: string,
    vendor: string,
    ipMethod: string,
    rssi: number,
    online: boolean,
    connectionMethod: ConnectionMethod
}

export type ConnectionMethod = 'wired' | '2g' | '5g' | '6g' | '7g';