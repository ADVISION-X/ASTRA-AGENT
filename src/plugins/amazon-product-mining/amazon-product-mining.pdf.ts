import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  AMAZON_PACKAGE_FILE_NAMES,
  createAmazonPackageLayout,
} from "./amazon-product-mining.package-layout.js";
import {
  buildAiReadingContract,
  buildBusinessBoundaryNotice,
} from "./amazon-product-mining.handoff.js";
import {
  buildAmazonMasterReportHtml,
  buildAmazonMasterReportLines,
  type AmazonMasterReportInput,
} from "./amazon-product-mining.master-report.js";

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
  generatedAt?: string;
  task?: Record<string, unknown>;
  aiKeywordRuns?: unknown[];
  keywords?: unknown[];
  products?: unknown[];
  reviewsIndex?: unknown[];
  exceptions?: unknown[];
};

type AmazonCompletenessReport = {
  summary?: Record<string, unknown>;
  products?: Array<Record<string, unknown>>;
};

type AmazonExceptionSummary = {
  exceptions?: Array<Record<string, unknown>>;
};

type AmazonEvidenceIndex = {
  keywords?: unknown[];
  products?: unknown[];
  reviews?: unknown[];
  artifacts?: Array<{ artifactId?: string; type?: string; fileRef?: string }>;
};

type AmazonIntegrityReport = {
  status?: string;
  checks?: Array<{ checkId?: string; status?: string; detail?: string }>;
  failures?: Array<{ checkId?: string; detail?: string }>;
};

const readJsonFile = <T>(filePath: string): T | null => {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
};

const readTextFile = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
};

const escapePdfText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

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
  const aiReadingContractText = readTextFile(layout.aiReadingContractPath) ?? buildAiReadingContract({
    packageJsonRef: AMAZON_PACKAGE_FILE_NAMES.packageJson,
    evidenceIndexRef: join("01-manifest", AMAZON_PACKAGE_FILE_NAMES.evidenceIndex),
    imageEvidenceIndexRef: join("01-manifest", AMAZON_PACKAGE_FILE_NAMES.imageEvidenceIndex),
    dataCompletenessReportRef: join("06-exception-and-completeness", AMAZON_PACKAGE_FILE_NAMES.dataCompletenessReport),
    packageIntegrityReportRef: join("06-exception-and-completeness", AMAZON_PACKAGE_FILE_NAMES.packageIntegrityReport),
    exceptionSummaryRef: join("06-exception-and-completeness", AMAZON_PACKAGE_FILE_NAMES.exceptionSummary),
  });
  const businessBoundaryNoticeText = readTextFile(layout.businessBoundaryNoticePath) ?? buildBusinessBoundaryNotice();
  const reportInput: AmazonMasterReportInput = {
    packageData: readJsonFile<AmazonPackageManifest>(input.packageJsonPath) as AmazonMasterReportInput["packageData"],
    evidenceIndex: readJsonFile<AmazonEvidenceIndex>(layout.evidenceIndexPath) as AmazonMasterReportInput["evidenceIndex"],
    completenessReport: readJsonFile<AmazonCompletenessReport>(layout.dataCompletenessReportPath) as AmazonMasterReportInput["completenessReport"],
    integrityReport: readJsonFile<AmazonIntegrityReport>(layout.packageIntegrityReportPath) as AmazonMasterReportInput["integrityReport"],
    exceptionSummary: readJsonFile<AmazonExceptionSummary>(layout.exceptionSummaryPath) as AmazonMasterReportInput["exceptionSummary"],
    aiReadingContractText,
    businessBoundaryNoticeText,
    generatedAt: new Date().toISOString(),
  };
  const reportLines = buildAmazonMasterReportLines(reportInput);
  const pdfContent = buildMinimalPdf(reportLines);
  const htmlContent = buildAmazonMasterReportHtml(reportInput);

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