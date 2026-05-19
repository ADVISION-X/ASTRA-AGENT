import { createId } from "../../../lib/local-runtime/ids.js";
import { DomVerificationResultSchema, VerifyDomStateInputSchema } from "../schema.js";
import type { DomVerificationResult, VerifyDomStateInput } from "../schema.js";

const STATE_MAP = {
  "order-found": "order_found",
  "invoice-upload-entry-visible": "upload_entry_visible",
  "file-attached": "file_attached",
  "upload-success": "upload_success",
  "login-required": "login_required",
  "captcha-or-2fa-required": "captcha_or_2fa_required",
} as const;

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
    ...input.snapshot.textBlocks.map((item) => [item.ariaLabel, item.visibleText, item.nearbyText].filter(Boolean).join(" ")),
  ];
  return parts.join(" ").toLowerCase();
}

export function verifyDomStateOnce(rawInput: VerifyDomStateInput): DomVerificationResult {
  const input = VerifyDomStateInputSchema.parse(rawInput);
  const detected = new Set(input.snapshot.detectedStates);
  if (detected.has("login_required")) {
    return DomVerificationResultSchema.parse({
      status: "login_required",
      confidence: 0.9,
      evidenceRef: `dom-verify:${createId("dom")}`,
      reason: "DOM snapshot detected login-required state.",
    });
  }
  if (detected.has("captcha_or_2fa_required")) {
    return DomVerificationResultSchema.parse({
      status: "captcha_or_2fa_required",
      confidence: 0.9,
      evidenceRef: `dom-verify:${createId("dom")}`,
      reason: "DOM snapshot detected captcha or 2FA state.",
    });
  }

  const text = snapshotText(input);
  const successHintMatched = input.successHints.some((hint) => text.includes(hint.toLowerCase()));
  const failureHintMatched = input.failureHints.some((hint) => text.includes(hint.toLowerCase()));
  const strongDetected = input.expectedStates.some((state) => {
    const detectedState = STATE_MAP[state];
    return detectedState === "file_attached" || detectedState === "upload_success"
      ? detected.has(detectedState)
      : false;
  });
  if (failureHintMatched) {
    return DomVerificationResultSchema.parse({
      status: "failed",
      confidence: 0.75,
      evidenceRef: `dom-verify:${createId("dom")}`,
      reason: "DOM snapshot matched failure hints.",
    });
  }
  if (strongDetected || successHintMatched) {
    return DomVerificationResultSchema.parse({
      status: "success",
      confidence: strongDetected ? 0.8 : 0.65,
      evidenceRef: `dom-verify:${createId("dom")}`,
      reason: "DOM snapshot matched expected state.",
    });
  }
  return DomVerificationResultSchema.parse({
    status: "not_found",
    confidence: 0.55,
    evidenceRef: `dom-verify:${createId("dom")}`,
    reason: "DOM snapshot did not match expected state.",
  });
}
