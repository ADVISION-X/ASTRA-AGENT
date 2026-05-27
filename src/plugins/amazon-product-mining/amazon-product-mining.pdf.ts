import { readFileSync, writeFileSync } from "node:fs";

import { createAmazonPackageLayout } from "./amazon-product-mining.package-layout.js";

export type AmazonPdfResult =
  | { ok: true; pdfReportPath: string }
  | { ok: false; reason: string; manualRequired: true };

type AmazonPdfBuildInput = {
  taskId: string;
  dataDir: string;
  packageJsonPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  productDirection: string;
  amazonMarketplace: string;
  targetMarket: string;
};

type AmazonPackageManifest = {
  generated_at?: string;
  task_scope?: {
    status?: string | null;
    handoffStatus?: string | null;
    failureReason?: string | null;
  } | null;
  counts?: {
    keywords?: number;
    searchResults?: number;
    products?: number;
    reviews?: number;
    exceptions?: number;
  } | null;
  sections?: Record<string, string> | null;
  keywords?: Array<{
    keyword?: string;
    status?: string;
    searchResultCount?: number;
  }>;
  products?: Array<{
    title?: string | null;
    asin?: string | null;
    status?: string;
    reviewRecordCount?: number;
    currentPrice?: string | null;
    rating?: string | null;
    missingFields?: string[];
  }>;
};

type AmazonCompletenessReport = {
  counts?: {
    keywords?: Record<string, number>;
    products?: Record<string, number>;
    reviews?: Record<string, number>;
    exceptions?: Record<string, number>;
  };
  incomplete_products?: Array<{
    detailId: string;
    asin?: string | null;
    title?: string | null;
    status?: string;
    missingFields?: string[];
    reviewRowCount?: number;
  }>;
  task_failure_reason?: string | null;
};

type AmazonExceptionSummary = {
  total_exceptions?: number;
  exceptions?: Array<{
    scope?: string;
    scopeId?: string | null;
    exceptionKind?: string;
    message?: string;
  }>;
};

const readJsonFile = <T>(filePath: string): T | null => {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapePdfText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const truncateText = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;

const buildReportLines = (input: {
  pdfInput: AmazonPdfBuildInput;
  packageManifest: AmazonPackageManifest | null;
  completenessReport: AmazonCompletenessReport | null;
  exceptionSummary: AmazonExceptionSummary | null;
  masterReportHtmlPath: string;
  evidenceIndexPath: string;
}): string[] => {
  const summaryCounts = input.packageManifest?.counts ?? null;
  const keywords = input.packageManifest?.keywords ?? [];
  const products = input.packageManifest?.products ?? [];
  const incompleteProducts = input.completenessReport?.incomplete_products ?? [];
  const exceptions = input.exceptionSummary?.exceptions ?? [];
  const lines = [
    "Amazon Product Mining Master Report",
    `Task ID: ${input.pdfInput.taskId}`,
    `Amazon Marketplace: ${input.pdfInput.amazonMarketplace}`,
    `Target Market: ${input.pdfInput.targetMarket}`,
    `Product Direction: ${input.pdfInput.productDirection}`,
    `Generated At: ${input.packageManifest?.generated_at ?? new Date().toISOString()}`,
    `Task Status: ${input.packageManifest?.task_scope?.status ?? "unknown"}`,
    `Handoff Status: ${input.packageManifest?.task_scope?.handoffStatus ?? "unknown"}`,
    `Keywords Mined: ${summaryCounts?.keywords ?? input.pdfInput.keywordCount}`,
    `Search Results Collected: ${summaryCounts?.searchResults ?? "n/a"}`,
    `Products Detailed: ${summaryCounts?.products ?? input.pdfInput.productCount}`,
    `Reviews Collected: ${summaryCounts?.reviews ?? input.pdfInput.reviewCount}`,
    `Exceptions Recorded: ${summaryCounts?.exceptions ?? input.exceptionSummary?.total_exceptions ?? 0}`,
    `Master HTML Report: ${input.masterReportHtmlPath}`,
    `Evidence Index: ${input.evidenceIndexPath}`,
    `Data Package: ${input.pdfInput.packageJsonPath}`,
    "Keyword Summary:",
    ...(keywords.length > 0
      ? keywords.map((keyword) =>
          `- ${truncateText(keyword.keyword ?? "unknown keyword", 64)} | status=${keyword.status ?? "unknown"} | searchResults=${keyword.searchResultCount ?? 0}`)
      : ["- No keywords recorded"]),
    "Product Summary:",
    ...(products.length > 0
      ? products.map((product) => {
          const missingFields = product.missingFields && product.missingFields.length > 0
            ? ` | missing=${product.missingFields.join(",")}`
            : "";
          return `- ${truncateText(product.title ?? product.asin ?? "unknown product", 72)} | asin=${product.asin ?? "n/a"} | status=${product.status ?? "unknown"} | reviews=${product.reviewRecordCount ?? 0}${missingFields}`;
        })
      : ["- No products recorded"]),
    "Incomplete Product Signals:",
    ...(incompleteProducts.length > 0
      ? incompleteProducts.map((product) =>
          `- ${truncateText(product.title ?? product.asin ?? product.detailId, 72)} | status=${product.status ?? "unknown"} | missing=${(product.missingFields ?? []).join(",") || "none"} | reviews=${product.reviewRowCount ?? 0}`)
      : ["- No incomplete products recorded"]),
    "Exception Summary:",
    ...(exceptions.length > 0
      ? exceptions.map((exception) =>
          `- ${exception.scope ?? "unknown"}/${exception.exceptionKind ?? "unknown"}: ${truncateText(exception.message ?? "", 90)}`)
      : ["- No exceptions recorded"]),
  ];

  if (input.completenessReport?.task_failure_reason) {
    lines.push(`Task Failure Reason: ${truncateText(input.completenessReport.task_failure_reason, 120)}`);
  }

  return lines;
};

const buildArtifactListHtml = (paths: readonly string[]): string =>
  paths.map((filePath) => `<li><a href="${escapeHtml(filePath)}">${escapeHtml(filePath)}</a></li>`).join("");

const buildMasterHtmlReport = (input: {
  pdfInput: AmazonPdfBuildInput;
  packageManifest: AmazonPackageManifest | null;
  completenessReport: AmazonCompletenessReport | null;
  exceptionSummary: AmazonExceptionSummary | null;
  masterReportHtmlPath: string;
  pdfReportPath: string;
  evidenceIndexPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  exceptionSummaryPath: string;
}): string => {
  const counts = input.packageManifest?.counts ?? {};
  const keywords = input.packageManifest?.keywords ?? [];
  const products = input.packageManifest?.products ?? [];
  const incompleteProducts = input.completenessReport?.incomplete_products ?? [];
  const exceptions = input.exceptionSummary?.exceptions ?? [];
  const artifactPaths = [
    input.pdfInput.packageJsonPath,
    input.pdfReportPath,
    input.evidenceIndexPath,
    input.dataCompletenessReportPath,
    input.packageIntegrityReportPath,
    input.exceptionSummaryPath,
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Amazon Product Mining Master Report</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Georgia, "Iowan Old Style", serif;
        background: #f7f2e8;
        color: #1f2933;
      }
      body {
        margin: 0;
        padding: 32px;
        background: linear-gradient(180deg, #f7f2e8 0%, #fffdf8 100%);
      }
      h1, h2 {
        margin: 0 0 16px;
      }
      h1 {
        font-size: 32px;
      }
      h2 {
        font-size: 22px;
        margin-top: 28px;
      }
      p, li, td, th {
        line-height: 1.5;
        font-size: 14px;
      }
      .meta, .cards {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .card, .panel {
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(69, 52, 31, 0.14);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(111, 78, 55, 0.08);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      th, td {
        border-bottom: 1px solid rgba(69, 52, 31, 0.14);
        padding: 10px 8px;
        text-align: left;
        vertical-align: top;
      }
      ul {
        padding-left: 20px;
      }
      code {
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <section class="panel">
      <h1>Amazon Product Mining Master Report</h1>
      <p>This report is a readable surface over the structured package. The package JSON, evidence index, review JSONL files, completeness report, and integrity report remain the source of traceable evidence.</p>
    </section>
    <section class="meta" style="margin-top: 20px;">
      <div class="card"><strong>Task ID</strong><br />${escapeHtml(input.pdfInput.taskId)}</div>
      <div class="card"><strong>Marketplace</strong><br />${escapeHtml(input.pdfInput.amazonMarketplace)}</div>
      <div class="card"><strong>Target Market</strong><br />${escapeHtml(input.pdfInput.targetMarket)}</div>
      <div class="card"><strong>Product Direction</strong><br />${escapeHtml(input.pdfInput.productDirection)}</div>
      <div class="card"><strong>Task Status</strong><br />${escapeHtml(input.packageManifest?.task_scope?.status ?? "unknown")}</div>
      <div class="card"><strong>Handoff Status</strong><br />${escapeHtml(input.packageManifest?.task_scope?.handoffStatus ?? "unknown")}</div>
    </section>
    <section class="cards" style="margin-top: 20px;">
      <div class="card"><strong>Keywords</strong><br />${String(counts.keywords ?? input.pdfInput.keywordCount)}</div>
      <div class="card"><strong>Search Results</strong><br />${String(counts.searchResults ?? "n/a")}</div>
      <div class="card"><strong>Products</strong><br />${String(counts.products ?? input.pdfInput.productCount)}</div>
      <div class="card"><strong>Reviews</strong><br />${String(counts.reviews ?? input.pdfInput.reviewCount)}</div>
      <div class="card"><strong>Exceptions</strong><br />${String(counts.exceptions ?? input.exceptionSummary?.total_exceptions ?? 0)}</div>
    </section>
    <section class="panel">
      <h2>Artifact Map</h2>
      <ul>${buildArtifactListHtml(artifactPaths)}</ul>
    </section>
    <section class="panel">
      <h2>Keywords</h2>
      <table>
        <thead><tr><th>Keyword</th><th>Status</th><th>Search Results</th></tr></thead>
        <tbody>
          ${keywords.length > 0
            ? keywords.map((keyword) => `<tr><td>${escapeHtml(keyword.keyword ?? "")}</td><td>${escapeHtml(keyword.status ?? "unknown")}</td><td>${String(keyword.searchResultCount ?? 0)}</td></tr>`).join("")
            : '<tr><td colspan="3">No keywords recorded</td></tr>'}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Products</h2>
      <table>
        <thead><tr><th>Product</th><th>ASIN</th><th>Status</th><th>Price</th><th>Rating</th><th>Stored Reviews</th><th>Missing Fields</th></tr></thead>
        <tbody>
          ${products.length > 0
            ? products.map((product) => `<tr><td>${escapeHtml(product.title ?? "")}</td><td>${escapeHtml(product.asin ?? "")}</td><td>${escapeHtml(product.status ?? "unknown")}</td><td>${escapeHtml(product.currentPrice ?? "")}</td><td>${escapeHtml(product.rating ?? "")}</td><td>${String(product.reviewRecordCount ?? 0)}</td><td>${escapeHtml((product.missingFields ?? []).join(", "))}</td></tr>`).join("")
            : '<tr><td colspan="7">No products recorded</td></tr>'}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Completeness Signals</h2>
      <p><strong>Task failure reason:</strong> ${escapeHtml(input.completenessReport?.task_failure_reason ?? "none")}</p>
      <table>
        <thead><tr><th>Product</th><th>Status</th><th>Missing Fields</th><th>Stored Reviews</th></tr></thead>
        <tbody>
          ${incompleteProducts.length > 0
            ? incompleteProducts.map((product) => `<tr><td>${escapeHtml(product.title ?? product.asin ?? product.detailId)}</td><td>${escapeHtml(product.status ?? "unknown")}</td><td>${escapeHtml((product.missingFields ?? []).join(", "))}</td><td>${String(product.reviewRowCount ?? 0)}</td></tr>`).join("")
            : '<tr><td colspan="4">No incomplete products recorded</td></tr>'}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Exceptions</h2>
      <table>
        <thead><tr><th>Scope</th><th>Kind</th><th>Message</th></tr></thead>
        <tbody>
          ${exceptions.length > 0
            ? exceptions.map((exception) => `<tr><td>${escapeHtml(exception.scope ?? "")}</td><td>${escapeHtml(exception.exceptionKind ?? "")}</td><td>${escapeHtml(exception.message ?? "")}</td></tr>`).join("")
            : '<tr><td colspan="3">No exceptions recorded</td></tr>'}
        </tbody>
      </table>
    </section>
  </body>
</html>`;
};

const buildPdfStream = (lines: readonly string[]): string => {
  if (lines.length === 0) {
    return "BT\n/F1 10 Tf 14 TL 50 760 Td\n(No content available) Tj\nET";
  }
  const textLines = lines
    .map((line, index) => (index === 0 ? `(${escapePdfText(line)}) Tj` : `T*\n(${escapePdfText(line)}) Tj`))
    .join("\n");
  return `BT\n/F1 10 Tf 14 TL 50 760 Td\n${textLines}\nET`;
};

const buildMinimalPdf = (lines: readonly string[]): Buffer => {
  const pageSize = 46;
  const pageLineGroups = Array.from({ length: Math.max(1, Math.ceil(lines.length / pageSize)) }, (_, index) =>
    lines.slice(index * pageSize, (index + 1) * pageSize));
  const pageCount = pageLineGroups.length;
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    pageObjectIds.push(nextId);
    nextId += 1;
    contentObjectIds.push(nextId);
    nextId += 1;
  }
  const objects = [
    `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`,
    `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((objectId) => `${objectId} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`,
    `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];

  for (let index = 0; index < pageCount; index += 1) {
    const stream = buildPdfStream(pageLineGroups[index] ?? []);
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    objects.push(
      `${pageObjectId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentObjectId} 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  }

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "utf8");
};

export const buildAmazonProductMiningReport = (input: AmazonPdfBuildInput): AmazonPdfResult => {
  const layout = createAmazonPackageLayout({ dataDir: input.dataDir, taskId: input.taskId });
  const packageManifest = readJsonFile<AmazonPackageManifest>(input.packageJsonPath);
  const completenessReport = readJsonFile<AmazonCompletenessReport>(layout.dataCompletenessReportPath);
  const exceptionSummary = readJsonFile<AmazonExceptionSummary>(layout.exceptionSummaryPath);
  const reportLines = buildReportLines({
    pdfInput: input,
    packageManifest,
    completenessReport,
    exceptionSummary,
    masterReportHtmlPath: layout.masterReportHtmlPath,
    evidenceIndexPath: layout.evidenceIndexPath,
  });
  const pdfContent = buildMinimalPdf(reportLines);
  const htmlContent = buildMasterHtmlReport({
    pdfInput: input,
    packageManifest,
    completenessReport,
    exceptionSummary,
    masterReportHtmlPath: layout.masterReportHtmlPath,
    pdfReportPath: layout.pdfReportPath,
    evidenceIndexPath: layout.evidenceIndexPath,
    dataCompletenessReportPath: layout.dataCompletenessReportPath,
    packageIntegrityReportPath: layout.packageIntegrityReportPath,
    exceptionSummaryPath: layout.exceptionSummaryPath,
  });

  try {
    writeFileSync(layout.masterReportHtmlPath, htmlContent, "utf8");
    writeFileSync(layout.pdfReportPath, pdfContent);
    return { ok: true, pdfReportPath: layout.pdfReportPath };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      manualRequired: true,
    };
  }
};
