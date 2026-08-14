import { randomUUID } from "node:crypto";

import { BrowserTerminalError } from "./browser-command-contract.js";
import type { BrowserDocumentRef, BrowserTargetRef } from "./browser-target-ref.js";

export type PhysicalFocusReason = "native_file_picker" | "os_pointer_action" | "os_keyboard_action";

const createFocusMonitor = (
  controller: AbortController,
  verifyFocus: (abortSignal: AbortSignal) => Promise<boolean>,
) => {
  const signal = controller.signal;
  let active = false;
  return {
    start: (): void => { active = true; },
    stop: (): void => { active = false; },
    async run(): Promise<never> {
      for (;;) {
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
        if (!active) return await new Promise<never>(() => undefined);
        if (signal.aborted) throw signal.reason;
        let focused = false;
        try { focused = await verifyFocus(signal); } catch { focused = false; }
        if (!active) return await new Promise<never>(() => undefined);
        if (!focused) {
          const error = new BrowserTerminalError(
            "OPERATOR_INTERRUPTED",
            "operator changed focus during the approved physical action; automatic reacquire is forbidden",
          );
          controller.abort(error);
          throw error;
        }
      }
    },
  };
};

export class PhysicalFocusLease {
  private active = false;

  async run<T>(input: {
    reason: PhysicalFocusReason;
    targetRef: BrowserTargetRef;
    documentRef: BrowserDocumentRef;
    focus: (abortSignal: AbortSignal) => Promise<void>;
    verifyFocus?: (abortSignal: AbortSignal) => Promise<boolean>;
    action: (abortSignal: AbortSignal) => Promise<T>;
    abortSignal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<{ focusLeaseId: string; startedAtMs: number; value: T }> {
    if (this.active) throw new BrowserTerminalError("FOCUS_LEASE_DENIED", "another physical focus lease is active");
    if (input.abortSignal?.aborted) throw new BrowserTerminalError("OPERATOR_INTERRUPTED", "focus lease was cancelled before acquisition");
    this.active = true;
    const focusLeaseId = `focus_${randomUUID().replaceAll("-", "")}`;
    const startedAtMs = Date.now();
    const timeoutMs = Math.min(input.timeoutMs ?? 15_000, 15_000);
    const leaseAbort = new AbortController();
    const forwardAbort = (): void => leaseAbort.abort(
      input.abortSignal?.reason ?? new BrowserTerminalError(
        "OPERATOR_INTERRUPTED",
        "operator interrupted the physical focus lease",
      ),
    );
    input.abortSignal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => leaseAbort.abort(
      new BrowserTerminalError(
        "OPERATOR_INTERRUPTED",
        `physical focus lease exceeded ${timeoutMs}ms; automatic reacquire is forbidden`,
      ),
    ), timeoutMs);
    const monitor = input.verifyFocus
      ? createFocusMonitor(leaseAbort, input.verifyFocus)
      : null;
    try {
      await input.focus(leaseAbort.signal);
      if (input.verifyFocus && !await input.verifyFocus(leaseAbort.signal)) {
        throw new BrowserTerminalError("OPERATOR_INTERRUPTED", "operator changed focus before the approved physical action");
      }
      monitor?.start();
      const value = await (input.verifyFocus
        ? Promise.race([input.action(leaseAbort.signal), monitor!.run()])
        : input.action(leaseAbort.signal));
      monitor?.stop();
      if (input.verifyFocus && !await input.verifyFocus(leaseAbort.signal)) {
        throw new BrowserTerminalError("OPERATOR_INTERRUPTED", "operator changed focus during the approved physical action; automatic reacquire is forbidden");
      }
      if (leaseAbort.signal.aborted) {
        throw leaseAbort.signal.reason instanceof Error
          ? leaseAbort.signal.reason
          : new BrowserTerminalError(
            "OPERATOR_INTERRUPTED",
            "physical focus lease was interrupted",
          );
      }
      return { focusLeaseId, startedAtMs, value };
    } catch (error) {
      if (leaseAbort.signal.aborted && leaseAbort.signal.reason instanceof Error) {
        throw leaseAbort.signal.reason;
      }
      throw error;
    } finally {
      monitor?.stop();
      clearTimeout(timeout);
      input.abortSignal?.removeEventListener("abort", forwardAbort);
      this.active = false;
    }
  }
}
