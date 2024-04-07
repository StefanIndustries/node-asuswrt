import {AsusResponse} from "./asus-response";

export interface VpnClient extends AsusResponse {
    vpnc_clientlist: string;
    vpnc_pptp_options_x_list: string;
    vpnc_proto: string;
    vpnc_heartbeat_x: string;
    vpnc_pppoe_username: string;
    vpn_clientx_eas: string;
    vpn_client1_state: string;
    vpn_client2_state: string;
    vpn_client3_state: string;
    vpn_client4_state: string;
    vpn_client5_state: string;
    vpn_client1_errno: string;
    vpn_client2_errno: string;
    vpn_client3_errno: string;
    vpn_client4_errno: string;
    vpn_client5_errno: string;
    vpnc_state_t: string;
    vpnc_sbstate_t: string;
}