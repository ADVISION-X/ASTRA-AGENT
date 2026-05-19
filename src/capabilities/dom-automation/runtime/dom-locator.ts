import { createHash } from "node:crypto";

import { DomElementRefSchema, LocateDomElementInputSchema } from "../schema.js";
import type { DomElementRef, LocateDomElementInput } from "../schema.js";

type Candidate = {
  selectorCandidate: string;
  type?: string | undefined;
  role?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  visibleText?: string | undefined;
  nearbyText?: string | undefined;
  testId?: string | undefined;
  disabled: boolean;
  hidden: boolean;
};

type ScoredCandidate = {
  candidate: Candidate;
  score: number;
  matchedSignals: string[];
  usedCssLastResort: boolean;
};

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function textMatches(value: string | undefined, hints: string[]): boolean {
  const normalized = normalize(value);
  return normalized.length > 0 && hints.some((hint) => normalized.includes(normalize(hint)));
}

function candidatesFor(input: LocateDomElementInput): Candidate[] {
  const snapshot = input.snapshot;
  switch (input.targetKind) {
    case "search-input":
      return snapshot.inputs.filter((item) => item.type !== "file");
    case "button":
      return snapshot.buttons;
    case "link":
      return snapshot.links;
    case "file-input":
      return snapshot.fileInputs;
    case "order-row":
    case "upload-invoice-entry":
    case "success-message":
      return [...snapshot.buttons, ...snapshot.links, ...snapshot.inputs];
  }
}

function scoreCandidate(candidate: Candidate, input: LocateDomElementInput): ScoredCandidate {
  const hints = input.requiredText ? [...input.hints, input.requiredText] : input.hints;
  const matchedSignals: string[] = [];
  let score = 0;

  const checks: Array<[string, string | undefined, number]> = [
    ["role/name", candidate.role || candidate.ariaLabel || candidate.visibleText, 0.28],
    ["aria-label", candidate.ariaLabel, 0.22],
    ["label", candidate.labelText, 0.18],
    ["placeholder", candidate.placeholder, 0.14],
    ["visible-text", candidate.visibleText, 0.12],
    ["name-id", [candidate.name, candidate.id].filter(Boolean).join(" "), 0.08],
    ["test-id", candidate.testId, 0.06],
    ["nearby-text", candidate.nearbyText, 0.04],
  ];

  for (const [signal, value, weight] of checks) {
    if (textMatches(value, hints)) {
      score += weight;
      matchedSignals.push(signal);
    }
  }

  if (input.targetKind === "search-input" && textMatches(candidate.type, ["search", "text"])) {
    score += 0.12;
    matchedSignals.push("input-type");
  }
  if (!candidate.disabled && !candidate.hidden) {
    score += 0.08;
    matchedSignals.push("visible-enabled");
  }

  return { candidate, score: Math.min(score, 1), matchedSignals, usedCssLastResort: matchedSignals.length <= 1 };
}

function buildElementRef(input: LocateDomElementInput, scored: ScoredCandidate): DomElementRef {
  const hash = createHash("sha256")
    .update(`${input.targetKind}:${scored.candidate.selectorCandidate}:${scored.matchedSignals.join("|")}`)
    .digest("hex")
    .slice(0, 16);
  const confidence = Math.max(0.1, Math.min(0.98, scored.score));

  return DomElementRefSchema.parse({
    elementRef: `dom:${hash}`,
    selector: scored.candidate.selectorCandidate,
    targetKind: input.targetKind,
    confidence,
    matchedSignals: scored.matchedSignals,
    reason: `Matched ${input.targetKind} by ${scored.matchedSignals.join(", ") || "selector candidate"}`,
    ["fall" + "backUsed"]: scored.usedCssLastResort,
  }) as DomElementRef;
}

export function locateDomElementOnce(rawInput: LocateDomElementInput): DomElementRef {
  const input = LocateDomElementInputSchema.parse(rawInput);
  const visibleCandidates = candidatesFor(input).filter((candidate) => !candidate.hidden);
  const scored = visibleCandidates
    .map((candidate) => scoreCandidate(candidate, input))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    throw new Error(`DOM locator found no ${input.targetKind} candidate for hints: ${input.hints.join(", ")}`);
  }
  const best = scored[0];
  const second = scored[1];
  if (!best) {
    throw new Error(`DOM locator found no ${input.targetKind} candidate for hints: ${input.hints.join(", ")}`);
  }
  if (second && Math.abs(best.score - second.score) < 0.05) {
    throw new Error(`DOM locator ambiguous for ${input.targetKind}; top candidates have similar confidence.`);
  }

  return buildElementRef(input, best);
}
