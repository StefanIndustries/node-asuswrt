import { AsusWrt } from "./src/asus-wrt";

async function main() {
    const asusWrt = new AsusWrt({
        baseURL: process.env["ASUSIP"]!,
        username: process.env["ASUSUSERNAME"]!,
        password: process.env["ASUSPASSWORD"]!,
    });

    const clients = await asusWrt.discoverClients();
    console.log(clients);

    setTimeout(() => {
        console.log(asusWrt.allClients);
    }, 5000);
}

main().then(() => {
    console.log('program done');
})