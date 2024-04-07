import {Wollist} from "../models/responses/wollist";
import {AsusWakeOnLanDevice} from "../models/asus-wake-on-lan-device";

export function wollistTransformer(wollist: Wollist): AsusWakeOnLanDevice[] {
    let wolClients: AsusWakeOnLanDevice[] = [];
    const wollistUnsplitted = wollist.wollist;
    const wollistSplitted = wollistUnsplitted.split('&#60');
    if (wollistSplitted.length > 0) {
        wollistSplitted.forEach((item: any) => {
            if (item.indexOf('&#62') > 0) {
                const splittedItem = item.split('&#62');
                wolClients.push({
                    name: splittedItem[0],
                    mac: splittedItem[1]
                });
            }
        });
    }
    return wolClients;
}