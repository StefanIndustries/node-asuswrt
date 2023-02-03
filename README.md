# node-asuswrt
API wrapper for Asus WRT routers/access points

Create a new instance of the wrapper
```typescript
const asus = new AsusWRT.AsusWRT('http://192.168.1.1', 'admin', 'password')
```

Enable debug mode for console logs
```typescript
const asus = new AsusWRT.AsusWRT('http://192.168.1.1', 'admin', 'password', true)
```

Login (async)
```typescript
asus.login() // returns boolean indicating success
// only required to run once during intial connection or after a reboot of the network
// axios will get a new token automatically after 10 minutes
```

Get all routers in the network (async)
```typescript
asus.getRouters()
```

Get wireless clients connected to router (async)
```typescript
asus.getWirelessClients(router.mac, "2G") // 2.4ghz devices
asus.getWirelessClients(router.mac, "5G") // 5ghz devices
```

Get wired clients connected to router (async)
```typescript
asus.getWiredClients(router.mac)
```

Set LED value for router (async)
```typescript
asus.setLedsEnabled(router.mac, true) // turns leds on
asus.setLedsEnabled(router.mac, false) // turns leds off
```

Reboot network (all access points) (async)
```typescript
asus.rebootNetwork()
// it is required to get a new token with the login method afterwards once the network is back online
```

# Example
```javascript
const asus = new AsusWRT.AsusWRT('http://192.168.1.1', 'admin', 'password');

asus.login().then(result => {
    asus.getRouters().then(result => {
        result.forEach(router => {
            asus.getWirelessClients(router.mac, "2G").then(wiredClients => {
                console.log(router.alias, wiredClients);
            });
        })
    })
});
```
