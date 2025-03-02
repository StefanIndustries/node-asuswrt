import axios, {AxiosInstance, AxiosResponse} from "axios";
import * as https from "node:https";
import { AsusOptions } from "./asus-options";
import {userAgent} from "./constants";
import {LoginResult} from "./models/responses/login-result";
import {URLSearchParams} from "node:url";

/**
 * A utility class to debug and validate Asus Router connections, credentials, and setup.
 */
export class AsusTester {
    private ax: AxiosInstance | null;
    private disposed = false;
    private abortController = new AbortController();

    constructor(private options: AsusOptions) {
        this.ax = axios.create({
            baseURL: options.baseURL,
            timeout: 10000, // Timeout after 10 seconds
            headers: {
                'User-Agent': userAgent,
            },
            signal: this.abortController.signal,
            httpsAgent: new https.Agent({
                rejectUnauthorized: !options.isSelfSignedCertificate,
            }),
        });
    }

    /**
     * Run all debug tests to validate the router connection and authentication.
     * @returns {Promise<DebugResult>} A detailed result object with the outcomes of the tests.
     */
    public async runDiagnostics(): Promise<DebugResult> {
        if (this.disposed) {
            throw new Error("Cannot run diagnostics after the tester has been disposed.");
        }
        const result: DebugResult = {
            isUrlValid: false,
            canConnect: false,
            isAuthValid: false,
            message: "",
        };

        try {
            // Step 1: Validate the base URL.
            result.isUrlValid = this.validateBaseURL(this.options.baseURL);
            if (!result.isUrlValid) {
                result.message = "Invalid base URL provided.";
                return result;
            }

            // Step 2: Test connectivity to the login endpoint.
            result.canConnect = await this.testConnection();
            if (!result.canConnect) {
                result.message = "Could not connect to the login endpoint.";
                return result;
            }

            // Step 3: Test username and password authentication.
            result.isAuthValid = await this.validateAuthentication();
            if (!result.isAuthValid) {
                result.message = "Authentication failed. Check username and password.";
                return result;
            }

            result.message = "All diagnostics passed. The router is configured properly.";
            // eslint-disable-next-line
        } catch (error: any) {
            result.message = `An error occurred during diagnostics: ${error.message || error.toString()}`;
        }

        return result;
    }

    /**
     * Validate the provided base URL format.
     * @param {string | undefined} baseURL The base URL to validate.
     * @returns {boolean} True if the base URL is valid.
     */
    private validateBaseURL(baseURL: string | undefined): boolean {
        if (this.disposed) {
            throw new Error("Cannot validate the base URL after the tester has been disposed.")
        }

        try {
            new URL(baseURL!);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test connectivity to the router's login endpoint.
     * @returns {Promise<boolean>} True if the connection succeeds.
     */
    private async testConnection(): Promise<boolean> {
        if (this.disposed) {
            throw new Error("Cannot test connection after the tester has been disposed.")
        }
        try {
            const response = await this.ax!.get("/login.cgi");
            return response.status === 200;
        } catch {
            return false;
        }
    }

    /**
     * Test the username and password for authentication.
     * @returns {Promise<boolean>} True if authentication is successful.
     */
    private async validateAuthentication(): Promise<boolean> {
        if (this.disposed) {
            throw new Error("Cannot validate authentication after the tester has been disposed.")
        }
        try {
            const path = '/login.cgi';
            const formattedUsernamePassword = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
            const response = <AxiosResponse<LoginResult>>await this.ax!.request({
                method: 'POST',
                baseURL: this.options.baseURL,
                url: path,
                data: new URLSearchParams({
                    login_authorization: formattedUsernamePassword
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.status === 200 && response.data.asus_token !== undefined && !response.data.error_status;
        } catch {
            return false;
        }
    }

    /**
     * Dispose of this instance, cleaning up resources and preventing further use.
     */
    public dispose(): void {
        if (!this.disposed) {
            this.disposed = true;

            // Cancel any ongoing requests or timeouts
            this.abortController.abort('disposing');

            // Clean up axios instance by deleting references
            this.ax = null;
        }
    }
}

/**
 * Interface defining the diagnostic result structure.
 */
export interface DebugResult {
    isUrlValid: boolean;
    canConnect: boolean;
    isAuthValid: boolean;
    message: string;
}