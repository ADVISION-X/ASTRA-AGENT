import type { WorkbenchRuntime } from "./workbench-contract.js";

export const createRuntimeProofReadModel = (runtime: WorkbenchRuntime) => ({
  listRuntimeProofEntries: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).structuredRuntimeEvents.slice(-limit).reverse().map((event) => ({ id: event.eventId, createdAt: event.createdAt, step: event.step, status: event.status, message: event.failureReason ?? event.reviewRequiredReason ?? event.reason ?? event.eventType })),
});