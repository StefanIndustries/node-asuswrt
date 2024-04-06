import {AsusResponse} from "./asus-response";

export interface LoginResult extends AsusResponse {
    asus_token: string
}