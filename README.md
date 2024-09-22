# AsusWrt NPM Package

The `AsusWrt` NPM package is a powerful tool for interfacing with Asus routers, allowing you to manage your router and
connected devices programmatically. This README provides an example of how to use the package and explains its main
functionalities.

The 2.x release restructured the entire process of data management and optimized usage of the Axios client. Each router or access point is now its own 'instance' with operations instead of one singleton calling all methods.

## Installation

To install the `AsusWrt` package, use the following command:

```bash
npm install asus-wrt
```

## Usage

Below is an example of how to use the `AsusWrt` package in a TypeScript project:

```typescript
import {AsusWrt} from "./src/asus-wrt";
import {AsusClient} from "./lib/classes/asus-client";

async function main() {
    const url = process.env.ASUS_URL!;
    const username = process.env.ASUS_USERNAME!;
    const password = process.env.ASUS_PASSWORD!;
    const asusWrt = new AsusWrt({
        baseURL: url,
        username: username,
        password: password,
    });

    const clients = await asusWrt.discoverClients();
    const router = asusWrt.asusRouter!;
    await asusWrt.updateConnectedDevices();

    asusWrt.allClients.forEach((client: AsusClient) => {
        console.log(client.setLeds(true));
        console.log(client.reboot());
        console.log(client.getCPUMemoryLoad());
        console.log(client.getUptimeSeconds());
        console.log(client.connectedDevices);
    });

    const vpnClient = await router.getVpnClients();
    const trafficData = await router.getTotalTrafficData();
    const wanStatus = await router.getWANStatus();
    const wakeOnLanDevices = await router.getWakeOnLanDevices();
    const vpnClients = await router.getVpnClients();
    const ooklaServers = await router.getOoklaServers();
    const speedTestResult = await router.runSpeedtest(ooklaServers[0]);
}

main().then(() => {
    console.log('Program done');
})
```

### Environment Variables

Make sure to set the following environment variables with the correct values for connecting to your Asus router with the example code.

- `ASUS_URL`: Base URL of the Asus router.
- `ASUS_USERNAME`: Username for logging into the router.
- `ASUS_PASSWORD`: Password for logging into the router.

### Example Code Explanation

1. **Initialization:**
    - Create an instance of `AsusWrt` with the necessary credentials by providing `baseURL`, `username`, and `password`.

2. **Discovering Clients:**
    - Use `discoverClients` to get a list of connected clients.
    - Update connected devices with `updateConnectedDevices`.

3. **Accessing Router and Client Specific Functions:**
    - Access client-specific functions such as `setLeds`, `reboot`, `getCPUMemoryLoad`, `getUptimeSeconds`, and
      `connectedDevices` for each client.
    - Get additional data from the router like VPN clients, total traffic data, WAN status, and Wake-on-LAN devices.

4. **Speed Test:**
    - Retrieve Ookla speed test servers and run a speed test using `runSpeedtest`.

### Functions

#### `AsusWrt` Methods

- `discoverClients()`: Discovers connected clients on the network.
- `updateConnectedDevices()`: Updates the list of connected devices.

#### `AsusClient` Methods
These methods are also available on the AsusRouter

- `setLeds(state: boolean)`: Sets the LED state.
- `reboot()`: Reboots the client.
- `getCPUMemoryLoad()`: Retrieves CPU and memory load.
- `getUptimeSeconds()`: Retrieves uptime in seconds.
- `connectedDevices`: Lists connected devices.

#### `AsusRouter` Methods

- `getVpnClients()`: Retrieves VPN clients.
- `getTotalTrafficData()`: Gets total traffic data.
- `getWANStatus()`: Gets the WAN status.
- `getWakeOnLanDevices()`: Retrieves devices that can be woken up using Wake-on-LAN.
- `getOoklaServers()`: Gets Ookla speed test servers.
- `runSpeedtest(server)`: Runs a speed test using the specified Ookla server.