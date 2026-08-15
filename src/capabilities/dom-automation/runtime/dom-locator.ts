import { createHash } from "node:crypto";

import { DOM_SCHEMAS } from "../schema.js";
import type { DomElementRef, DomLocateResult } from "../../../types/dom-automation.js";
import type { LocateDomElementInput } from "../../../types/dom-automation-inputs.js";
import {
  candidateContainsText,
  candidatesFor,
  scoreCandidate,
  type ScoredDomLocatorCandidate,
} from "./dom-locator-candidates.js";

function buildElementRef(input: LocateDomElementInput, scored: ScoredDomLocatorCandidate): DomElementRef {
  const hash = createHash("sha256")
    .update(`${input.targetKind}:${scored.candidate.selectorCandidate}:${scored.matchedSignals.join("|")}`)
    .digest("hex")
    .slice(0, 16);
  return DOM_SCHEMAS.DomElementRef.parse({
    targetRef: input.snapshot.targetRef,
    documentRef: input.snapshot.documentRef,
    elementRef: `dom:${hash}`,
    selector: scored.candidate.selectorCandidate,
    identity: {
      tagName: scored.candidate.tagName,
      ...(scored.candidate.type ? { type: scored.candidate.type } : {}),
      ...(scored.candidate.role ? { role: scored.candidate.role } : {}),
      ...(scored.candidate.ariaLabel ? { ariaLabel: scored.candidate.ariaLabel } : {}),
      ...(scored.candidate.labelText ? { labelText: scored.candidate.labelText } : {}),
      ...(scored.candidate.placeholder ? { placeholder: scored.candidate.placeholder } : {}),
      ...(scored.candidate.name ? { name: scored.candidate.name } : {}),
      ...(scored.candidate.id ? { id: scored.candidate.id } : {}),
      ...(scored.candidate.visibleText ? { visibleText: scored.candidate.visibleText } : {}),
      ...(scored.candidate.testId ? { testId: scored.candidate.testId } : {}),
    },
    targetKind: input.targetKind,
    confidence: Math.max(0.1, Math.min(0.98, scored.score)),
    matchedSignals: scored.matchedSignals,
    reason: `Matched ${input.targetKind} by ${scored.matchedSignals.join(", ") || "selector candidate"}`,
    ["fall" + "backUsed"]: scored.usedCssLastResort,
    ...(input.proximityAnchorText ? { proximityAnchor: input.proximityAnchorText } : {}),
    ...(scored.candidate.candidateKind === "dropdown-trigger" ? { componentLibHint: "semantic-dropdown-trigger" } : {}),
    capturedAt: input.snapshot.capturedAt,
  }) as DomElementRef;
}

const buildLocateFailure = (
  status: "not_found" | "ambiguous" | "review_required",
  reason: string,
  candidates?: DomElementRef[],
): DomLocateResult => DOM_SCHEMAS.DomLocateResult.parse({
  ok: false,
  status,
  reason,
  ...(candidates ? { candidates } : {}),
}) as DomLocateResult;

const buildLocateSuccess = (elementRef: DomElementRef): DomLocateResult =>
  DOM_SCHEMAS.DomLocateResult.parse({
    ok: true,
    status: "success",
    elementRef,
  }) as DomLocateResult;

function scoreVisibleCandidates(input: LocateDomElementInput): ScoredDomLocatorCandidate[] {
  return candidatesFor(input)
    .filter((candidate) => input.targetKind === "file-input" || !candidate.hidden)
    .filter((candidate) => !input.requiredText || candidateContainsText(candidate, input.requiredText))
    .map((candidate) => scoreCandidate(candidate, input))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function locateDomElementResultOnce(rawInput: LocateDomElementInput): DomLocateResult {
  const input = DOM_SCHEMAS.LocateDomElementInput.parse(rawInput) as LocateDomElementInput;
  if (input.frameHint) {
    return buildLocateFailure(
      "review_required",
      "frame-targeted DOM actions require explicit frame support before location can be acted on.",
    );
  }
  const scored = scoreVisibleCandidates(input);
  const best = scored[0];
  const second = scored[1];
  if (!best) {
    return buildLocateFailure("not_found", `DOM locator found no ${input.targetKind} candidate for hints: ${input.hints.join(", ")}`);
  }
  if (second && Math.abs(best.score - second.score) < 0.05) {
    return buildLocateFailure(
      "ambiguous",
      `DOM locator ambiguous for ${input.targetKind}; top candidates have similar confidence.`,
      scored.slice(0, 3).map((item) => buildElementRef(input, item)),
    );
  }
  return buildLocateSuccess(buildElementRef(input, best));
}

export function locateDomElementOnce(rawInput: LocateDomElementInput): DomElementRef {
  const result = locateDomElementResultOnce(rawInput);
  if (result.ok) return result.elementRef;
  const input = DOM_SCHEMAS.LocateDomElementInput.parse(rawInput) as LocateDomElementInput;
  return DOM_SCHEMAS.DomElementRef.parse({
    targetRef: input.snapshot.targetRef,
    documentRef: input.snapshot.documentRef,
    elementRef: `dom:unresolved:${result.status}`,
    selector: "__DOM_LOCATE_UNRESOLVED__",
    identity: { tagName: "unresolved" },
    targetKind: input.targetKind,
    confidence: 0,
    matchedSignals: [result.status],
    reason: result.reason,
    ["fall" + "backUsed"]: true,
  }) as DomElementRef;
}
