import { randomUUID } from "node:crypto";

import type {
  BrowserActionResult,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type { BrowserWireCommand } from "../protocol/generated/browser-protocol.js";
import type { BrowserMutationClass } from "./browser-command-contract.js";
import type {
  BrowserTargetRef,
  ControlledBrowserTarget,
} from "./browser-target-ref.js";

type ReopenRequest = Parameters<BrowserTargetLease["open"]>[0];

export type BrowserTargetLeaseTerminalPort = Readonly<{
  leaseRef: string;
  ownerId: string;
  requireTarget(): ControlledBrowserTarget;
  descriptorFor(target: ControlledBrowserTarget): {
    tabId: number;
    url: string;
    title: string;
  };
  command<T>(
    command: BrowserWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<{ commandId: string; result: T }>;
  releaseRegistry(targetRef: BrowserTargetRef): void;
  closeRegistry(targetRef: BrowserTargetRef): void;
  clearTarget(): void;
  setReleasedTargetRequest(request: ReopenRequest): void;
  action(id: string, message: string, started: number): BrowserActionResult;
  defaultAbortSignal(): AbortSignal | undefined;
}>;

export const releaseBrowserTargetForOperator = async (
  port: BrowserTargetLeaseTerminalPort,
  input: { reason: string },
): Promise<BrowserActionResult> => {
  const started = Date.now();
  const target = port.requireTarget();
  const descriptor = port.descriptorFor(target);
  port.setReleasedTargetRequest({
    url: descriptor.url,
    title: descriptor.title || port.ownerId,
    reusePolicy: "reuse-exact-url",
  });
  try {
    await port.command(
      { kind: "release_target", tabId: descriptor.tabId },
      "idempotent_mutation",
      undefined,
      10_000,
    );
    return port.action(
      `browser-release:${randomUUID()}`,
      input.reason,
      started,
    );
  } finally {
    port.releaseRegistry(target.targetRef);
    port.clearTarget();
  }
};

export const closeBrowserTarget = async (
  port: BrowserTargetLeaseTerminalPort,
  input: Parameters<BrowserTargetLease["closeTarget"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  const target = port.requireTarget();
  const descriptor = port.descriptorFor(target);
  await port.command(
    { kind: "close_target", tabId: descriptor.tabId },
    "non_idempotent_mutation",
    input.abortSignal ?? port.defaultAbortSignal(),
  );
  const result = port.action(
    `browser-close:${randomUUID()}`,
    input.reason,
    started,
  );
  port.closeRegistry(target.targetRef);
  port.clearTarget();
  return result;
};

export const closeBrowserTargetLease = (
  port: BrowserTargetLeaseTerminalPort,
  hasTarget: boolean,
  invalidate: () => void,
): Promise<BrowserActionResult> => {
  if (hasTarget)
    return closeBrowserTarget(port, {
      reason: `closed target lease ${port.leaseRef}`,
    });
  invalidate();
  return Promise.resolve({
    browserActionId: `browser-lease-close:${randomUUID()}`,
    ok: true,
    message: `closed target lease ${port.leaseRef}`,
    createdAt: new Date().toISOString(),
  });
};
