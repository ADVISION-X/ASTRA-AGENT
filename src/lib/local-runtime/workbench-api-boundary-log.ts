import { randomUUID } from "node:crypto";

import {
  createRuntimeEvent,
  RuntimeLogEventType,
} from "../runtime-logs/index.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";

export const buildApiBoundaryLogHandle = (assembly: WorkbenchAssembly) => ({
  recordWorkbenchApiBoundaryEvent(input: Parameters<GrassEyeWorkbenchHandle["recordWorkbenchApiBoundaryEvent"]>[0]) {
    assembly.runtimeLogger.emit(createRuntimeEvent({
      context: {
        traceId: input.requestId ?? `api-boundary:${Date.now()}`,
        spanId: randomUUID(),
        owner: "local-runtime",
      },
      eventType: RuntimeLogEventType.API_BOUNDARY,
      level: input.decision === "allowed" ? "info" : "warn",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status: input.decision === "allowed" ? "success" : "failed",
      reason: input.reason,
      payload: {
        eventType: "api_boundary",
        decision: input.decision,
        reason: input.reason,
        method: input.method,
        path: input.path,
        originCategory: input.originCategory,
        sourceSystem: input.sourceSystem,
        requestId: input.requestId,
        jobOwner: input.jobOwner,
        routePurpose: input.routePurpose,
        authenticated: input.authenticated,
      },
    }));
  },
});
