import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";

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

const createReportArtifactsDir = (input: AmazonPdfBuildInput): string => {
  const artifactsDir = resolve(input.dataDir, AMAZON_PRODUCT_MINING_ARTIFACTS_DIR, input.taskId);
  mkdirSync(artifactsDir, { recursive: true });
  return artifactsDir;
};

const escapePdfText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildReportLines = (input: AmazonPdfBuildInput): string[] => [
  "Amazon Product Mining Report",
  `Task ID: ${input.taskId}`,
  `Amazon Marketplace: ${input.amazonMarketplace}`,
  `Target Market: ${input.targetMarket}`,
  `Product Direction: ${input.productDirection}`,
  `Generated At: ${new Date().toISOString()}`,
  `Keywords Mined: ${input.keywordCount}`,
  `Products Detailed: ${input.productCount}`,
  `Reviews Collected: ${input.reviewCount}`,
  "This report is a surface summary.",
  "The complete structured data package is the source for keyword to product to review traceability.",
  "This report provides mining evidence only. Advanced AI analysis receives the package for adjudication.",
  `Data Package: ${input.packageJsonPath}`,
];

const buildPdfStream = (lines: readonly string[]): string => {
  const textLines = lines
    .map((line, index) => {
      const prefix = index === 0 ? "BT /F1 18 Tf 22 TL 50 760 Td " : "T* ";
      const fontSize = index === 0 ? "" : "/F1 10 Tf 14 TL ";
      return `${prefix}${fontSize}(${escapePdfText(line)}) Tj`;
    })
    .join("\n");
  return `${textLines}\nET`;
};

const buildMinimalPdf = (lines: readonly string[]): Buffer => {
  const stream = buildPdfStream(lines);
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
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
  const artifactsDir = createReportArtifactsDir(input);
  const pdfContent = buildMinimalPdf(buildReportLines(input));

  const reportPath = join(artifactsDir, "amazon-product-mining-report.pdf");
  try {
    writeFileSync(reportPath, pdfContent);
    return { ok: true, pdfReportPath: reportPath };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      manualRequired: true,
    };
  }
};
