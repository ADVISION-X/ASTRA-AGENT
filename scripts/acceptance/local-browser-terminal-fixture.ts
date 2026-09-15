import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { BrowserCommandActor } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { hash } from "./local-browser-mutation-store-support.js";

export const createBrowserActorFactory = (
  store: BrowserMutationStore,
  logger: ConstructorParameters<typeof BrowserCommandActor>[4],
) => (send: ConstructorParameters<typeof BrowserCommandActor>[1]["send"]): BrowserCommandActor =>
  new BrowserCommandActor(
    new BrowserCommandAdmissionBudget(),
    { send },
    store,
    { assertCurrentAuthority: () => {} },
    logger,
  );

export const permitAuthority = (commandId: string) => ({
  permitRef: `permit:${commandId}`,
  authorityRef: "authority-1",
  authorityEpoch: 1,
  certificateHash: hash,
  channelSessionHash: hash,
  executionBindingHash: hash,
  writerFenceHash: hash,
  candidateHash: hash,
  contractManifestHash: hash,
});

export const permitExecution = (commandId: string) => ({
  jobId: `job:${commandId}`, resultRevision: 0,
  attemptId: "attempt-actor", deviceId: "device-1", leaseVersion: 1,
  localOrderId: `order:${commandId}`, targetLeaseRef: "lease-1", targetRef: "target-1",
  documentRef: "document-1", productStepId: "report_translation:candidate_a",
  childCapabilityId: "open_gpt_model_selector_v2", callId: "gpt-turn-flow.v3", inputHash: hash,
  replayPolicy: "target-local-per-generation" as const, actionOrdinal: 1,
  capabilityId: "browser.dom.click.v1" as const, commandId, sequence: 1,
  mutationClass: "mutation" as const, workspaceRef: "workspace-1", commandTtlMs: 10_000,
  replyChannelToken: `reply:${commandId}`, commandFrameMac: hash,
});

export const permit = (commandId: string): BrowserCommandPermit => ({
  ...permitAuthority(commandId), ...permitExecution(commandId),
});

export const createClickCommand = () => ({
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickAttribute: { name: "aria-expanded" as const, equals: "true" as const, timeoutMs: 1_500 },
  },
});

export const createMatchClickCommand = () => ({
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickMatch: { selector: "[aria-hidden='true']", expectedMatches: 1 },
  },
});
