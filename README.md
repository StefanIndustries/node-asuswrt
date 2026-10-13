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

### Classic guest Wi-Fi

`getGuestNetworks()` lists previously configured classic guest slots (1–3) on
2.4/5 GHz radios, including disabled networks. Each entry has a stable `id`
(e.g. `wl0.1`), SSID, band, enabled state, configured duration and remaining
seconds. Wi-Fi passwords are not requested or returned. Configure the SSID,
password and isolation in the ASUS interface before using these methods.
Discovery returns an empty array if no classic guest slots are configured.

```typescript
const guests = await router.getGuestNetworks();
const guest = guests.find(network => network.ssid === 'Visitors' && network.band === '2.4 GHz');
if (!guest) throw new Error('Guest network not found');

await router.setGuestNetworkEnabled(guest.id, true, 4 * 60 * 60); // four hours
await router.setGuestNetworkEnabled(guest.id, true);             // unlimited
await router.setGuestNetworkEnabled(guest.id, false);            // disable
```

The duration is an integer in seconds from 0 (unlimited) to 2592000 (30 days).
Enabling always starts a fresh router-managed countdown. The request selects
`wl_unit`/`wl_subunit` so the wireless restart initializes that slot's
`_expire_tmp` from `_expire`, even when the duration has not changed. It changes
only the selected slot's enabled state and duration, not its security or LAN
access configuration. Changes are serialized until restart completion is
confirmed, including when disabling. Verification polls only the selected slot,
restart selectors, and `rc_service` for up to 60 seconds after applying the change.
The service status must be idle; disabled slots may retain their countdown selectors.
Repeating an enable must show a completed restart or a refreshed countdown;
already-matching settings alone are not proof. If the restart completes too
quickly to observe and the timer still looks unchanged, verification may fail
even though the router applied the change. Check its interface before retrying.

If an apply response is lost or times out, verification can still confirm success;
the apply request is never automatically resent. An unconfirmed change is retained
on this `AsusRouter` instance. Subsequent changes first verify that its services have
finished and do not write new settings while they remain pending. This readiness check
has its own 60-second deadline and does not require the old countdown to still match
(it may have expired). Explicit router rejections do not block later changes.

Applying a change restarts wireless/firewall services and may briefly interrupt
Wi-Fi. Guest Network Pro / SDN is not supported. Run `npm test` for mocked router
protocol checks.

Hardware checks used one **RT-AX88U**, stock **3.0.0.4.388_24385**. Its timer
reports 30-second steps, so access duration is not a precision timer.
See [development notes](DEVELOPMENT.md) for recorded checks and coverage limits.
The verification refactor has automated coverage; it has not been retested on hardware.
