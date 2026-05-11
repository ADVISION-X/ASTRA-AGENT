// Runtime Log Spine — Schema
// RuntimeLogEvent is the single unified structured event contract.
// Every log emitted by any module must conform to this type.

import type { RuntimeLogEventType } from "./event-types.js";

// Known owner identifiers — extend here, not in module files
export type RuntimeLogOwner =
  | "orchestration"
  | "ai-capability"
  | "local-ai"
  | "screenshot-capability"
  | "visual-target-capability"
  | "geometry-guard-capability"
  | "mouse-click-capability"
  | "mouse-scroll-capability"
  | "text-input-capability"
  | "open-capability"
  | "forensics-persistence"
  | "nerve-bus-capability"
  | "commander-console"
  | "runtime-logs"
  | "app-shell"
  | "browser-session"
  | "local-runtime"
  | "startup-entrypoint"
  | "unknown";

export type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

export type RuntimeLogMode = "FLOW" | "DEBUG" | "TRACE";

export type RuntimeLogEvent = {
  // Identity
  eventId: string;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;

  // Classification
  level: RuntimeLogLevel;
  modeVisibility: RuntimeLogMode[];
  eventType: RuntimeLogEventType;
  owner: RuntimeLogOwner;
  ownerResponsible?: RuntimeLogOwner;

  // Context links
  missionId?: string;
  runId?: string;
  sessionId?: string;
  roundId?: string;
  stepId?: string;
  capabilityCallId?: string;
  nerveBusEnvelopeId?: string;
  platformId?: string;
  abilityGroupId?: string;
  childCapabilityId?: string;

  // Result
  status?: "started" | "success" | "failed" | "review_required" | "skipped";
  reason?: string;
  actionableMessage?: string;

  // Proof attachments — no secrets, no base64 images in these
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  hashes?: Record<string, string>;
  preview?: Record<string, string>;
  payload?: Record<string, unknown>;

  // Timing
  createdAt: string;
  durationMs?: number;
};

// Minimal input helper for creating events; eventId/createdAt injected by logger
export type RuntimeLogEventInput = Omit<RuntimeLogEvent, "eventId" | "createdAt">;
