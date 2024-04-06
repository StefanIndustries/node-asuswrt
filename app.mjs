import * as AsusWRT from "./lib/asus-wrt.js";

const config = {
    username: process.env.ASUSUSERNAME,
    password: process.env.ASUSPASSWORD,
    baseUrl: process.env.ASUSIP,
    errorLogCallback: (logDescription, logData) => { // optional property
        if (logData) {
            console.log(logDescription, logData);
        } else {
            console.log(logDescription);
        }
    },
    infoLogCallback: (logDescription, logData) => { // optional property
        if (logData) {
            console.log(logDescription, logData);
        } else {
            console.log(logDescription);
        }
    }
}

const asus = new AsusWRT.AsusWrt(config);

asus.getWANStatus().then(result => {
    console.log(result);
});

// asus.getTotalTrafficData().then(result => {
//     console.log('traffic', result);
// })
//
// asus.getRouters().then(result => {
//     result.forEach(router => {
//         asus.getCPUMemoryLoad(router.mac).then(result => {
//             console.log('load', result);
//         });
//         asus.getUptime(router.mac).then(result => {
//             console.log('uptime', result);
//         });
//         asus.setLedsEnabled(router.mac, true).then(success => {
//             console.log(success);
//         });
//         asus.getWirelessClients(router.mac, "2G").then(wiredClients => {
//             console.log(router.alias, wiredClients);
//         });
//     })
// });