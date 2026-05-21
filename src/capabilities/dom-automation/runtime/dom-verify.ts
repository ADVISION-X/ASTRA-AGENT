import { createId } from "../../../lib/local-runtime/ids.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomVerificationResult } from "../../../types/dom-automation.js";
import type { VerifyDomStateInput } from "../../../types/dom-automation-inputs.js";

const STATE_MAP = {
  "file-selected": "file_selected",
  "success-message": "success_message",
  "error-message": "error_message",
  "login-required": "login_required",
  "captcha-or-2fa-required": "captcha_or_2fa_required",
} as const;

type VerificationSignals = {
  detected: Set<string>;
  successHintMatched: boolean;
  failureHintMatched: boolean;
  strongDetected: boolean;
};

function snapshotText(input: VerifyDomStateInput): string {
  const parts = [
    input.snapshot.title,
    ...input.snapshot.inputs.map((item) => [item.labelText, item.placeholder, item.name, item.id, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.buttons.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.links.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.dialogs.map((item) => [item.ariaLabel, item.visibleText].filter(Boolean).join(" ")),
    ...input.snapshot.tableRows.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.roleRows.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.genericClickableElements.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.dropdownTriggers.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.overlays.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
    ...input.snapshot.textBlocks.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
  ];
  return parts.join(" ").toLowerCase();
}

function buildDomVerificationResult(
  status: DomVerificationResult["status"],
  confidence: number,
  reason: string,
): DomVerificationResult {
  return DOM_SCHEMAS.DomVerificationResult.parse({
    status,
    confidence,
    evidenceRef: `dom-verify:${createId("dom")}`,
    reason,
  });
}

function resolveDetectedVerificationResult(detected: Set<string>): DomVerificationResult | null {
  if (detected.has("login_required")) {
    return buildDomVerificationResult("login_required", 0.9, "DOM snapshot detected login-required state.");
  }
  if (detected.has("captcha_or_2fa_required")) {
    return buildDomVerificationResult("captcha_or_2fa_required", 0.9, "DOM snapshot detected captcha or 2FA state.");
  }
  return null;
}

function hasStrongDetectedState(input: VerifyDomStateInput, detected: Set<string>): boolean {
  return input.expectedStates.some((state) => {
      const detectedState = STATE_MAP[state];
    return detectedState === "file_selected" || detectedState === "success_message" || detectedState === "error_message"
      ? detected.has(detectedState)
      : false;
  });
}

function needsUploadReview(input: VerifyDomStateInput, detected: Set<string>): boolean {
  return input.expectedStates.includes("success-message")
    && detected.has("file_selected")
    && !detected.has("success_message");
}

function collectVerificationSignals(input: VerifyDomStateInput): VerificationSignals {
  const detected = new Set(input.snapshot.detectedStates);
  const text = snapshotText(input);
  const successHints = input.successHints ?? [];
  const failureHints = input.failureHints ?? [];
  return {
    detected,
    successHintMatched: successHints.some((hint) => text.includes(hint.toLowerCase())),
    failureHintMatched: failureHints.some((hint) => text.includes(hint.toLowerCase())),
    strongDetected: hasStrongDetectedState(input, detected),
  };
}

function resolveSignalVerificationResult(
  input: VerifyDomStateInput,
  signals: VerificationSignals,
): DomVerificationResult {
  if (signals.successHintMatched && signals.failureHintMatched) {
    return buildDomVerificationResult("ambiguous", 0.6, "DOM snapshot matched both success and failure hints.");
  }
  if (needsUploadReview(input, signals.detected)) {
    return buildDomVerificationResult(
      "review_required",
      0.7,
      "DOM snapshot shows a selected file but cannot confirm the expected final state.",
    );
  }
  if (signals.failureHintMatched) {
    return buildDomVerificationResult("failed", 0.75, "DOM snapshot matched failure hints.");
  }
  if (signals.strongDetected || signals.successHintMatched) {
    return buildDomVerificationResult(
      "success",
      signals.strongDetected ? 0.8 : 0.65,
      "DOM snapshot matched expected state.",
    );
  }
  return buildDomVerificationResult("not_found", 0.55, "DOM snapshot did not match expected state.");
}

export function verifyDomStateOnce(rawInput: VerifyDomStateInput): DomVerificationResult {
  const input = DOM_SCHEMAS.VerifyDomStateInput.parse(rawInput) as VerifyDomStateInput;
  const signals = collectVerificationSignals(input);
  const detectedResult = resolveDetectedVerificationResult(signals.detected);
  return detectedResult ?? resolveSignalVerificationResult(input, signals);
}
