import { OoklaSpeedtestHistory } from "../models/responses/ookla-speedtest-history";
import { AsusOoklaSpeedtestResult } from "../models/asus-ookla-speedtest-result";

export function OoklaSpeedtestHistoryTransformer(ooklaHistoryData: OoklaSpeedtestHistory): AsusOoklaSpeedtestResult[] {
    const history = ooklaHistoryData.ookla_speedtest_get_history;
    return history.filter((element: any) => element && element.type && element.type === 'result');
}