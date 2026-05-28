import path from "node:path";

import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import type { AmazonInvoiceUploadMissionInput, AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";

type TraceCandidate = {
  kind: string;
  tagName?: string | undefined;
  type?: string | undefined;
  role?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  visibleText?: string | undefined;
  nearbyText?: string | undefined;
  disabled?: boolean | undefined;
  hidden?: boolean | undefined;
  selectorCandidate?: string | undefined;
};

type CandidateSource = Omit<TraceCandidate, "kind">;

type AmazonDomTraceStatus = "snapshot" | "success" | "failed" | "review_required";

export type AmazonDomStepTraceContext = {
  mission: AmazonInvoiceUploadMissionInput | AmazonTaxInvoiceDownloadMissionInput;
  stepName: string;
  status: AmazonDomTraceStatus;
  snapshot?: DomSnapshot | undefined;
  selectedElement?: DomElementRef | undefined;
  reason?: string | undefined;
  evidenceRef?: string | undefined;
};

const MAX_TEXT_LENGTH = 140;
const MAX_CANDIDATES_PER_GROUP = 8;

export function amazonDomTraceRefFromIds(input: {
  amazonOrderId?: string | undefined;
  invoiceNo?: string | undefined;
  marketplace?: string | undefined;
  requestId?: string | undefined;
}): string {
  const refSegment = input.amazonOrderId && input.invoiceNo
    ? `${safeSegment(input.amazonOrderId)}-${safeSegment(input.invoiceNo)}`
    : `download-${safeSegment(input.marketplace ?? "marketplace")}-${safeSegment(input.requestId ?? "latest")}`;
  return path.join(
    "runtime-evidence",
    "amazon-invoice-upload",
    `${refSegment}.jsonl`,
  );
}

export function buildAmazonDomTraceBaseEvent(input: AmazonDomStepTraceContext) {
  const traceRef = amazonDomTraceRefFromIds(input.mission);
  return {
    traceId: traceRef,
    stepId: stepId(input.stepName),
    missionId: missionId(input.mission),
    owner: "amazon-invoice-upload" as const,
    component: "dom-automation-step-trace" as const,
    platformId: "amazon-seller-central",
    refs: buildRefs(input, traceRef),
    payload: buildPayload(input),
  };
}

function missionId(mission: AmazonInvoiceUploadMissionInput | AmazonTaxInvoiceDownloadMissionInput): string {
  return mission.missionType === "amazon_invoice_upload"
    ? `${mission.amazonOrderId}:${mission.invoiceNo}`
    : `tax-invoice-download:${mission.marketplace}:${mission.requestId ?? "latest"}`;
}

export function resolveAmazonDomRuntimeStatus(
  status: AmazonDomTraceStatus,
): "success" | "failed" | "review_required" {
  if (status === "failed") return "failed";
  if (status === "review_required") return "review_required";
  return "success";
}

function buildPayload(input: AmazonDomStepTraceContext): Record<string, unknown> {
  return compact({
    schemaVersion: "amazonDomStepTrace.v2",
    stepId: stepId(input.stepName),
    abilityId: abilityId(input),
    targetHost: targetHost(input),
    targetKind: input.selectedElement?.targetKind,
    locatorSummary: input.selectedElement ? summarizeSelectedElement(input.selectedElement) : undefined,
    actionResult: input.status,
    evidenceRef: input.evidenceRef,
    reviewRequiredReason: input.status === "review_required" ? clip(input.reason) : undefined,
    page: input.snapshot ? summarizePage(input.snapshot) : undefined,
    candidates: input.snapshot ? summarizeCandidates(input.snapshot) : undefined,
  });
}

function buildRefs(
  input: AmazonDomStepTraceContext,
  traceRef: string,
): Record<string, string> {
  return compactStringRecord({
    targetHost: targetHost(input),
    evidenceRef: input.evidenceRef,
    domTraceRef: traceRef,
  });
}

function summarizePage(snapshot: DomSnapshot): Record<string, unknown> {
  return {
    targetHost: hostFromUrl(snapshot.url),
    title: clip(snapshot.title),
    capturedAt: snapshot.capturedAt,
    counts: {
      forms: snapshot.forms.length,
      inputs: snapshot.inputs.length,
      buttons: snapshot.buttons.length,
      links: snapshot.links.length,
      fileInputs: snapshot.fileInputs.length,
      dialogs: snapshot.dialogs.length,
      frames: snapshot.frames.length,
      textBlocks: snapshot.textBlocks.length,
      tableRows: snapshot.tableRows.length,
      roleRows: snapshot.roleRows.length,
      genericClickableElements: snapshot.genericClickableElements.length,
      detectedStates: snapshot.detectedStates.length,
    },
    detectedStates: snapshot.detectedStates,
  };
}

function stepId(stepName: string): string {
  return `amazon-dom:${stepName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function abilityId(input: {
  stepName: string;
  selectedElement?: DomElementRef | undefined;
  snapshot?: DomSnapshot | undefined;
}): string {
  if (input.selectedElement?.targetKind) return `dom.${input.selectedElement.targetKind}`;
  if (input.snapshot) return "dom.snapshot";
  return `dom.${stepId(input.stepName)}`;
}

function targetHost(input: {
  mission: AmazonInvoiceUploadMissionInput | AmazonTaxInvoiceDownloadMissionInput;
  snapshot?: DomSnapshot | undefined;
}): string {
  return hostFromUrl(input.snapshot?.url ?? input.mission.sellerCentralEntryUrl);
}

function hostFromUrl(value: string): string {
  try {
    return new URL(value).host || "local-file";
  } catch {
    return "unknown";
  }
}

function summarizeCandidates(snapshot: DomSnapshot): Record<string, TraceCandidate[]> {
  return {
    inputs: snapshot.inputs.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("input", item)),
    buttons: snapshot.buttons.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("button", item)),
    links: snapshot.links.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("link", item)),
    fileInputs: snapshot.fileInputs.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("file-input", item)),
    dialogs: snapshot.dialogs.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("dialog", item)),
    textBlocks: snapshot.textBlocks.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("text-block", item)),
    tableRows: snapshot.tableRows.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("table-row", item)),
    roleRows: snapshot.roleRows.slice(0, MAX_CANDIDATES_PER_GROUP).map((item) => candidate("role-row", item)),
    genericClickableElements: snapshot.genericClickableElements
      .slice(0, MAX_CANDIDATES_PER_GROUP)
      .map((item) => candidate("generic-clickable", item)),
  };
}

function candidate(kind: string, source: CandidateSource): TraceCandidate {
  return compact({
    kind,
    tagName: source.tagName,
    type: source.type,
    role: source.role,
    ariaLabel: clip(source.ariaLabel),
    labelText: clip(source.labelText),
    placeholder: clip(source.placeholder),
    name: clip(source.name),
    id: clip(source.id),
    visibleText: clip(source.visibleText),
    nearbyText: clip(source.nearbyText),
    disabled: source.disabled,
    hidden: source.hidden,
    selectorCandidate: clip(source.selectorCandidate),
  });
}

function summarizeSelectedElement(element: DomElementRef): Record<string, unknown> {
  return {
    elementRef: element.elementRef,
    selector: clip(element.selector),
    frameRef: element.frameRef,
    targetKind: element.targetKind,
    confidence: element.confidence,
    matchedSignals: element.matchedSignals.map(clip),
    reason: clip(element.reason),
    fallbackUsed: element.fallbackUsed,
  };
}

function clip(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compactValue = value.replace(/\s+/g, " ").trim();
  return compactValue.length > MAX_TEXT_LENGTH ? `${compactValue.slice(0, MAX_TEXT_LENGTH)}...` : compactValue;
}

function compact<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      output[key] = value;
    }
  }
  return output as T;
}

function compactStringRecord(input: Record<string, string | undefined>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      output[key] = value;
    }
  }
  return output;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "invoice";
}
