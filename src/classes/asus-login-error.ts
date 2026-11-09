import { LoginResult } from "../models/responses/login-result";

/** `error_status` the router returns while logins are blocked after too many failed attempts. */
export const LOGIN_LOCKED_ERROR_STATUS = '7';

/**
 * Thrown when the router rejects a login. `isLocked` is true when the router is
 * temporarily blocking logins (error 7); `remainingLockSeconds` then tells how long.
 */
export class AsusLoginError extends Error {
    public readonly errorStatus: string;
    public readonly isLocked: boolean;
    public readonly remainingLockSeconds?: number;

    constructor(result: Partial<LoginResult>) {
        const errorStatus = String(result.error_status ?? '');
        const isLocked = errorStatus === LOGIN_LOCKED_ERROR_STATUS;
        const remaining = Number.parseInt(String(result.remaining_lock_time ?? ''), 10);
        const remainingLockSeconds = isLocked && Number.isFinite(remaining) && remaining >= 0 ? remaining : undefined;
        super(isLocked
            ? `Router is temporarily locked after too many failed login attempts${remainingLockSeconds !== undefined ? `; try again in ${remainingLockSeconds} seconds` : '; try again later'}.`
            : `Invalid username or password (router error ${errorStatus}).`);
        this.name = 'AsusLoginError';
        this.errorStatus = errorStatus;
        this.isLocked = isLocked;
        this.remainingLockSeconds = remainingLockSeconds;
    }
}
