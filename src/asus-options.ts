export interface AsusOptions {
    username: string,
    password: string,
    baseUrl: string,
    errorLogCallback?: (logDescription: string, logData?: any) => void;
    infoLogCallback?: (logDescription: string, logData?: any) => void;
}
