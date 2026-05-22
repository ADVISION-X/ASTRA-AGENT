import type { RuntimeLogEventType } from "./event-types.js";

type RuntimeLogOwner =
  | "ai-input-gateway"
  | "forensics-persistence"
  | "runtime-logs"
  | "app-shell"
  | "browser-session"
  | "local-runtime"
  | "startup-entrypoint"
  | "amazon-invoice-upload"
  | "facebook-product-video-mining"
  | "dom-automation"
  | "unknown";

type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

export type RuntimeLogMode = "FLOW" | "DEBUG" | "TRACE";

export type RuntimeLogEvent = {
  eventId: string;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  level: RuntimeLogLevel;
  modeVisibility: RuntimeLogMode[];
  eventType: RuntimeLogEventType;
  owner: RuntimeLogOwner;
  ownerResponsible?: RuntimeLogOwner;
  missionId?: string;
  runId?: string;
  sessionId?: string;
  roundId?: string;
  stepId?: string;
  capabilityCallId?: string;
  platformId?: string;
  abilityGroupId?: string;
  childCapabilityId?: string;
  status?: "started" | "success" | "failed" | "review_required" | "skipped";
  reason?: string;
  actionableMessage?: string;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  hashes?: Record<string, string>;
  preview?: Record<string, string>;
  payload?: Record<string, unknown>;
  createdAt: string;
  durationMs?: number;
};

export type RuntimeLogEventInput = Omit<RuntimeLogEvent, "eventId" | "createdAt">;