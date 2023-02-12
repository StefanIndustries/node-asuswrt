export interface AsusWRTOoklaSpeedtestHistory {
    timestamp: Date // datetime
    ping: {
        jitter: number,
        latency: number
    },
    download: {
        bandwidth: number,
        bytes: number,
        elapsed: number
    },
    upload: {
        bandwidth: number,
        bytes: number,
        elapsed: number
    },
    packetLoss: number,
    isp: string
}
