import { SystemUsage } from "../models/responses/system-usage";
import { AsusCpuMemLoad } from "../models/asus-cpu-mem-load";

export function appGetSystemUsageTransformer(cpuMemoryData: SystemUsage): AsusCpuMemLoad {
    const cpuTotal = parseInt(cpuMemoryData.cpu_usage.cpu1_total) + parseInt(cpuMemoryData.cpu_usage.cpu2_total) + parseInt(cpuMemoryData.cpu_usage.cpu3_total) + parseInt(cpuMemoryData.cpu_usage.cpu4_total);
    const cpuUsage = parseInt(cpuMemoryData.cpu_usage.cpu1_usage) + parseInt(cpuMemoryData.cpu_usage.cpu2_usage) + parseInt(cpuMemoryData.cpu_usage.cpu3_usage) + parseInt(cpuMemoryData.cpu_usage.cpu4_usage);
    const totalMemory = parseInt(cpuMemoryData.memory_usage.mem_total);
    const usedMemory = parseInt(cpuMemoryData.memory_usage.mem_used);
    return {
        CPUUsagePercentage: (100 / cpuTotal) * cpuUsage,
        MemoryUsagePercentage: (100 / totalMemory) * usedMemory
    };
}