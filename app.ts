import { AsusWrt } from "./src/asus-wrt";

async function main() {
    const asusWrt = new AsusWrt({
        baseURL: process.env["ASUSIP"]!,
        username: process.env["ASUSUSERNAME"]!,
        password: process.env["ASUSPASSWORD"]!,
    });

    const clients = await asusWrt.discoverClients();
    for (const client of clients) {
        const load = await client.getCPUMemoryLoad();
        console.log(load);
    }
}

main().then(() => {
    console.log('program done');
})