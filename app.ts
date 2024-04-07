import { AsusWrt } from "./src/asus-wrt";

async function main() {
    const asusWrt = new AsusWrt({
        baseURL: process.env["ASUSIP"]!,
        username: process.env["ASUSUSERNAME"]!,
        password: process.env["ASUSPASSWORD"]!,
    });

    const clients = await asusWrt.discoverClients();
    const router = asusWrt.asusRouter!;
    const trafficData = await router.getTotalTrafficData();
    const wanStatus = await router.getWANStatus();
    const wakeOnLanDevices = await router.getWakeOnLanDevices();
    const vpnClients = await router.getVpnClients();
    const ooklaServers = await router.getOoklaServers();
    // const ooklaHistory = await router.getOoklaSpeedtestHistory(); // broken
}

main().then(() => {
    console.log('program done');
})