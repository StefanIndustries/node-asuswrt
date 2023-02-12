# node-asuswrt
API wrapper/client for Asus WRT routers/access points

All async methods return promise based types and can be awaited.

## Example
```typescript
import { AsusWRT } from "node-asuswrt";

const asus = new AsusWRT('http://192.168.1.1', 'admin', 'password');

asus.getWANStatus().then(result => {
    console.log(result);
});

asus.getTotalTrafficData().then(result => {
    console.log('traffic', result);
})

asus.getRouters().then(result => {
    result.forEach(router => {
        asus.getCPUMemoryLoad(router.mac).then(result => {
            console.log('load', result);
        });
        asus.getUptime(router.mac).then(result => {
            console.log('uptime', result);
        });
        asus.setLedsEnabled(router.mac, true).then(success => {
            console.log(success);
        });
        asus.getWirelessClients(router.mac, "2G").then(wiredClients => {
            console.log(router.alias, wiredClients);
        });
    })
});
```

## Methods

### Import the wrapper
```typescript
import { AsusWRT } from "node-asuswrt";
```

### Create a new instance of the wrapper
```typescript
const asus = new AsusWRT('http://192.168.1.1', 'admin', 'password')
```

### Enable debug mode for console logs
```typescript
const asus = new AsusWRT('http://192.168.1.1', 'admin', 'password', true)
```

### Get all routers in the network (async)
```typescript
asus.getRouters()
```

### Get wireless clients connected to router (async)
```typescript
asus.getWirelessClients(router.mac, "2G") // 2.4ghz devices
asus.getWirelessClients(router.mac, "5G") // 5ghz devices
```

### Get wired clients connected to router (async)
```typescript
asus.getWiredClients(router.mac)
```

### Set LED value for router (async)
```typescript
asus.setLedsEnabled(router.mac, true) // turns leds on
asus.setLedsEnabled(router.mac, false) // turns leds off
```

### Reboot network (all access points) (async)
```typescript
asus.rebootNetwork()
```

### Get CPU and Memory Load (async)
```typescript
asus.getCPUMemoryLoad(router.mac) // requires mac of router / access point
```

### Get uptime in seconds (async)
```typescript
asus.getUptime(router.mac) // requires mac of router / access point
```

### Get total traffic data (async)
```typescript
asus.getTotalTrafficData()
// poll this function to get realtime data usage for example 2 seconds interval and calculate difference
```

### Get WAN Status (async)
```typescript
asus.getWANStatus()
```

### Get Wake On Lan Devices (async)
```typescript
asus.getWakeOnLanList()
```

### Run Wake On Lan command (async)
```typescript
asus.wakeOnLan(wakeOnLanDeviceMac)
```

## Objects
### AsusWRTConnectedDevice
```typescript
{
    ip: string,
    mac: string,
    name: string,
    nickName: string,
    dpiDevice: string,
    vendor: string,
    ipMethod: string,
    rssi: number
}
```

### AsusWRTLoad
```typescript
{
    CPUUsagePercentage: number,
    MemoryUsagePercentage: number
}
```

### AsusWRTOperationMode
```typescript
{
    Router: 0,
    AccessPoint: 1
}
```

### AsusWRTRouter
```typescript
{
    alias: string,
    modelName: string,
    uiModelName: string,
    productId: string,
    firmwareVersion: string,
    newFirmwareVersion: string,
    ip: string,
    mac: string,
    online: boolean,
    operationMode: AsusWRTOperationMode
}
```

### AsusWRTTrafficData
```typescript
{
    trafficReceived: number;
    trafficSent: number;
}
```

### AsusWRTWANStatus
```typescript
{
    status?: number;
    statusstr?: string;
    type?: string;
    ipaddr?: string;
    netmask?: string;
    gateway?: string;
    dns?: string;
    lease?: number;
    expires?: number;
    xtype?: string;
    xipaddr?: string;
    xnetmask?: string;
    xgateway?: string;
    xdns?: string;
    xlease?: number;
    xexpires?: number;
}
```

### AsusWRTWakeOnLanDevice
```typescript
{
    name: string,
    mac: string
}
```
