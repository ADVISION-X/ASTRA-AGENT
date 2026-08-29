import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogger,
  type RuntimeSpanHandle,
  type RuntimeSpanTerminalEvent,
} from "../../runtime-logs/index.js";
import type {
  RuntimeBrowserCommandIdentity,
} from "../../runtime-logs/runtime-identity-contract.js";
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
  pluginStepId: permit.productStepId,
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

export const emitBrowserMutationEvent = (input: Readonly<{
  runtimeLogger: RuntimeLogger;
  mutation: BrowserCommandPermit | BrowserMutationIdentity;
  outcome: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED";
  authorityHash: `sha256:${string}`;
}>): void => {
  const mutation = input.mutation;
  requireRuntimeLogWrite(input.runtimeLogger.emitEvent({
    traceId: input.mutation.jobId,
    owner: "browser-session",
    component: "browser-mutation-wal",
    operation: "browser.command",
    code: `BROWSER_MUTATION_${input.outcome}`,
    typedIdentity: "writerFenceHash" in mutation ? identityFor(mutation) : {
      kind: "browser-command",
      jobId: mutation.jobId,
      attemptId: mutation.attemptId,
      leaseVersion: mutation.leaseVersion,
      fenceHash: mutation.executionFenceHash,
      pluginId: mutation.ownerPluginId,
      commandId: mutation.commandId,
      pluginStepId: mutation.productStepId,
      childCapabilityId: mutation.childCapabilityId,
      actionOrdinal: mutation.actionOrdinal,
    },
    authorityRef: `browser-mutation:${input.mutation.commandId}`,
    authorityHash: input.authorityHash,
    visibility: "TRACE",
  }));
};

export const completeBrowserCommandSpan = (input: Readonly<{
  span: RuntimeSpanHandle;
}>): void => {
  requireRuntimeLogWrite(input.span.terminal({ outcome: "succeeded" }));
};

export const failBrowserCommandSpan = (input: Readonly<{
  span: RuntimeSpanHandle;
  permit: Pick<BrowserCommandPermit, "commandId" | "jobId" | "mutationClass">;
  failureCode: string;
  pendingReceipt: boolean;
  proofHash: `sha256:${string}`;
}>): RuntimeSpanTerminalEvent =>
  requireRuntimeLogWrite(input.span.terminal({
    outcome: "failed",
    ...(input.permit.mutationClass === "mutation" ? {
      authorityRef: `browser-mutation:${input.permit.commandId}`,
      authorityHash: input.proofHash,
    } : {}),
    failure: runtimeFailureFromError({
      error: new Error(input.failureCode),
      code: input.failureCode,
      responsibleOwner: "browser-session",
      impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
