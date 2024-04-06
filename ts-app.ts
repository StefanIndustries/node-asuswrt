import {AsusWrt} from "./lib/asus-wrt";

async function main() {
    const asusWrt = new AsusWrt({
        baseUrl: process.env["ASUSIP"]!,
        username: process.env["ASUSUSERNAME"]!,
        password: process.env["ASUSPASSWORD"]!,
        infoLogCallback: (logDescription, logData) => {
            console.log(logDescription, logData);
        },
        errorLogCallback: (logDescription, logData) => {
            console.error(logDescription, logData);
        }
    });
    const status = await asusWrt.getWANStatus();
    console.log(status);
}

main().then(() => {
    console.log('program done');
})