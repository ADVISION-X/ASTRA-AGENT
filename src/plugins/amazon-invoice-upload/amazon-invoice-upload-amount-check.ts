import { readFileSync } from "node:fs";

import { PDFParse } from "pdf-parse";

import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DomSnapshot } from "../../types/dom-automation.js";
import type { BrowserTargetSession } from "../../lib/browser/browser-controller.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { readSnapshot, taskResult } from "./amazon-invoice-upload-flow-support.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

export type AmazonInvoiceMoney = {
  currency: "AED";
  amountMinor: number;
  display: string;
};

export type AmazonInvoiceAmountCheck = {
  status: "matched" | "mismatch" | "pdf_unreadable" | "order_total_unreadable";
  pdfAmount?: AmazonInvoiceMoney | undefined;
  orderAmount?: AmazonInvoiceMoney | undefined;
};

const PDF_TOTAL_LABELS = [
  "Gross amount payable",
  "Total amount payable",
  "Invoice total",
  "Amount payable",
] as const;

const ORDER_TOTAL_LABELS = [
  "总和",
  "Total",
] as const;
const ORDER_TOTAL_SECTION_LABELS = [
  "销售收益",
  "Sales proceeds",
] as const;
const ORDER_TOTAL_SNAPSHOT_TEXT_LIMIT = 240;
const ORDER_TOTAL_READ_ATTEMPTS = 3;
const ORDER_TOTAL_READ_RETRY_MS = 1000;

export async function verifyInvoiceAmountBeforeUpload(
  browser: BrowserTargetSession,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const pdfAmount = await extractInvoicePdfTotalAmount(mission.invoicePdfPath);
  if (!pdfAmount) {
    return amountGateFailure(runtimeLogger, mission, {
      status: "pdf_unreadable",
      reason: "Invoice PDF total amount could not be read before upload.",
      reachedStep: "verify invoice amount against order total",
    });
  }
  const orderEvidence = await readOrderDomTotalAmountWithRetry(browser);
  const orderAmount = orderEvidence.orderAmount;
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "verify invoice amount against order total",
    status: orderAmount ? "success" : "failed",
    snapshot: orderEvidence.snapshot,
    reason: orderAmount
      ? `Seller Central order total read as ${orderAmount.display}.`
      : `Seller Central order total was not readable from the live DOM after ${orderEvidence.attempts} bounded snapshot attempt(s).`,
  });
  if (!orderAmount) {
    return amountGateFailure(runtimeLogger, mission, {
      status: "order_total_unreadable",
      pdfAmount,
      reason: `Seller Central order total could not be read before upload; PDF total is ${pdfAmount.display}.`,
      reachedStep: "verify invoice amount against order total",
    });
  }
  if (pdfAmount.amountMinor !== orderAmount.amountMinor) {
    return amountGateFailure(runtimeLogger, mission, {
      status: "mismatch",
      pdfAmount,
      orderAmount,
      reason: `Invoice amount mismatch before upload: PDF ${pdfAmount.display} != Seller Central ${orderAmount.display}.`,
      reachedStep: "verify invoice amount against order total",
    });
  }
  return null;
}

async function readOrderDomTotalAmountWithRetry(browser: BrowserTargetSession): Promise<{
  readonly attempts: number;
  readonly orderAmount: AmazonInvoiceMoney | null;
  readonly snapshot: DomSnapshot;
}> {
  let snapshot = await readSnapshot(browser, { maxTextLengthPerNode: ORDER_TOTAL_SNAPSHOT_TEXT_LIMIT });
  for (let attempt = 1; attempt <= ORDER_TOTAL_READ_ATTEMPTS; attempt += 1) {
    const orderAmount = extractOrderDomTotalAmount(snapshot);
    if (orderAmount || attempt === ORDER_TOTAL_READ_ATTEMPTS) return { attempts: attempt, orderAmount, snapshot };
    await browser.wait(ORDER_TOTAL_READ_RETRY_MS);
    snapshot = await readSnapshot(browser, { maxTextLengthPerNode: ORDER_TOTAL_SNAPSHOT_TEXT_LIMIT });
  }
  return { attempts: ORDER_TOTAL_READ_ATTEMPTS, orderAmount: null, snapshot };
}

export async function extractInvoicePdfTotalAmount(pdfPath: string): Promise<AmazonInvoiceMoney | null> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: readFileSync(pdfPath) });
    const parsed = await parser.getText();
    return parsePdfTotalAmount(parsed.text);
  } catch {
    return null;
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

export function parsePdfTotalAmount(text: string): AmazonInvoiceMoney | null {
  const compact = normalizePdfText(text);
  for (const label of PDF_TOTAL_LABELS) {
    const labelIndex = compact.toLowerCase().lastIndexOf(label.toLowerCase());
    if (labelIndex < 0) continue;
    const afterLabel = compact.slice(labelIndex, labelIndex + 220);
    const match = moneyMatches(afterLabel).at(-1);
    if (match) return match;
  }
  return moneyMatches(compact).at(-1) ?? null;
}

export function extractOrderDomTotalAmount(snapshot: DomSnapshot): AmazonInvoiceMoney | null {
  const rows = [
    ...snapshot.tableRows.map((item) => item.visibleText),
    ...snapshot.roleRows.map((item) => item.visibleText),
    ...snapshot.textBlocks.map((item) => item.visibleText),
  ].map((item) => normalizeText(item ?? ""));
  for (const row of rows) {
    if (!ORDER_TOTAL_LABELS.some((label) => row.toLowerCase().includes(label.toLowerCase()))) {
      continue;
    }
    const match = moneyMatches(row).at(-1);
    if (match) return match;
  }
  const joinedRows = rows.filter(Boolean).join(" ");
  return amountAfterLabels(joinedRows, ORDER_TOTAL_LABELS, 260)
    ?? amountAfterLabels(joinedRows, ORDER_TOTAL_SECTION_LABELS, 700);
}

function amountAfterLabels(text: string, labels: readonly string[], windowLength: number): AmazonInvoiceMoney | null {
  const lower = text.toLowerCase();
  for (const label of labels) {
    const labelIndex = lower.lastIndexOf(label.toLowerCase());
    if (labelIndex < 0) continue;
    const match = moneyMatches(text.slice(labelIndex, labelIndex + windowLength)).at(-1);
    if (match) return match;
  }
  return null;
}

function amountGateFailure(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  input: {
    status: AmazonInvoiceAmountCheck["status"];
    pdfAmount?: AmazonInvoiceMoney | undefined;
    orderAmount?: AmazonInvoiceMoney | undefined;
    reason: string;
    reachedStep: string;
  },
): AmazonInvoiceUploadTaskResult {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: input.reachedStep,
    status: "failed",
    reason: input.reason,
  });
  return taskResult({
    status: "amount_mismatch_skipped",
    reason: input.reason,
    reachedStep: input.reachedStep,
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
    amountCheck: {
      status: input.status,
      ...(input.pdfAmount ? { pdfAmount: input.pdfAmount } : {}),
      ...(input.orderAmount ? { orderAmount: input.orderAmount } : {}),
    },
  });
}

function moneyMatches(text: string): AmazonInvoiceMoney[] {
  return Array.from(text.matchAll(/(?:AED\s*)?([0-9][0-9,]*)(?:\.([0-9]{2}))?\s*(?:AED)?/gi))
    .filter((match) => match[0].toUpperCase().includes("AED") || text.slice(Math.max(0, (match.index ?? 0) - 12), (match.index ?? 0) + 24).toUpperCase().includes("AED"))
    .map((match) => toMoney(match[1] ?? "", match[2] ?? "00"))
    .filter((money): money is AmazonInvoiceMoney => money !== null);
}

function toMoney(wholeText: string, centsText: string): AmazonInvoiceMoney | null {
  const whole = Number.parseInt(wholeText.replace(/,/g, ""), 10);
  const cents = Number.parseInt(centsText, 10);
  if (!Number.isFinite(whole) || !Number.isFinite(cents)) return null;
  const amountMinor = whole * 100 + cents;
  return {
    currency: "AED",
    amountMinor,
    display: `AED ${(amountMinor / 100).toFixed(2)}`,
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizePdfText(text: string): string {
  return normalizeText(text)
    .replace(/\bA\s*E\s*D\b/gi, "AED")
    .replace(/G\s*R\s*O\s*S\s*S\s+A\s*M\s*O\s*U\s*N\s*T\s+P\s*A\s*Y\s*A\s*B\s*L\s*E/gi, "Gross amount payable")
    .replace(/T\s*O\s*T\s*A\s*L\s+A\s*M\s*O\s*U\s*N\s*T\s+P\s*A\s*Y\s*A\s*B\s*L\s*E/gi, "Total amount payable")
    .replace(/I\s*N\s*V\s*O\s*I\s*C\s*E\s+T\s*O\s*T\s*A\s*L/gi, "Invoice total")
    .replace(/A\s*M\s*O\s*U\s*N\s*T\s+P\s*A\s*Y\s*A\s*B\s*L\s*E/gi, "Amount payable");
}
