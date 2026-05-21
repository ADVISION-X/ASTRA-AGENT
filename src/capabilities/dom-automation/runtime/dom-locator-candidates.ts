import type { LocateDomElementInput } from "../../../types/dom-automation-inputs.js";

export type DomLocatorCandidate = {
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

export type ScoredDomLocatorCandidate = {
  candidate: DomLocatorCandidate;
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

const normalize = (value: string | undefined): string =>
  (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const textMatches = (value: string | undefined, hints: readonly string[]): boolean => {
  const normalized = normalize(value).normalize("NFKC");
  return normalized.length > 0 && hints.some((hint) => normalized.includes(normalize(hint).normalize("NFKC")));
};

export const candidateContainsText = (candidate: DomLocatorCandidate, requiredText: string): boolean =>
  [
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

const exactTextMatches = (value: string | undefined, hints: readonly string[]): boolean => {
  const normalized = normalize(value);
  return normalized.length > 0 && hints.some((hint) => normalized === normalize(hint));
};

const isButtonLikeCandidate = (candidate: DomLocatorCandidate): boolean =>
  candidate.tagName === "button" || candidate.role === "button" || candidate.type === "submit" || candidate.type === "button";

const candidateHasHintText = (candidate: DomLocatorCandidate, hints: readonly string[]): boolean =>
  [
    candidate.ariaLabel,
    candidate.labelText,
    candidate.visibleText,
    candidate.nearbyText,
    candidate.name,
    candidate.id,
  ].some((value) => textMatches(value, hints));

const candidateResolvers = {
  "text-input": (snapshot: DomSnapshot) =>
    snapshot.inputs.filter((item) => item.tagName === "textarea" || item.type === "text" || item.type === "search"),
  "search-input": (snapshot: DomSnapshot) =>
    snapshot.inputs.filter((item) => item.tagName === "textarea" || item.type === "text" || item.type === "search"),
  button: (snapshot: DomSnapshot) => snapshot.buttons,
  link: (snapshot: DomSnapshot) => snapshot.links,
  "file-input": (snapshot: DomSnapshot) => snapshot.fileInputs,
  row: (snapshot: DomSnapshot) => [...snapshot.tableRows, ...snapshot.roleRows, ...snapshot.textBlocks, ...snapshot.links],
  clickable: (snapshot: DomSnapshot) => [
    ...snapshot.buttons,
    ...snapshot.links,
    ...snapshot.genericClickableElements.filter((item) => !isButtonLikeCandidate(item)),
    ...snapshot.textBlocks.filter((item) => !isButtonLikeCandidate(item) && (item.visibleText ?? "").length <= 80),
  ],
  message: (snapshot: DomSnapshot) => [...snapshot.dialogs, ...snapshot.textBlocks, ...snapshot.genericClickableElements],
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
} satisfies Record<DomTargetKind, (snapshot: DomSnapshot) => DomLocatorCandidate[]>;

export const candidatesFor = (input: LocateDomElementInput): DomLocatorCandidate[] =>
  candidateResolvers[input.targetKind](input.snapshot);

const buildSignalChecks = (
  candidate: DomLocatorCandidate,
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

const addScoreSignal = (candidateScore: CandidateScore, score: number, signal: string): void => {
  candidateScore.score += score;
  candidateScore.matchedSignals.push(signal);
};

const scoreTextSignals = (candidate: DomLocatorCandidate, input: LocateDomElementInput): CandidateScore => {
  const hints = input.requiredText ? [...input.hints, input.requiredText] : input.hints;
  const candidateScore: CandidateScore = { score: 0, matchedSignals: [] };
  for (const [signal, value, weight] of buildSignalChecks(candidate)) {
    if (!textMatches(value, hints)) continue;
    addScoreSignal(candidateScore, weight, signal);
  }
  return candidateScore;
};

const applyExactSignalScore = (
  candidate: DomLocatorCandidate,
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

const applyKindScore = (
  candidate: DomLocatorCandidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  applyNativeKindScore(candidate, input, candidateScore);
  applyClickableKindScore(candidate, input, candidateScore);
  applyComponentKindScore(candidate, input, candidateScore);
};

const applyNativeKindScore = (
  candidate: DomLocatorCandidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  if (input.targetKind === "file-input" && candidate.type === "file") addScoreSignal(candidateScore, 0.52, "file-input-type");
  if (input.targetKind === "button" && candidate.type === "submit") addScoreSignal(candidateScore, 0.16, "submit-input-button");
  if (input.targetKind === "row" && (candidate.candidateKind === "table-row" || candidate.candidateKind === "role-row")) addScoreSignal(candidateScore, 0.32, "row-kind");
};

const applyClickableKindScore = (
  candidate: DomLocatorCandidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  if (input.targetKind === "clickable" && candidate.candidateKind === "clickable") addScoreSignal(candidateScore, 0.12, "clickable-kind");
  if (input.targetKind === "clickable" && isButtonLikeCandidate(candidate)) addScoreSignal(candidateScore, 0.24, "button-like-clickable");
  if (input.targetKind === "clickable" && isButtonLikeCandidate(candidate) && candidateHasHintText(candidate, input.hints)) addScoreSignal(candidateScore, 0.18, "button-like-upload-entry");
};

const applyComponentKindScore = (
  candidate: DomLocatorCandidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  if ((input.targetKind === "select" || input.targetKind === "combobox" || input.targetKind === "dropdown-trigger")
    && (candidate.tagName === "select" || candidate.role === "combobox" || candidate.candidateKind === "dropdown-trigger")) addScoreSignal(candidateScore, 0.28, "dropdown-kind");
  if (input.targetKind === "overlay-dismiss-button" && isButtonLikeCandidate(candidate)) addScoreSignal(candidateScore, 0.22, "overlay-dismiss-button-kind");
};

const applyTargetKindScore = (
  candidate: DomLocatorCandidate,
  input: LocateDomElementInput,
  candidateScore: CandidateScore,
): void => {
  if ((input.targetKind === "search-input" || input.targetKind === "text-input") && textMatches(candidate.type, ["search", "text"])) {
    addScoreSignal(candidateScore, 0.12, "input-type");
    return;
  }
  applyExactSignalScore(candidate, input, candidateScore);
  applyKindScore(candidate, input, candidateScore);
};

export const scoreCandidate = (
  candidate: DomLocatorCandidate,
  input: LocateDomElementInput,
): ScoredDomLocatorCandidate => {
  const candidateScore = scoreTextSignals(candidate, input);
  applyTargetKindScore(candidate, input, candidateScore);
  if (input.proximityAnchorText && textMatches(candidate.nearbyText, [input.proximityAnchorText])) {
    addScoreSignal(candidateScore, 0.1, "proximity-anchor");
  }
  if (candidate.disabled !== true && !candidate.hidden) addScoreSignal(candidateScore, 0.08, "visible-enabled");
  return {
    candidate,
    score: Math.min(candidateScore.score, 1),
    matchedSignals: candidateScore.matchedSignals,
    usedCssLastResort: candidateScore.matchedSignals.length <= 1,
  };
};
