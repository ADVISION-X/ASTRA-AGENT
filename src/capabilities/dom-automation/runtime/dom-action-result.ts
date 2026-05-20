import { createId } from "../../../lib/local-runtime/ids.js";
import { DomActionResultSchema } from "../schema.js";
import type { DomActionResult } from "../schema.js";

type DomActionResultDraft = Omit<DomActionResult, "actionId">;

type DomActionResultExtras = Partial<Pick<
  DomActionResultDraft,
  "beforeEvidenceRef" | "afterEvidenceRef" | "reviewRequiredReason"
>>;

type BrowserDomActionOutcome = {
  status: DomActionResult["status"];
  message: string;
};

export function buildDomActionResult(input: DomActionResultDraft): DomActionResult {
  return DomActionResultSchema.parse({
    actionId: createId("dom"),
    ...input,
  });
}

export function buildDomReviewRequiredResult(
  message: string,
  reviewRequiredReason: string,
  extra: DomActionResultExtras = {},
): DomActionResult {
  return buildDomActionResult({
    ok: false,
    status: "review_required",
    message,
    reviewRequiredReason,
    ...extra,
  });
}

export function buildDomFailureResult(
  message: string,
  extra: DomActionResultExtras = {},
): DomActionResult {
  return buildDomActionResult({
    ok: false,
    status: "failed",
    message,
    ...extra,
  });
}

export function buildDomActionOutcome(
  result: BrowserDomActionOutcome,
  beforeEvidenceRef: string,
  afterEvidenceRef: string,
): DomActionResult {
  const ok = result.status === "success";
  return buildDomActionResult({
    ok,
    status: ok ? "success" : result.status,
    message: result.message,
    beforeEvidenceRef,
    afterEvidenceRef,
    ...(ok ? {} : { reviewRequiredReason: result.message }),
  });
}
