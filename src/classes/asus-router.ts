import { AxiosInstance, isAxiosError, isCancel } from "axios";
import { AsusClient } from "./asus-client";
import { AppGetPayloads } from "../models/requests/app-get-payloads";
import { NetdevData } from "../models/responses/netdev-data";
import { trafficDataTransformer } from "../transformers/traffic-data-transformer";
import { AsusTrafficData } from "../models/asus-traffic-data";
import { AsusWanLinkStatus } from "../models/asus-wan-link-status";
import { wanLinkTransformer } from "../transformers/wan-link-transformer";
import { Wollist } from "../models/responses/wollist";
import { AsusWakeOnLanDevice } from "../models/asus-wake-on-lan-device";
import { wollistTransformer } from "../transformers/wollist-transformer";
import { VpnClient } from "../models/responses/vpn-client";
import { AsusVpnClient } from "../models/asus-vpn-client";
import { VpnClientTransformer } from "../transformers/vpn-client-transformer";
import { AsusOoklaServer } from "../models/asus-ookla-server";
import { OoklaSpeedtestServers } from "../models/responses/ookla-speedtest-server";
import { OoklaSpeedtestServersTransformer } from "../transformers/ookla-speedtest-servers-transformer";
import { OoklaSpeedtestHistory } from "../models/responses/ookla-speedtest-history";
import { AsusOoklaSpeedtestResult } from "../models/asus-ookla-speedtest-result";
import { OoklaSpeedtestHistoryTransformer } from "../transformers/ookla-speedtest-history-transformer";
import { RebootNetworkPayload, SetActiveVPNPayload, WakeOnLanPayload } from "../models/requests/apply-app-payloads";
import { Device } from "../models/responses/get-cfg-clientlist";
import { AsusGuestNetwork } from "../models/asus-guest-network";
import {
    GuestNetworkMetadataPayload, GuestNetworksPayload, GuestNetworkStatePayload, SetGuestNetworkPayload
} from "../models/requests/guest-network-payloads";
import {
    guestNetworkRadioCount, guestNetworksTransformer, guestNetworkStateTransformer
} from "../transformers/guest-networks-transformer";

const GUEST_READ_TIMEOUT_MS = 10000;
const GUEST_APPLY_TIMEOUT_MS = 15000;
const GUEST_VERIFICATION_TIMEOUT_MS = 60000;
const GUEST_POLL_INTERVAL_MS = 2000;
// Stock 388 firmware reports countdowns in 30-second steps; allow two steps during apply.
const GUEST_COUNTDOWN_TOLERANCE_SECONDS = 60;

interface GuestNetworkChange {
    previous: AsusGuestNetwork;
    enabled: boolean;
    durationSeconds: number;
    previousReadAt: number;
    restartObserved: boolean;
    applyError?: unknown;
}

function isRetryableGuestRequestError(error: unknown): boolean {
    return !isCancel(error) && isAxiosError(error)
        && (error.response
            ? [408, 429, 500, 502, 503, 504].includes(error.response.status)
            : ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
                'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'ERR_NETWORK']
                .includes(error.code ?? ''));
}

export class AsusRouter extends AsusClient {
    private guestNetworkChange: Promise<void> = Promise.resolve();
    private pendingGuestNetworkChange?: GuestNetworkChange;

    constructor(ax: AxiosInstance, url: string, mac: string, username: string, password: string, deviceInfo: Device) {
        super(ax, url, mac, username, password, deviceInfo);
        super.authenticate().then(() => {
        }).catch((e) => {
            throw new Error(e);
        });
    }

    /** Lists previously configured classic 2.4/5 GHz guest networks, including disabled ones. */
    async getGuestNetworks(): Promise<AsusGuestNetwork[]> {
        const metadata = await this.appGet<Record<string, unknown>, Record<string, unknown>>(
            GuestNetworkMetadataPayload, undefined, GUEST_READ_TIMEOUT_MS
        );
        const radioCount = guestNetworkRadioCount(metadata);
        return await this.appGet<Record<string, unknown>, AsusGuestNetwork[]>(
            GuestNetworksPayload(radioCount), data => guestNetworksTransformer(data, radioCount),
            GUEST_READ_TIMEOUT_MS
        );
    }

    /**
     * Enables/disables an existing guest network. Zero seconds means unlimited.
     * Enabling restarts the router's native countdown, including on an already
     * enabled network. Resolves only after the configuration/countdown is read back.
     */
    async setGuestNetworkEnabled(id: string, enabled: boolean, durationSeconds = 0): Promise<boolean> {
        const payload = SetGuestNetworkPayload(id, enabled, durationSeconds);
        // Radio/slot selectors are shared router state. Serialize changes until
        // the restart has initialized the selected guest network's countdown.
        const operation = this.guestNetworkChange.then(async () => {
            // A previous write may have applied despite a lost response or failed
            // verification. Reconcile it before overwriting the shared selectors.
            await this.confirmPendingGuestNetworkChange(false);
            const networks = await this.getGuestNetworks();
            const previous = networks.find(network => network.id === id);
            if (!previous) {
                throw new Error('Selected guest network no longer exists or is not configured');
            }
            const change: GuestNetworkChange = {
                previous, enabled, durationSeconds, previousReadAt: Date.now(), restartObserved: false
            };
            this.pendingGuestNetworkChange = change;
            const response = await this.customAxRequest({
                baseURL: this.url,
                url: '/applyapp.cgi',
                method: 'POST',
                timeout: GUEST_APPLY_TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': `asus_token=${this.asusToken}`
                },
                data: payload.toString()
            }).catch(error => {
                if (isAxiosError(error)
                    && ((error.response && error.response.status >= 400 && error.response.status < 500
                        && ![408, 429].includes(error.response.status))
                        || (!error.request && ['ERR_BAD_OPTION', 'ERR_BAD_OPTION_VALUE', 'ERR_INVALID_URL']
                            .includes(error.code ?? '')))) {
                    this.pendingGuestNetworkChange = undefined;
                }
                if (!isRetryableGuestRequestError(error)) {
                    throw error;
                }
                // Never resend an apply with an uncertain outcome. Its readback
                // can still confirm success while keeping queued writes blocked.
                change.applyError = error;
                return undefined;
            });
            if (response) {
                if (response.data && typeof response.data === 'object' && response.data.error_status) {
                    this.pendingGuestNetworkChange = undefined;
                    throw new Error('Router rejected the guest network change');
                }
                if (response.status < 200 || response.status >= 300
                    || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
                    throw new Error('Router rejected the guest network change');
                }
            }
            await this.confirmPendingGuestNetworkChange(true);
            return true;
        });
        this.guestNetworkChange = operation.then(() => undefined, () => undefined);
        return await operation;
    }

    private async confirmPendingGuestNetworkChange(verifyState: boolean): Promise<void> {
        if (this.pendingGuestNetworkChange) {
            await this.verifyGuestNetworkChange(this.pendingGuestNetworkChange, verifyState);
            this.pendingGuestNetworkChange = undefined;
        }
    }

    private async readGuestNetworkState(id: string, timeout: number) {
        // Keep the raw Axios error so verification can distinguish cancellation,
        // temporary transport failures, and permanent protocol/validation errors.
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: '/appGet.cgi',
            method: 'POST',
            timeout,
            headers: { 'Cookie': `asus_token=${this.asusToken}` },
            data: new URLSearchParams({ hook: GuestNetworkStatePayload(id) })
        });
        const data = response.data;
        const state = guestNetworkStateTransformer(data, id);
        if (typeof data.wl_unit !== 'string' || typeof data.wl_subunit !== 'string') {
            throw new Error('Router did not return guest network restart selectors');
        }
        if (typeof data.rc_service !== 'string') {
            throw new Error('Router did not return guest network service status');
        }
        return {
            ...state,
            restartPending: `wl${data.wl_unit}.${data.wl_subunit}` === id,
            selectorsIdle: data.wl_unit === '-1' && data.wl_subunit === '-1',
            // Firmware clears rc_service after handling the requested services.
            // Disabled guest interfaces do not clear their countdown selectors.
            servicesComplete: data.rc_service === ''
        };
    }

    private async verifyGuestNetworkChange(change: GuestNetworkChange, verifyState: boolean): Promise<void> {
        const { previous, enabled, durationSeconds, previousReadAt } = change;
        const deadline = Date.now() + GUEST_VERIFICATION_TIMEOUT_MS;
        let lastReadError: unknown;
        while (Date.now() < deadline) {
            const timeout = Math.min(GUEST_READ_TIMEOUT_MS, deadline - Date.now());
            if (timeout <= 0) {
                break;
            }
            try {
                const state = await this.readGuestNetworkState(previous.id, timeout);
                change.restartObserved ||= state.restartPending;
                // A later operation only needs confirmed service readiness. The
                // old countdown may have expired since its verification failed.
                if (state.servicesComplete && !verifyState) {
                    return;
                }
                if (state.servicesComplete && state.enabled === enabled) {
                    if (!enabled) {
                        return;
                    }
                    const remaining = state.remainingSeconds;
                    const countdownMatches = durationSeconds === 0 ? remaining === 0
                        : remaining !== null && remaining > 0 && remaining <= durationSeconds
                            && remaining >= Math.max(1, durationSeconds - GUEST_COUNTDOWN_TOLERANCE_SECONDS);
                    // An idle selector and matching settings can both be stale.
                    // Require a completed restart or evidence that the timer changed.
                    const countdownRefreshed = change.restartObserved || !previous.enabled
                        || (remaining !== null && previous.remainingSeconds !== null
                            && (remaining > previous.remainingSeconds
                                || (durationSeconds === 0 && previous.remainingSeconds > 0)
                                || previous.remainingSeconds > durationSeconds
                                    + (Date.now() - previousReadAt) / 1000
                                    + GUEST_COUNTDOWN_TOLERANCE_SECONDS));
                    if (state.selectorsIdle && state.durationSeconds === durationSeconds
                        && countdownMatches && countdownRefreshed) {
                        return;
                    }
                }
            } catch (error) {
                if (!isRetryableGuestRequestError(error)) {
                    throw error;
                }
                lastReadError = error;
            }
            const delay = Math.min(GUEST_POLL_INTERVAL_MS, deadline - Date.now());
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        const detail = lastReadError instanceof Error ? `; last read error: ${lastReadError.message}` : '';
        const applyDetail = change.applyError instanceof Error ? `; apply error: ${change.applyError.message}` : '';
        throw new Error(`Could not confirm guest network state and countdown; check the ASUS interface${detail}${applyDetail}`);
    }

    /**
     * Fetches the total traffic data from the application.
     *
     * @return {Promise<AsusTrafficData>} A promise that resolves with the total traffic data.
     */
    async getTotalTrafficData(): Promise<AsusTrafficData> {
        return await this.appGet<NetdevData, AsusTrafficData>(AppGetPayloads.TrafficData, trafficDataTransformer);
    }

    /**
     * Fetches the status of the Wide Area Network (WAN) connection.
     *
     * @return {Promise<AsusWanLinkStatus>} A promise that resolves to the status of the WAN connection.
     */
    async getWANStatus(): Promise<AsusWanLinkStatus> {
        return await this.appGet<string, AsusWanLinkStatus>(AppGetPayloads.WANStatus, wanLinkTransformer);
    }

    /**
     * Retrieves the list of Wake-on-LAN devices.
     *
     * @return {Promise<AsusWakeOnLanDevice[]>} A promise that resolves to an array of AsusWakeOnLanDevice objects.
     */
    async getWakeOnLanDevices(): Promise<AsusWakeOnLanDevice[]> {
        return await this.appGet<Wollist, AsusWakeOnLanDevice[]>(AppGetPayloads.WakeOnLanList, wollistTransformer);
    }

    /**
     * Sends a Wake-on-LAN (WoL) request to the specified device.
     *
     * @param {AsusWakeOnLanDevice} wolDevice - The Wake-on-LAN device information required to send the request.
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating the success of the WoL request.
     */
    async callWakeOnLan(wolDevice: AsusWakeOnLanDevice): Promise<boolean> {
        return await this.applyAppPOST(WakeOnLanPayload(wolDevice));
    }

    /**
     * Retrieves a list of VPN clients.
     *
     * @return {Promise<AsusVpnClient[]>} A promise that resolves to an array of AsusVpnClient objects representing the VPN clients.
     */
    async getVpnClients(): Promise<AsusVpnClient[]> {
        return await this.appGet<VpnClient, AsusVpnClient[]>(AppGetPayloads.VpnClients, VpnClientTransformer);
    }

    /**
     * Sets the active VPN client for the application. If no client is provided, the current active VPN client is set.
     *
     * @param {AsusVpnClient} [client] - An optional parameter representing the Asus VPN client to be set as active.
     * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the operation was successful.
     */
    async setActiveVpnClient(client?: AsusVpnClient): Promise<boolean> {
        if (client) {
            return await this.applyAppPOST(SetActiveVPNPayload(client));
        } else {
            return await this.applyAppPOST(SetActiveVPNPayload());
        }
    }

    /**
     * Retrieves a list of Ookla servers.
     *
     * @return {Promise<AsusOoklaServer[]>} A promise that resolves to an array of AsusOoklaServers.
     */
    async getOoklaServers(): Promise<AsusOoklaServer[]> {
        return await this.appGet<OoklaSpeedtestServers, AsusOoklaServer[]>(AppGetPayloads.OoklaServers, OoklaSpeedtestServersTransformer);
    }

    /**
     * Retrieves the history of Ookla speed tests.
     *
     * @return {Promise<AsusOoklaSpeedtestResult[]>} A promise that resolves to an array of AsusOoklaSpeedtestResult objects representing the speed test history.
     */
    async getOoklaSpeedtestHistory(): Promise<AsusOoklaSpeedtestResult[]> {
        return await this.appGet<OoklaSpeedtestHistory, AsusOoklaSpeedtestResult[]>(AppGetPayloads.OoklaSpeedtestHistory, OoklaSpeedtestHistoryTransformer);
    }

    /**
     * Fetches the certificate from the specified endpoint.
     *
     * @return {Promise<any>} A promise that resolves to the retrieved certificate data in a stream format.
     */
    async getCertificate(): Promise<any> {
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: '/cert_key.tar',
            method: 'GET',
            responseType: "stream"
        });
        return response.data;
    }

    /**
     * Runs a speedtest using the specified Ookla server, updates the history,
     * and returns the result.
     *
     * @param {AsusOoklaServer} ooklaServer - The server to be used for the speedtest.
     * @return {Promise<AsusOoklaSpeedtestResult>} The result of the speedtest.
     */
    async runSpeedtest(ooklaServer: AsusOoklaServer): Promise<AsusOoklaSpeedtestResult> {
        let history: AsusOoklaSpeedtestResult[] = [];
        try {
            history = await this.getOoklaSpeedtestHistory();
        } catch (e) {
            console.log(e);
            console.log('History is broken. writing empty history on next result');
        }
        await this.setOoklaSpeedtestStartTime();
        await this.startOoklaSpeedtest(ooklaServer);
        const result = await this.getOoklaSpeedtestResult();
        await this.writeOoklaSpeedtestResult(history, result);
        return result;
    }

    /**
     * Initiates a network reboot by triggering the appropriate API call.
     *
     * @return {Promise<boolean>} A promise that resolves to true if the reboot command was successfully
     *                            issued, otherwise false.
     */
    async rebootNetwork(): Promise<boolean> {
        return await this.applyAppPOST(RebootNetworkPayload());
    }

    private async setOoklaSpeedtestStartTime(): Promise<boolean> {
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: '/set_ookla_speedtest_start_time.cgi',
            method: 'POST',
            data: new URLSearchParams({
                ookla_start_time: Date.now().toString()
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    private async startOoklaSpeedtest(ooklaServer: AsusOoklaServer): Promise<boolean> {
        const response = await this.customAxRequest({
            baseURL: this.url,
            url: `/ookla_speedtest_exe.cgi`,
            method: 'POST',
            data: new URLSearchParams({
                type: '',
                id: `${ooklaServer.id}`
            })
        });
        return response.status >= 200 && response.status < 300;
    }

    private async getOoklaSpeedtestResult(): Promise<AsusOoklaSpeedtestResult> {
        let nRetrieveResultAttempts = 0;
        while (nRetrieveResultAttempts < 30) {
            nRetrieveResultAttempts++;
            const data = await this.appGet<any, any>(AppGetPayloads.OoklaSpeedtestResult, (data: any) => data);
            const resultFound: AsusOoklaSpeedtestResult = data.ookla_speedtest_get_result.find((element: any) => element.type === 'result');
            if (resultFound) {
                return resultFound;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error(`unable to retrieve speedtest result`);
    }

    private async writeOoklaSpeedtestResult(history: AsusOoklaSpeedtestResult[], result: AsusOoklaSpeedtestResult): Promise<boolean> {
        const rebuiltHistory = history.map((element) => JSON.stringify(element)).join(`\n`);
        const resultString = JSON.stringify(result);
        const uglyJsonString = history.length > 0 ? `${resultString}\n${rebuiltHistory}` : resultString;
        const requestBody = new URLSearchParams({speedTest_history: uglyJsonString});
        const response = await this.customAxRequest({
            url: '/ookla_speedtest_write_history.cgi',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            data: requestBody
        });
        return response.status >= 200 && response.status < 300;
    }
}
