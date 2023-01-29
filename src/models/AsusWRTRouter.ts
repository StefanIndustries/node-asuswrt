import {AsusWRTOperationMode} from "./AsusWRTOperationMode";

export interface AsusWRTRouter {
    alias: string,
    modelName: string,
    uiModelName: string,
    productId: string,
    firmwareVersion: string,
    newFirmwareVersion: string,
    ip: string,
    mac: string,
    online: boolean,
    operationMode: AsusWRTOperationMode
}
