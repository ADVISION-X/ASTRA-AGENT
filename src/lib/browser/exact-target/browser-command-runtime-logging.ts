import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogger,
  type RuntimeSpanHandle,
  type RuntimeSpanTerminalEvent,
} from "../../runtime-logs/index.js";
import type {
  RuntimeBrowserCommandIdentity,
} from "../../runtime-logs/schema.js";
import type { BrowserMutationIdentity } from "./browser-mutation-store.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";

const identityFor = (permit: BrowserCommandPermit): RuntimeBrowserCommandIdentity => ({
  kind: "browser-command",
  jobId: permit.jobId,
  attemptId: permit.attemptId,
  leaseVersion: permit.leaseVersion,
  fenceHash: permit.writerFenceHash,
  pluginId: permit.ownerPluginId,
  commandId: permit.commandId,
  capabilityCallId: permit.capabilityId,
  pluginStepId: permit.pluginStepId,
  childCapabilityId: permit.childCapabilityId,
  actionOrdinal: permit.actionOrdinal,
});

export const startBrowserCommandSpan = (
  runtimeLogger: RuntimeLogger,
  permit: BrowserCommandPermit,
): RuntimeSpanHandle => requireRuntimeLogWrite(runtimeLogger.startSpan({
  traceId: permit.jobId,
  spanId: `${permit.commandId}:${permit.sequence}`,
  boundaryId: permit.permitRef,
  owner: "browser-session",
  component: "exact-target",
  operation: "browser.command",
  typedIdentity: identityFor(permit),
  visibility: "TRACE",
}));

export const emitBrowserMutationState = (input: Readonly<{
  runtimeLogger: RuntimeLogger;
  mutation: BrowserCommandPermit | BrowserMutationIdentity;
  previous: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED" | null;
  current: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED";
  authorityHash: `sha256:${string}`;
  reconciledFromAuthority?: boolean;
}>): void => {
  requireRuntimeLogWrite(input.runtimeLogger.emitState({
    traceId: input.mutation.jobId,
    owner: "browser-session",
    component: "browser-mutation-wal",
    stateKey: "browser.mutation",
    previous: input.previous,
    current: input.current,
    authorityRef: `browser-mutation:${input.mutation.commandId}`,
    authorityHash: input.authorityHash,
    ...(input.reconciledFromAuthority === undefined ? {} : {
      reconciledFromAuthority: input.reconciledFromAuthority,
    }),
    visibility: "TRACE",
  }));
};

export const completeBrowserCommandSpan = (input: Readonly<{
  span: RuntimeSpanHandle;
}>): void => {
  requireRuntimeLogWrite(input.span.terminal({ outcome: "success" }));
};

export const failBrowserCommandSpan = (input: Readonly<{
  span: RuntimeSpanHandle;
  permit: Pick<BrowserCommandPermit, "commandId" | "jobId" | "mutationClass">;
  failureCode: string;
  pendingReceipt: boolean;
  proofHash: `sha256:${string}`;
}>): RuntimeSpanTerminalEvent =>
  requireRuntimeLogWrite(input.span.terminal({
    outcome: input.pendingReceipt ? "review_required" : "failed",
    ...(input.permit.mutationClass === "mutation" ? {
      authorityRef: `browser-mutation:${input.permit.commandId}`,
      authorityHash: input.proofHash,
    } : {}),
    failure: runtimeFailureFromError({
      error: new Error(input.failureCode),
      code: input.failureCode,
      responsibleOwner: "browser-session",
      recovery: input.pendingReceipt ? RuntimeRecovery.REVIEW : RuntimeRecovery.STOP,
      impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
