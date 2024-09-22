interface ClientEntry {
    type: string;
    defaultType: string;
    name: string;
    nickName: string;
    ip: string;
    mac: string;
    from: string;
    macRepeat: string;
    isGateway: string;
    isWebServer: string;
    isPrinter: string;
    isITunes: string;
    dpiType: string;
    dpiDevice: string;
    vendor: string;
    isWL: string;
    isGN: string;
    isOnline: string;
    ssid: string;
    isLogin: string;
    opMode: string;
    rssi: string;
    curTx: string;
    curRx: string;
    totalTx: string;
    totalRx: string;
    wlConnectTime: string;
    ipMethod: string;
    ROG: string;
    group: string;
    callback: string;
    keeparp: string;
    qosLevel: string;
    wtfast: string;
    internetMode: string;
    internetState: string;
    amesh_isReClient: string;
    amesh_papMac: string;
    amesh_bind_mac: string;
    amesh_bind_band: string;
}

interface GetClientList {
    [macAddress: string]: ClientEntry;
}

interface GetWiredClientList {
    [macAddress: string]: string[];
}

interface GetWClientList {
    [macAddress: string]: {
        '2G': string[];
        '5G'?: string[];
    };
}

interface ClientList {
    get_clientlist: GetClientList;
    get_wiredclientlist: GetWiredClientList;
    get_wclientlist: GetWClientList;
}