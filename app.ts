import { AsusWrt } from "./src/asus-wrt";

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
    const vpnClient = await router.getVpnClients();
    console.log(vpnClient);
    // const trafficData = await router.getTotalTrafficData();
    // const wanStatus = await router.getWANStatus();
    // const wakeOnLanDevices = await router.getWakeOnLanDevices();
    // const vpnClients = await router.getVpnClients();
    // // const ooklaServers = await router.getOoklaServers();
    // // const speedTestResult = await router.runSpeedtest(ooklaServers[0]);
    // // console.log(speedTestResult);
}

main().then(() => {
    console.log('program done');
})