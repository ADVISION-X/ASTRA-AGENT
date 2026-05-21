import { createHash } from "node:crypto";

import { DomElementRefSchema, DomLocateResultSchema, LocateDomElementInputSchema } from "../schema.js";
import type { DomElementRef, DomLocateResult, LocateDomElementInput } from "../schema.js";

type Candidate = {
  tagName?: string | undefined;
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
  const normalized = normalize(value).normalize("NFKC");
  return normalized.length > 0 && hints.some((hint) => normalized.includes(normalize(hint).normalize("NFKC")));
}

function candidateContainsText(candidate: Candidate, requiredText: string): boolean {
  return [
    candidate.role,
    candidate.ariaLabel,
    candidate.labelText,
    candidate.placeholder,
    candidate.name,
    candidate.id,
    candidate.visibleText,
    candidate.nearbyText,
    candidate.testId,
  ].some((value) => textMatches(value, [requiredText]));
}

function exactTextMatches(value: string | undefined, hints: string[]): boolean {
  const normalized = normalize(value);
  return normalized.length > 0 && hints.some((hint) => normalized === normalize(hint));
}

function isButtonLikeCandidate(candidate: Candidate): boolean {
  return candidate.tagName === "button"
    || candidate.role === "button"
    || candidate.type === "submit"
    || candidate.type === "button";
}

function candidateHasHintText(candidate: Candidate, hints: string[]): boolean {
  return [
    candidate.ariaLabel,
    candidate.labelText,
    candidate.visibleText,
    candidate.nearbyText,
    candidate.name,
    candidate.id,
  ].some((value) => textMatches(value, hints));
}

const CANDIDATE_RESOLVERS = {
  "text-input": (snapshot: DomSnapshot) =>
    snapshot.inputs.filter((item) => item.tagName === "textarea" || item.type === "text" || item.type === "search"),
  "search-input": (snapshot: DomSnapshot) =>
    snapshot.inputs.filter((item) => item.tagName === "textarea" || item.type === "text" || item.type === "search"),
  button: (snapshot: DomSnapshot) => snapshot.buttons,
  link: (snapshot: DomSnapshot) => snapshot.links,
  "file-input": (snapshot: DomSnapshot) => snapshot.fileInputs,
  row: (snapshot: DomSnapshot) => [
    ...snapshot.tableRows,
    ...snapshot.roleRows,
    ...snapshot.textBlocks,
    ...snapshot.links,
  ],
  clickable: (snapshot: DomSnapshot) => [
    ...snapshot.buttons,
    ...snapshot.links,
    ...snapshot.genericClickableElements.filter((item) => !isButtonLikeCandidate(item)),
    ...snapshot.textBlocks.filter((item) => !isButtonLikeCandidate(item) && (item.visibleText ?? "").length <= 80),
  ],
  message: (snapshot: DomSnapshot) => [
    ...snapshot.dialogs,
    ...snapshot.textBlocks,
    ...snapshot.genericClickableElements,
  ],
  dialog: (snapshot: DomSnapshot) => snapshot.dialogs,
  select: (snapshot: DomSnapshot) => snapshot.inputs.filter((item) => item.tagName === "select" || item.role === "listbox"),
  combobox: (snapshot: DomSnapshot) => snapshot.dropdownTriggers,
  "dropdown-trigger": (snapshot: DomSnapshot) => snapshot.dropdownTriggers,
  "overlay-dismiss-button": (snapshot: DomSnapshot) => [
    ...snapshot.buttons,
    ...snapshot.links,
    ...snapshot.genericClickableElements,
  ],
  "tab-button": (snapshot: DomSnapshot) => snapshot.genericClickableElements.filter((item) => item.role === "tab"),
  "rich-text-editor": (snapshot: DomSnapshot) => snapshot.inputs.filter((item) => item.role === "textbox" || item.tagName.includes("editor")),
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

const addScoreSignal = (
  candidateScore: CandidateScore,
  score: number,
  signal: string,
): void => {
  candidateScore.score += score;
  candidateScore.matchedSignals.push(signal);
};

const applyExactSignalScore = (
  candidate: Candidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  if (exactTextMatches(candidate.id, input.hints) || exactTextMatches(candidate.name, input.hints)) {
    addScoreSignal(candidateScore, 0.28, "exact-name-id");
  }
  if (exactTextMatches(candidate.visibleText, input.hints) || exactTextMatches(candidate.ariaLabel, input.hints)) {
    addScoreSignal(candidateScore, 0.18, "exact-visible-name");
  }
};

const applyInputKindScore = (
  candidate: Candidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): boolean => {
  if ((input.targetKind === "search-input" || input.targetKind === "text-input") && textMatches(candidate.type, ["search", "text"])) {
    addScoreSignal(candidateScore, 0.12, "input-type");
  }
  return input.targetKind === "search-input" || input.targetKind === "text-input";
};

const applyElementKindScore = (
  candidate: Candidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  if (input.targetKind === "file-input" && candidate.type === "file") {
    addScoreSignal(candidateScore, 0.52, "file-input-type");
    return;
  }
  if (input.targetKind === "button" && candidate.type === "submit") {
    addScoreSignal(candidateScore, 0.16, "submit-input-button");
  }
  if (input.targetKind === "row" && (candidate.candidateKind === "table-row" || candidate.candidateKind === "role-row")) {
    addScoreSignal(candidateScore, 0.32, "row-kind");
    return;
  }
  if (input.targetKind === "clickable" && candidate.candidateKind === "clickable") {
    addScoreSignal(candidateScore, 0.12, "clickable-kind");
  }
  if (input.targetKind === "clickable" && isButtonLikeCandidate(candidate)) {
    addScoreSignal(candidateScore, 0.24, "button-like-clickable");
  }
  if (input.targetKind === "clickable" && isButtonLikeCandidate(candidate) && candidateHasHintText(candidate, input.hints)) {
    addScoreSignal(candidateScore, 0.18, "button-like-upload-entry");
  }
  if ((input.targetKind === "select" || input.targetKind === "combobox" || input.targetKind === "dropdown-trigger")
    && (candidate.tagName === "select" || candidate.role === "combobox" || candidate.candidateKind === "dropdown-trigger")) {
    addScoreSignal(candidateScore, 0.28, "dropdown-kind");
  }
  if (input.targetKind === "overlay-dismiss-button" && isButtonLikeCandidate(candidate)) {
    addScoreSignal(candidateScore, 0.22, "overlay-dismiss-button-kind");
  }
};

function applyTargetKindScore(
  candidate: Candidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void {
  if (applyInputKindScore(candidate, input, candidateScore)) return;
  applyExactSignalScore(candidate, input, candidateScore);
  applyElementKindScore(candidate, input, candidateScore);
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
  if (input.proximityAnchorText && textMatches(candidate.nearbyText, [input.proximityAnchorText])) {
    addScoreSignal(candidateScore, 0.1, "proximity-anchor");
  }
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
    ...(input.proximityAnchorText ? { proximityAnchor: input.proximityAnchorText } : {}),
    ...(scored.candidate.candidateKind === "dropdown-trigger" ? { componentLibHint: "semantic-dropdown-trigger" } : {}),
    textFingerprint: createHash("sha256")
      .update([
        scored.candidate.ariaLabel,
        scored.candidate.labelText,
        scored.candidate.placeholder,
        scored.candidate.visibleText,
      ].filter(Boolean).join("|"))
      .digest("hex")
      .slice(0, 16),
    capturedAt: input.snapshot.capturedAt,
  }) as DomElementRef;
}

export function locateDomElementResultOnce(rawInput: LocateDomElementInput): DomLocateResult {
  const input = LocateDomElementInputSchema.parse(rawInput);
  if (input.frameHint) {
    return DomLocateResultSchema.parse({
      ok: false,
      status: "review_required",
      reason: "frame-targeted DOM actions require explicit frame support before location can be acted on.",
    }) as DomLocateResult;
  }
  const visibleCandidates = candidatesFor(input)
    .filter((candidate) => input.targetKind === "file-input" || !candidate.hidden)
    .filter((candidate) => !input.requiredText || candidateContainsText(candidate, input.requiredText));
  const scored = visibleCandidates
    .map((candidate) => scoreCandidate(candidate, input))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return DomLocateResultSchema.parse({
      ok: false,
      status: "not_found",
      reason: `DOM locator found no ${input.targetKind} candidate for hints: ${input.hints.join(", ")}`,
    }) as DomLocateResult;
  }
  const best = scored[0];
  const second = scored[1];
  if (!best) {
    return DomLocateResultSchema.parse({
      ok: false,
      status: "not_found",
      reason: `DOM locator found no ${input.targetKind} candidate for hints: ${input.hints.join(", ")}`,
    }) as DomLocateResult;
  }
  if (second && Math.abs(best.score - second.score) < 0.05) {
    return DomLocateResultSchema.parse({
      ok: false,
      status: "ambiguous",
      reason: `DOM locator ambiguous for ${input.targetKind}; top candidates have similar confidence.`,
      candidates: scored.slice(0, 3).map((item) => buildElementRef(input, item)),
    }) as DomLocateResult;
  }

  return DomLocateResultSchema.parse({
    ok: true,
    status: "success",
    elementRef: buildElementRef(input, best),
  }) as DomLocateResult;
}

export function locateDomElementOnce(rawInput: LocateDomElementInput): DomElementRef {
  const result = locateDomElementResultOnce(rawInput);
  if (result.ok) return result.elementRef;
  return DomElementRefSchema.parse({
    elementRef: `dom:unresolved:${result.status}`,
    selector: "__DOM_LOCATE_UNRESOLVED__",
    targetKind: LocateDomElementInputSchema.parse(rawInput).targetKind,
    confidence: 0,
    matchedSignals: [result.status],
    reason: result.reason,
    ["fall" + "backUsed"]: true,
  }) as DomElementRef;
}
