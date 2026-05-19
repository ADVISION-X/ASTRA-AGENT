import { createHash } from "node:crypto";

import { DomElementRefSchema, LocateDomElementInputSchema } from "../schema.js";
import type { DomElementRef, LocateDomElementInput } from "../schema.js";

type Candidate = {
  selectorCandidate: string;
  candidateKind?: string | undefined;
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
  disabled?: boolean | undefined;
  hidden: boolean;
};

type ScoredCandidate = {
  candidate: Candidate;
  score: number;
  matchedSignals: string[];
  usedCssLastResort: boolean;
};

type CandidateScore = {
  score: number;
  matchedSignals: string[];
};

type DomSnapshot = LocateDomElementInput["snapshot"];
type DomTargetKind = LocateDomElementInput["targetKind"];

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function textMatches(value: string | undefined, hints: string[]): boolean {
  const normalized = normalize(value);
  return normalized.length > 0 && hints.some((hint) => normalized.includes(normalize(hint)));
}

const CANDIDATE_RESOLVERS = {
  "search-input": (snapshot: DomSnapshot) =>
    snapshot.inputs.filter((item) => item.type !== "file"),
  button: (snapshot: DomSnapshot) => snapshot.buttons,
  link: (snapshot: DomSnapshot) => snapshot.links,
  "file-input": (snapshot: DomSnapshot) => snapshot.fileInputs,
  "order-row": (snapshot: DomSnapshot) => [
    ...snapshot.tableRows,
    ...snapshot.roleRows,
    ...snapshot.textBlocks,
    ...snapshot.links,
  ],
  "upload-invoice-entry": (snapshot: DomSnapshot) => [
    ...snapshot.buttons,
    ...snapshot.links,
    ...snapshot.genericClickableElements,
    ...snapshot.textBlocks,
  ],
  "success-message": (snapshot: DomSnapshot) => [
    ...snapshot.dialogs,
    ...snapshot.textBlocks,
    ...snapshot.genericClickableElements,
  ],
} satisfies Record<DomTargetKind, (snapshot: DomSnapshot) => Candidate[]>;

function candidatesFor(input: LocateDomElementInput): Candidate[] {
  return CANDIDATE_RESOLVERS[input.targetKind](input.snapshot);
}

const buildSignalChecks = (
  candidate: Candidate,
): Array<[string, string | undefined, number]> => [
  ["role/name", candidate.role || candidate.ariaLabel || candidate.visibleText, 0.28],
  ["aria-label", candidate.ariaLabel, 0.22],
  ["label", candidate.labelText, 0.18],
  ["placeholder", candidate.placeholder, 0.14],
  ["visible-text", candidate.visibleText, 0.12],
  ["name-id", [candidate.name, candidate.id].filter(Boolean).join(" "), 0.08],
  ["test-id", candidate.testId, 0.06],
  ["nearby-text", candidate.nearbyText, 0.04],
];

function scoreTextSignals(
  candidate: Candidate,
  input: LocateDomElementInput,
): CandidateScore {
  const hints = input.requiredText ? [...input.hints, input.requiredText] : input.hints;
  const candidateScore: CandidateScore = { score: 0, matchedSignals: [] };

  for (const [signal, value, weight] of buildSignalChecks(candidate)) {
    if (!textMatches(value, hints)) continue;
    candidateScore.score += weight;
    candidateScore.matchedSignals.push(signal);
  }

  return candidateScore;
}

function applyTargetKindScore(
  candidate: Candidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void {
  if (input.targetKind === "search-input" && textMatches(candidate.type, ["search", "text"])) {
    candidateScore.score += 0.12;
    candidateScore.matchedSignals.push("input-type");
    return;
  }
  if (input.targetKind === "order-row" && (candidate.candidateKind === "table-row" || candidate.candidateKind === "role-row")) {
    candidateScore.score += 0.16;
    candidateScore.matchedSignals.push("row-kind");
    return;
  }
  if (input.targetKind === "upload-invoice-entry" && candidate.candidateKind === "clickable") {
    candidateScore.score += 0.12;
    candidateScore.matchedSignals.push("clickable-kind");
  }
}

const applyVisibilityScore = (
  candidate: Candidate,
  candidateScore: CandidateScore,
): void => {
  if (candidate.disabled === true || candidate.hidden) return;
  candidateScore.score += 0.08;
  candidateScore.matchedSignals.push("visible-enabled");
};

function scoreCandidate(candidate: Candidate, input: LocateDomElementInput): ScoredCandidate {
  const candidateScore = scoreTextSignals(candidate, input);
  applyTargetKindScore(candidate, input, candidateScore);
  applyVisibilityScore(candidate, candidateScore);

  return {
    candidate,
    score: Math.min(candidateScore.score, 1),
    matchedSignals: candidateScore.matchedSignals,
    usedCssLastResort: candidateScore.matchedSignals.length <= 1,
  };
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
