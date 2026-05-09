import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
  VisionPagePreparationPayloadSchema,
} from "../../types/vision-page-preparation.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { parseRuntimeJsonOutput } from "./local-ai-runtime-task-support.js";

type JsonRecord = Record<string, unknown>;
type VisionPagePreparationRequest = Extract<LocalAiTaskRequest, { taskType: "vision.pagePreparation" }>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const normalizeToken = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : null;
};

const READY_ROUTE_TOKEN = normalizeToken(STARTUP_PREPARATION_READY_ROUTE_LABEL);
const BLOCKED_ROUTE_TOKEN = normalizeToken(STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL);

const YES_DECISION_TOKENS = new Set<string>([
  "yes",
  "ready",
  "prepared",
  "pass",
  "passed",
  "proceed",
  "proceedable",
  "ok",
  READY_ROUTE_TOKEN ?? STARTUP_PREPARATION_READY_ROUTE_LABEL,
]);

const NO_DECISION_TOKENS = new Set<string>([
  "no",
  "blocked",
  "not-ready",
  "notready",
  "fail",
  "failed",
  "stop",
  "reject",
  BLOCKED_ROUTE_TOKEN ?? STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
]);

const resolveExplicitRouteLabel = (value: JsonRecord) => {
  const routeToken = normalizeToken(value.routeLabel);
  if (routeToken === READY_ROUTE_TOKEN) {
    return STARTUP_PREPARATION_READY_ROUTE_LABEL;
  }
  if (routeToken === BLOCKED_ROUTE_TOKEN) {
    return STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL;
  }
  return null;
};

const resolveDecision = (value: JsonRecord): "yes" | "no" => {
  const explicitRouteLabel = resolveExplicitRouteLabel(value);
  if (explicitRouteLabel === STARTUP_PREPARATION_READY_ROUTE_LABEL) {
    return "yes";
  }
  if (explicitRouteLabel === STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL) {
    return "no";
  }

  const decisionToken = normalizeToken(value.decision);
  if (decisionToken && YES_DECISION_TOKENS.has(decisionToken)) {
    return "yes";
  }
  if (decisionToken && NO_DECISION_TOKENS.has(decisionToken)) {
    return "no";
  }

  return "no";
};

const resolveRouteLabel = (value: JsonRecord, decision: "yes" | "no") =>
  resolveExplicitRouteLabel(value)
  ?? (decision === "yes" ? STARTUP_PREPARATION_READY_ROUTE_LABEL : STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL);

const resolveSummary = (value: JsonRecord, decision: "yes" | "no") => {
  if (typeof value.nonExecutableSummary === "string" && value.nonExecutableSummary.length > 0) {
    return value.nonExecutableSummary;
  }

  return decision === "yes"
    ? "当前页面准备工作已完成，可以继续产品判断。"
    : "当前页面准备工作未完成，必须 fail-closed。";
};

const resolveConfidence = (value: JsonRecord) => {
  const confidence = value.confidence;
  return typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    ? confidence
    : 0;
};

const resolveReason = (value: JsonRecord, decision: "yes" | "no") => {
  if (typeof value.reason === "string" && value.reason.length > 0) {
    return value.reason;
  }

  return decision === "yes"
    ? "visible page evidence indicates startup preparation is ready for downstream seeding judgment"
    : "visible page evidence indicates startup preparation is blocked or not yet ready";
};

export function parsePagePreparationRuntimeOutput(
  text: string,
  _request: VisionPagePreparationRequest,
): { payload: ReturnType<typeof VisionPagePreparationPayloadSchema.parse> } {
  const raw = parseRuntimeJsonOutput(text, "vision.pagePreparation");
  if (!isRecord(raw)) {
    throw new LocalAiRuntimeError("invalid_output", "Local AI returned non-object JSON for vision.pagePreparation", text);
  }

  const decision = resolveDecision(raw);
  const payload = VisionPagePreparationPayloadSchema.parse({
    taskType: "vision.pagePreparation",
    promptId: "vision.pagePreparation.v1",
    promptVersion: "v1",
    schemaVersion: "vision.pagePreparation.schema.v1",
    decision,
    routeLabel: resolveRouteLabel(raw, decision),
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