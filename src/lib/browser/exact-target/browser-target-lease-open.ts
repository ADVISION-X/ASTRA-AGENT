import { randomUUID } from "node:crypto";

import type {
  BrowserExecutionBinding,
  BrowserOpenResult,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type {
  BrowserWireCommand,
  BrowserWireTargetDescriptor,
} from "../protocol/generated/browser-protocol.js";
import type { BrowserMutationClass } from "./browser-command-contract.js";
import type { BrowserTargetLeaseManager } from "./browser-target-lease-manager.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";

export type BrowserTargetLeaseOpenPort = {
  executionBinding: BrowserExecutionBinding;
  leaseRef: string;
  ownerId: string;
  manager: BrowserTargetLeaseManager;
  target: ControlledBrowserTarget | null;
  setTarget(target: ControlledBrowserTarget): void;
  clearReleasedTargetRequest(): void;
  forgetTargetForRecovery(): void;
  command<T>(
    command: BrowserWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<{ commandId: string; result: T }>;
  action(id: string, message: string, started: number): BrowserOpenResult;
  defaultAbortSignal(): AbortSignal | undefined;
};

export const openBrowserTarget = async (
  port: BrowserTargetLeaseOpenPort,
  input: Parameters<BrowserTargetLease["open"]>[0],
): Promise<BrowserOpenResult> => {
  const started = Date.now();
  const actionId = input.browserActionId ?? `browser-open:${randomUUID()}`;
  const signal = input.abortSignal ?? port.defaultAbortSignal();
  const reusePolicy = input.reusePolicy ?? "reuse-exact-url";
  const target = port.target;
  const result = target
    ? await navigateExistingTarget(port, target, input.url, signal)
    : await acquireTarget(port, input.url, reusePolicy, signal);
  port.clearReleasedTargetRequest();
  return {
    ...port.action(actionId, `opened ${input.url} on exact target`, started),
    actionKind: "open",
    requestedHost: hostOf(input.url),
    reusePolicy,
    navigationMode: result.navigationMode,
    observedUrlMatchesRequest: sameUrl(input.url, result.descriptor.url),
  };
};

const acquireTarget = async (
  port: BrowserTargetLeaseOpenPort,
  url: string,
  reusePolicy: NonNullable<
    Parameters<BrowserTargetLease["open"]>[0]["reusePolicy"]
  >,
  signal?: AbortSignal,
): Promise<{
  descriptor: BrowserWireTargetDescriptor;
  navigationMode: "acquired_exact_target";
}> => {
  const descriptor = (
    await port.manager.commands.command<BrowserWireTargetDescriptor>({
      executionBinding: port.executionBinding,
      targetLeaseRef: port.leaseRef,
      documentRef: "browser-document:unbound",
      command: {
        kind: "acquire_target",
        url,
        reusePolicy,
        excludedTabIds: port.manager.registry.occupiedTabIds(),
      },
      mutationClass: "idempotent_mutation",
      timeoutMs: 30_000,
      ...(signal ? { abortSignal: signal } : {}),
    })
  ).result;
  port.setTarget(
    port.manager.registry.register(
      port.ownerId,
      descriptor,
      new URL(url).origin,
    ),
  );
  return { descriptor, navigationMode: "acquired_exact_target" };
};

const navigateExistingTarget = async (
  port: BrowserTargetLeaseOpenPort,
  target: ControlledBrowserTarget,
  url: string,
  signal?: AbortSignal,
): Promise<{
  descriptor: BrowserWireTargetDescriptor;
  navigationMode: "acquired_exact_target" | "navigated_exact_target";
}> => {
  const entry = port.manager.registry.resolve(
    target.targetRef,
    target.documentRef,
  );
  port.manager.registry.assertNavigationOrigin(target.targetRef, url);
  try {
    const descriptor = (
      await port.command<BrowserWireTargetDescriptor>(
        { kind: "navigate_target", tabId: entry.descriptor.tabId, url },
        "idempotent_mutation",
        signal,
        30_000,
      )
    ).result;
    port.setTarget(
      port.manager.registry.updateDocument(target.targetRef, descriptor),
    );
    return { descriptor, navigationMode: "navigated_exact_target" };
  } catch (error) {
    if (!isRecoverable(error)) throw error;
    port.forgetTargetForRecovery();
    return acquireTarget(port, url, "reuse-exact-url", signal);
  }
};

const hostOf = (value: string): string => {
  try {
    return new URL(value).host || "local";
  } catch {
    return "unknown";
  }
};

const sameUrl = (first: string, second: string): boolean => {
  try {
    const left = new URL(first);
    const right = new URL(second);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    return first === second;
  }
};

const isRecoverable = (error: unknown): boolean =>
  /(?:DEVTOOLS_ATTACHMENT_CONFLICT|TARGET_NOT_FOUND).*No tab with given id/iu.test(
    error instanceof Error ? error.message : String(error),
  );
