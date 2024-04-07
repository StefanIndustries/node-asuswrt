import {VpnClient} from "../models/responses/vpn-client";
import {AsusVpnClient} from "../models/asus-vpn-client";

export function VpnClientTransformer(vpnClient: VpnClient): AsusVpnClient[] {
    const vpnListUnMapped = vpnClient.vpnc_clientlist.split('&#60').map((item: string) => { return item.split('&#62') });
    const vpnList = vpnListUnMapped.map((item: string[]) => {
        return <AsusVpnClient> {
            description: item[0],
            protocol: item[1],
            unit: item[2],
            username: item[3],
            password: item[4]
        }
    });
    if (vpnList[0].description === '' && vpnList[0].protocol === undefined) {
        return [];
    }
    return vpnList;
}