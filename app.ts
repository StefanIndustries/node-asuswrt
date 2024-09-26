import { AsusWrt } from "./src/asus-wrt";
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
        // client can be either of type router or access point, if you want to access the router only retrieve asusWrt.asusRouter.
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
    console.log('program done');
})