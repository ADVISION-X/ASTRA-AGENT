import type { BrowserDomObservationQuery } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildBrowserFact } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { requireBrowser } from "../../web/child-handler.js";
import {
  decodeCoherentObservationPacket,
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentObservationRow,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR,
  GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
  GPT_UPLOAD_FROM_COMPUTER_KEYWORD,
  GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
} from "./selectors.js";

const attachmentObservationRowsCode = (
  rows: readonly GptCoherentObservationRow[],
): string => rows.map((row) => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
}).join("|");

type AttachmentControlState = Readonly<{
  controlRaw: number; controlEligible: number; choiceRaw: number; choiceEligible: number;
  targetRefHash: `sha256:${string}`; documentRefHash: `sha256:${string}`;
  rows: readonly GptCoherentObservationRow[]; facts: GptCoherentFactProjection;
}>;

const ATTACHMENT_CONTROL_QUERIES = Object.freeze([
  {
    queryId: "attachment-control", selector: GPT_ATTACHMENT_CONTROL_SELECTOR,
    scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 2,
    fields: ["disabled", "ariaDisabled"] as const,
  },
  {
    queryId: "active-menu", selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR,
    maxMatches: 2, fields: [],
  },
  {
    queryId: "upload-choice", selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
    scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR },
    textContains: GPT_UPLOAD_FROM_COMPUTER_KEYWORD, maxMatches: 2, fields: [],
  },
] satisfies readonly BrowserDomObservationQuery[]);

export const ATTACHMENT_CONTROL_OPEN_POSTCONDITION = Object.freeze({
  queries: Object.freeze(ATTACHMENT_CONTROL_QUERIES.map((query) => Object.freeze({
    ...query,
    expectedEligibleCount: 1,
  }))),
});

const projectAttachmentControlState = (
  observation: GptCoherentObservation,
): AttachmentControlState => {
  const control = observation.rows.find((row) => row.queryId === "attachment-control")!;
  const choice = observation.rows.find((row) => row.queryId === "upload-choice")!;
  return Object.freeze({
    controlRaw: control.rawCount,
    controlEligible: control.eligibleCount,
    choiceRaw: choice.rawCount,
    choiceEligible: choice.eligibleCount,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "upload-choice"),
  });
};

export const decodeAttachmentControlState = (packet: unknown): AttachmentControlState =>
  projectAttachmentControlState(decodeCoherentObservationPacket(packet, ATTACHMENT_CONTROL_QUERIES));

const row = (value: AttachmentControlState, queryId: string): GptCoherentObservationRow =>
  value.rows.find((candidate) => candidate.queryId === queryId)!;

export const failAttachmentControl = (
  code: string,
  value: AttachmentControlState,
  browserFact: GptChildBrowserFact | null = null,
): never => {
  const mutationOutcome = browserFact?.mutationOutcome ?? "no";
  const nativeFailureCode = value.rows.find((candidate) => candidate.nativeCauseCode !== null)?.nativeCauseCode ?? null;
  const topology = `revision=${value.facts.observationRevisionHash}:candidates=${attachmentObservationRowsCode(value.rows)}`;
  throw gptExecutionFailure(`${code}:${topology}`, {
    mutationOutcome,
    ...(browserFact ? {
      browserEffect: Object.freeze({
        effectScope: browserFact.effectScope,
        childCapabilityId: browserFact.childCapabilityId,
        browserOutcome: browserFact.browserOutcome,
      }),
    } : {}),
    proofFacts: Object.freeze({
      ...value.facts, decision: "FAIL_CLOSED", mutationOutcome,
      browserFact, nativeFailureCode,
    }),
  });
};

export const attachmentControlOpenable = (value: AttachmentControlState): boolean => {
  const control = row(value, "attachment-control");
  const activeMenu = row(value, "active-menu");
  const choice = row(value, "upload-choice");
  return control.scopeRawCount === 1 && control.scopeEligibleCount === 1
    && control.rawCount === 1 && control.eligibleCount === 1
    && activeMenu.eligibleCount === 0
    && choice.scopeEligibleCount === 0 && choice.rawCount === 0 && choice.eligibleCount === 0;
};

export const attachmentControlReady = (value: AttachmentControlState): boolean => {
  const control = row(value, "attachment-control");
  const activeMenu = row(value, "active-menu");
  const choice = row(value, "upload-choice");
  return control.scopeRawCount === 1 && control.scopeEligibleCount === 1
    && control.rawCount === 1 && control.eligibleCount === 1
    && activeMenu.eligibleCount === 1
    && choice.scopeEligibleCount === 1 && choice.rawCount >= 1 && choice.eligibleCount === 1
    && choice.scopeRejections.every((entry) => entry.reasons.length > 0)
    && choice.rejections.every((entry) => entry.reasons.length === 1 && entry.reasons[0] === "TEXT_MISMATCH");
};

const attachmentControlDisposition = (observation: GptCoherentObservation) => {
  const value = projectAttachmentControlState(observation);
  if (attachmentControlReady(value)) return "STABLE_DONE" as const;
  if (attachmentControlOpenable(value)) return "STABLE_ACT" as const;
  const control = row(value, "attachment-control");
  const activeMenu = row(value, "active-menu");
  const choice = row(value, "upload-choice");
  return control.scopeRawCount > 1 || control.eligibleCount > 1
    || activeMenu.eligibleCount > 1 || choice.eligibleCount > 1
    || (choice.rawCount > 0 && choice.eligibleCount === 0
      && choice.rejections.some((entry) => entry.reasons.includes("TEXT_MISMATCH")))
    ? "HARD_FAIL" as const : "TRANSIENT_DOM" as const;
};

export const readConfirmedAttachmentControlState = async (
  browser: ReturnType<typeof requireBrowser>,
  signal?: AbortSignal,
): Promise<AttachmentControlState> => projectAttachmentControlState(
  await readConfirmedCoherentObservation(
    browser, ATTACHMENT_CONTROL_QUERIES, attachmentControlDisposition, signal,
  ),
);
