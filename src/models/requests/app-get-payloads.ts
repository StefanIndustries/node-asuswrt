export enum AppGetPayloads {
    CfgClientList = 'get_cfg_clientlist()',
    SystemUsage = 'cpu_usage(appobj);memory_usage(appobj)',
    Uptime = 'uptime()',
    WANStatus = 'wanlink()',
    TrafficData = 'netdev(appobj)',
    WakeOnLanList = 'nvram_get(wollist);',
    VpnClients = 'nvram_get(vpnc_clientlist);nvram_get(vpnc_pptp_options_x_list);nvram_get(vpnc_proto);nvram_get(vpnc_heartbeat_x);nvram_get(vpnc_pppoe_username);nvram_get(vpn_clientx_eas);nvram_get(vpn_client1_state);nvram_get(vpn_client2_state);nvram_get(vpn_client3_state);nvram_get(vpn_client4_state);nvram_get(vpn_client5_state);nvram_get(vpn_client1_errno);nvram_get(vpn_client2_errno);nvram_get(vpn_client3_errno);nvram_get(vpn_client4_errno);nvram_get(vpn_client5_errno);nvram_get(vpnc_state_t);nvram_get(vpnc_sbstate_t);',
    OoklaServers = 'ookla_speedtest_get_servers()',
    OoklaSpeedtestHistory = 'ookla_speedtest_get_history()',
    OoklaSpeedtestResult = 'ookla_speedtest_get_result()',
    ClientList = 'get_clientlist();get_wiredclientlist();get_wclientlist();',
}