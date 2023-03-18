export interface AsusWRTOptions {
    Username: string,
    Password: string,
    BaseUrl: string,
    ErrorLogCallback?: (logDescription: string, logData?: any) => void;
    InfoLogCallback?: (logDescription: string, logData?: any) => void;
}
