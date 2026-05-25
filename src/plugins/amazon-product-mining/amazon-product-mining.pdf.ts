import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";

export type AmazonPdfResult =
  | { ok: true; pdfReportPath: string }
  | { ok: false; reason: string; manualRequired: true };

export const buildAmazonProductMiningReport = (input: {
  taskId: string;
  dataDir: string;
  packageJsonPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  productDirection: string;
  amazonMarketplace: string;
  targetMarket: string;
}): AmazonPdfResult => {
  const artifactsDir = resolve(input.dataDir, AMAZON_PRODUCT_MINING_ARTIFACTS_DIR, input.taskId);
  mkdirSync(artifactsDir, { recursive: true });

  const htmlContent = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Amazon Product Mining Report — Task ${input.taskId}</title>
<style>
body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 24px; color: #333; }
h1 { color: #146eb4; border-bottom: 2px solid #146eb4; padding-bottom: 8px; }
h2 { color: #232f3e; }
.meta-table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
.meta-table th, .meta-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
.meta-table th { background: #232f3e; color: white; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; text-align: center; }
.stat-value { font-size: 2em; font-weight: bold; color: #146eb4; }
.stat-label { color: #666; font-size: 0.9em; }
.note { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin-bottom: 24px; }
</style>
</head>
<body>
<h1>Amazon Product Mining Report</h1>
<div class="note">
  This report is a surface summary. The complete structured data is available in the data package JSON file.
  This report does NOT include final product selection conclusions — AI analysis is required for adjudication.
</div>
<h2>Mission Parameters</h2>
<table class="meta-table">
<tr><th>Field</th><th>Value</th></tr>
<tr><td>Task ID</td><td>${escapeHtml(input.taskId)}</td></tr>
<tr><td>Amazon Marketplace</td><td>${escapeHtml(input.amazonMarketplace)}</td></tr>
<tr><td>Target Market</td><td>${escapeHtml(input.targetMarket)}</td></tr>
<tr><td>Product Direction</td><td>${escapeHtml(input.productDirection)}</td></tr>
<tr><td>Generated At</td><td>${new Date().toISOString()}</td></tr>
</table>
<h2>Collection Statistics</h2>
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-value">${input.keywordCount}</div>
    <div class="stat-label">Keywords Mined</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${input.productCount}</div>
    <div class="stat-label">Products Detailed</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${input.reviewCount}</div>
    <div class="stat-label">Reviews Collected</div>
  </div>
</div>
<h2>Data Package Reference</h2>
<p>Complete structured data is stored at:</p>
<pre>${escapeHtml(input.packageJsonPath)}</pre>
<p>Load this JSON file for full keyword→product→review traceability.</p>
</body>
</html>`;

  const reportPath = join(artifactsDir, "report.html");
  try {
    writeFileSync(reportPath, htmlContent, "utf8");
    return { ok: true, pdfReportPath: reportPath };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      manualRequired: true,
    };
  }
};

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
