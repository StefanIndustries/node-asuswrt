import {AsusOperationMode} from "./asus-operation-mode";

export interface AsusRouter {
    alias: string,
    modelName: string,
    uiModelName: string,
    productId: string,
    firmwareVersion: string,
    newFirmwareVersion: string,
    ip: string,
    mac: string,
    online: boolean,
    operationMode: AsusOperationMode
}
