export const RuntimeFailureKind = {
  TRANSPORT: "transport", AUTHENTICATION: "authentication", CONTRACT: "contract", ADMISSION: "admission",
  DEPENDENCY: "dependency", STORAGE: "storage", BROWSER: "browser", PROVIDER: "provider", INTERNAL: "internal",
} as const;

export const RuntimeRecovery = {
  RETRY: "retry", BACKOFF: "backoff", DRAIN: "drain", REVIEW: "review", STOP: "stop", NONE: "none",
} as const;

export const RuntimeFailureImpact = {
  BLOCKING: "BLOCKING", CONSEQUENTIAL: "CONSEQUENTIAL", CLEANUP: "CLEANUP",
} as const;

export type RuntimeFailureKind = (typeof RuntimeFailureKind)[keyof typeof RuntimeFailureKind];
export type RuntimeRecovery = (typeof RuntimeRecovery)[keyof typeof RuntimeRecovery];
export type RuntimeFailureImpact = (typeof RuntimeFailureImpact)[keyof typeof RuntimeFailureImpact];
export type RuntimeLogOwner = "website" | "startup-entrypoint" | "app-shell" | "production-runtime"
  | "mediator" | "product-plugin" | "gpt" | "browser-session" | "forensics-persistence" | "runtime-logs" | "outbox";
export type RuntimeLogVisibility = "FLOW" | "DEBUG" | "TRACE";
export type RuntimeSpanOutcome = "success" | "failed" | "review_required" | "skipped";

export type RuntimeOperation = "api.boundary" | "browser.command" | "browser.infrastructure" | "cloud.claim"
  | "cloud.session-open" | "forensics.append-artifact" | "forensics.append-record" | "gpt.child"
  | "job.durable-accept" | "job.execute" | "job.checkpoint" | "job.lease-release" | "job.lease-renew"
  | "job.terminal" | "material.download-verify" | "mediator.dispatch" | "outbox.flush" | "plugin.execute"
  | "result.upload" | "runtime.shutdown" | "runtime.start" | "startup.step" | "website.first-terminal"
  | "website.outbox" | "website.result-consume" | "website.task-create" | "website.v6-request";

export type RuntimeFailure = Readonly<{
  kind: RuntimeFailureKind;
  code: string;
  responsibleOwner: RuntimeLogOwner;
  impact: RuntimeFailureImpact;
  recovery: RuntimeRecovery;
  nativeCause?: string;
  causedByEventId?: string;
  httpStatus?: number;
}>;
