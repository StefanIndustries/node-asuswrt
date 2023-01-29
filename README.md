# node-asuswrt
API wrapper for Asus WRT routers/access points

Create a new instance of the wrapper:
```typescript
const asus = new AsusWRT.AsusWRT('http://192.168.1.1', 'admin', 'password')
```

Login
```typescript
asus.login()
```
will return true or false depending on success

Get all routers in the network (async):
```typescript
asus.getRouters()
```

Get wireless clients connected to router (async):
```typescript
asus.getWirelessClients(router.mac, "2G")
```

Get wired clients connected to router (async):
```typescript
asus.getWiredClients(router.mac)
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
