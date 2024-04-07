import {AsusResponse} from "./asus-response";

interface CpuUsage {
    cpu1_total: string;
    cpu1_usage: string;
    cpu2_total: string;
    cpu2_usage: string;
    cpu3_total: string;
    cpu3_usage: string;
    cpu4_total: string;
    cpu4_usage: string;
}

interface MemoryUsage {
    mem_total: string;
    mem_free: string;
    mem_used: string;
}

export interface SystemUsage extends AsusResponse {
    cpu_usage: CpuUsage;
    memory_usage: MemoryUsage;
}