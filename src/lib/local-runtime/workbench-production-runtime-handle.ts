import type { ProductionRuntimeHandle } from "./production/runtime.js";

export const buildProductionRuntimeHandle = (runtime: ProductionRuntimeHandle) => ({
  readProductionOperationsSnapshot: (jobId?: string) => runtime.readOperationsSnapshot(jobId),
});
