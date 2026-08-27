import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
} from "../runtime-logs/index.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";

export const buildApiBoundaryLogHandle = (assembly: WorkbenchAssembly) => ({
  recordWorkbenchApiBoundaryEvent(input: Parameters<GrassEyeWorkbenchHandle["recordWorkbenchApiBoundaryEvent"]>[0]) {
    const requestId = input.requestId ?? `api-boundary:${Date.now()}`;
    const span = requireRuntimeLogWrite(assembly.runtimeLogger.startSpan({
      traceId: requestId,
      boundaryId: requestId,
      owner: "app-shell",
      component: "api-boundary",
      operation: "api.boundary",
      typedIdentity: {
        kind: "request",
        requestId,
      },
      visibility: "DEBUG",
    }));
    if (input.decision === "allowed") {
      requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
      return;
    }
    requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: new Error(input.reason),
        code: "API_BOUNDARY_DENIED",
        responsibleOwner: "app-shell",
        recovery: RuntimeRecovery.STOP,
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
  },
});
