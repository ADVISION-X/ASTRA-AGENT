import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import {
  type OpenCapabilityTargetKind,
  type OpenChildCapabilityId,
} from "../contract.js";
import { buildOpenCapabilityResult } from "./open-capability-result.js";

type ExecuteBrowserOpenCapabilityInput = {
  childCapabilityId: OpenChildCapabilityId;
  targetKind: OpenCapabilityTargetKind;
  browserController: BrowserController;
  targetUrl: string;
  targetTitle: string;
  roundId?: string | null;
};

export async function executeBrowserOpenCapability(
  input: ExecuteBrowserOpenCapabilityInput,
): Promise<import("../contract.js").OpenCapabilityResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const initialState = input.browserController.getSessionState();

  try {
    const browserResult = await openBrowserTarget(input);
    return buildSettledOpenCapabilityResult({
      input,
      initialSessionId: initialState.browserProfileRef,
      startedAt,
      startedMs,
      browserResult,
    });
  } catch (error) {
    return buildThrownOpenCapabilityFailure({
      input,
      initialSessionId: initialState.browserProfileRef,
      startedAt,
      startedMs,
      error,
    });
  }
}

function openBrowserTarget(input: ExecuteBrowserOpenCapabilityInput) {
  return input.browserController.open({
    url: input.targetUrl,
    title: input.targetTitle,
  });
}

function buildSettledOpenCapabilityResult(input: {
  input: ExecuteBrowserOpenCapabilityInput;
  initialSessionId: string;
  startedAt: string;
  startedMs: number;
  browserResult: Awaited<ReturnType<BrowserController["open"]>>;
}) {
  const sessionState = input.input.browserController.getSessionState();

  return buildOpenCapabilityResult({
    childCapabilityId: input.input.childCapabilityId,
    targetKind: input.input.targetKind,
    sessionId: sessionState.browserProfileRef || input.initialSessionId,
    roundId: input.input.roundId ?? null,
    startedAt: input.startedAt,
    durationMs: Date.now() - input.startedMs,
    status: input.browserResult.ok ? "success" : "failed",
    targetUrl: input.input.targetUrl,
    openedUrl: sessionState.currentUrl,
    targetTitle: input.input.targetTitle,
    message: input.browserResult.message,
    failureReason: input.browserResult.ok ? null : input.browserResult.message,
    nextCapability: null,
    fallbackUsed: input.browserResult.fallbackUsed,
    loginState: sessionState.loginState,
    reviewRequiredReason: null,
  });
}

function buildThrownOpenCapabilityFailure(input: {
  input: ExecuteBrowserOpenCapabilityInput;
  initialSessionId: string;
  startedAt: string;
  startedMs: number;
  error: unknown;
}) {
  const sessionState = input.input.browserController.getSessionState();
  const message = input.error instanceof Error ? input.error.message : String(input.error);

  return buildOpenCapabilityResult({
    childCapabilityId: input.input.childCapabilityId,
    targetKind: input.input.targetKind,
    sessionId: sessionState.browserProfileRef || input.initialSessionId,
    roundId: input.input.roundId ?? null,
    startedAt: input.startedAt,
    durationMs: Date.now() - input.startedMs,
    status: "failed",
    targetUrl: input.input.targetUrl,
    openedUrl: sessionState.currentUrl,
    targetTitle: input.input.targetTitle,
    message: `open capability failed: ${message}`,
    failureReason: message,
    nextCapability: "mark-review-required",
    fallbackUsed: false,
    loginState: sessionState.loginState,
    reviewRequiredReason: message,
  });
}