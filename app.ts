import { AsusWrt } from "./src/asus-wrt";
import {AsusOptions} from "./src/asus-options";
import {AsusTester} from "./src/asus-tester";

async function main() {
    const url = process.env.ASUS_URL!;
    const username = process.env.ASUS_USERNAME!;
    const password = process.env.ASUS_PASSWORD!;
    const options: AsusOptions = {
        baseURL: url,
        username: username,
        password: password,
        isSelfSignedCertificate: true,
    }

    const asusTester = new AsusTester(options);

    const result = await asusTester.runDiagnostics();
    console.log(result);
    asusTester.dispose();


    const asusWrt = new AsusWrt(options);

    const clients = await asusWrt.discoverClients();
    await asusWrt.updateConnectedDevices();

    asusWrt.allClients.forEach(async (client) => {
        // client can be either of type router or access point, if you want to access the router only retrieve asusWrt.asusRouter.
        // client.setLeds(true);
        // console.log(client.reboot());
        // console.log(client.getCPUMemoryLoad());
        // console.log(client.getUptimeSeconds());
        console.log(client.mac);
        console.log(client.connectedDevices);
    });

    // const vpnClient = await router.getVpnClients();
    // const trafficData = await router.getTotalTrafficData();
    // const wanStatus = await router.getWANStatus();
    // const wakeOnLanDevices = await router.getWakeOnLanDevices();
    // const vpnClients = await router.getVpnClients();
    // const ooklaServers = await router.getOoklaServers();
    // const speedTestResult = await router.runSpeedtest(ooklaServers[0]);
}

main().then(() => {
    console.log('program done');
});