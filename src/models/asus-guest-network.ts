/** An existing classic ASUSWRT guest network. No Wi-Fi credentials are returned. */
export interface AsusGuestNetwork {
    /** Stable radio/slot identifier, for example wl0.1. */
    id: string;
    unit: number;
    subunit: number;
    ssid: string;
    band: '2.4 GHz' | '5 GHz';
    enabled: boolean;
    /** Configured access duration in seconds; zero means unlimited. */
    durationSeconds: number;
    /** Router countdown in seconds, or null if unavailable. */
    remainingSeconds: number | null;
}

export const MAX_GUEST_DURATION_SECONDS = 30 * 24 * 60 * 60;
