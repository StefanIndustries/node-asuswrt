import { AsusResponse } from "./asus-response";

export interface LoginResult extends AsusResponse {
    asus_token: string;
    captcha_on?: string;
    last_time_lock_warning?: string;
    /** Seconds left on a login lock; set together with `error_status` "7". */
    remaining_lock_time?: string;
    lock_version?: string;
}
