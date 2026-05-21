import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  amazonDomTraceRefFromIds,
  buildAmazonDomTraceBaseEvent,
  resolveAmazonDomRuntimeStatus,
  type AmazonDomStepTraceContext,
} from "./amazon-dom-step-trace-support.js";

export { amazonDomTraceRefFromIds };

export function recordAmazonDomStepTrace(input: {
  runtimeLogger: RuntimeLogger;
} & AmazonDomStepTraceContext): void {
  const baseEvent = buildAmazonDomTraceBaseEvent(input);
  input.runtimeLogger.emit({
    ...baseEvent,
    eventType: RuntimeLogEventType.DOM_AUTOMATION_STEP_STARTED,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    status: "started",
    reason: input.stepName,
  });
  input.runtimeLogger.emit({
    ...baseEvent,
    eventType: input.status === "success" || input.status === "snapshot"
      ? RuntimeLogEventType.DOM_AUTOMATION_STEP_COMPLETED
      : RuntimeLogEventType.DOM_AUTOMATION_STEP_FAILED,
    level: input.status === "success" || input.status === "snapshot" ? "info" : "warn",
    modeVisibility: input.status === "success" || input.status === "snapshot" ? ["DEBUG", "TRACE"] : ["FLOW", "DEBUG", "TRACE"],
    status: resolveAmazonDomRuntimeStatus(input.status),
    reason: input.reason?.replace(/\s+/g, " ").trim().slice(0, 140) || input.stepName,
  });
}
