import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  NEXT_ITEM_ADVANCED_ROUTE_LABEL,
  NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL,
  VisionNextItemAdvancedPayloadSchema,
} from "../../types/vision-next-item-advanced.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { parseRuntimeJsonOutput } from "./local-ai-runtime-task-support.js";

type JsonRecord = Record<string, unknown>;
type VisionNextItemAdvancedRequest = Extract<LocalAiTaskRequest, { taskType: "vision.nextItemAdvanced" }>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const resolveDecision = (value: JsonRecord): "yes" | "no" => value.decision === "yes" ? "yes" : "no";
const resolveRouteLabel = (decision: "yes" | "no") =>
  decision === "yes" ? NEXT_ITEM_ADVANCED_ROUTE_LABEL : NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL;
const resolveSummary = (value: JsonRecord, decision: "yes" | "no") => {
  if (typeof value.nonExecutableSummary === "string" && value.nonExecutableSummary.length > 0) {
    return value.nonExecutableSummary;
  }
  return decision === "yes"
    ? "当前证据表明已推进到下一条视频，可以进入下一轮捕获。"
    : "当前证据未证明已经推进到下一条视频，必须 fail-closed。";
};
const resolveConfidence = (value: JsonRecord) => {
  const confidence = value.confidence;
  return typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0;
};
const resolveReason = (value: JsonRecord, decision: "yes" | "no") => {
  if (typeof value.reason === "string" && value.reason.length > 0) {
    return value.reason;
  }
  return decision === "yes"
    ? "visible post-click viewport evidence indicates the feed advanced to a new item"
    : "visible post-click viewport evidence does not safely prove advancement to a new item";
};

export function parseNextItemAdvancedRuntimeOutput(
  text: string,
  _request: VisionNextItemAdvancedRequest,
): { payload: ReturnType<typeof VisionNextItemAdvancedPayloadSchema.parse> } {
  const raw = parseRuntimeJsonOutput(text, "vision.nextItemAdvanced");
  if (!isRecord(raw)) {
    throw new LocalAiRuntimeError("invalid_output", "Local AI returned non-object JSON for vision.nextItemAdvanced", text);
  }

  const decision = resolveDecision(raw);
  const payload = VisionNextItemAdvancedPayloadSchema.parse({
    taskType: "vision.nextItemAdvanced",
    promptId: "vision.nextItemAdvanced.v1",
    promptVersion: "v1",
    schemaVersion: "vision.nextItemAdvanced.schema.v1",
    decision,
    routeLabel: resolveRouteLabel(decision),
    nonExecutableSummary: resolveSummary(raw, decision),
    confidence: resolveConfidence(raw),
    reason: resolveReason(raw, decision),
    evidenceObservations: toStringArray(raw.evidenceObservations),
    readinessSignals: toStringArray(raw.readinessSignals),
    blockingSignals: toStringArray(raw.blockingSignals),
    mustReview: false,
  });

  return { payload };
}