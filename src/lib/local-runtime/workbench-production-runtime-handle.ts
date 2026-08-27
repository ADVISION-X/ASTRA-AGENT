import type { ProductionRuntimeHandle } from "./production/runtime.js";

export const buildProductionRuntimeHandle = (runtime: ProductionRuntimeHandle) => ({
  readProductionTaskStatus: (jobId: string) => runtime.readTask(jobId),
  diagnoseProductionRuntime: (jobId: string) => runtime.diagnose(jobId),
});
