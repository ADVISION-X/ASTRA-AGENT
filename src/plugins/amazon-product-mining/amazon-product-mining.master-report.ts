import type { AmazonMasterReportInput } from "./amazon-product-mining.master-report-types.js";

export type { AmazonMasterReportInput } from "./amazon-product-mining.master-report-types.js";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truncateText = (value: string | null | undefined, maxLength: number): string => {
  const text = value ?? "";
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const markdownTextToBulletList = (value: string | null): string[] =>
  value
    ?.split("\n")
    .map((line) => line.replace(/^[-#*\s]+/, "").trim())
    .filter((line) => line.length > 0) ?? [];

const renderBulletList = (items: readonly string[]): string =>
  items.length > 0
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>None.</p>";

const renderTable = (headers: readonly string[], rows: readonly string[][]): string => `
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.length > 0
        ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${String(headers.length)}">No records.</td></tr>`}
    </tbody>
  </table>`;

const buildCoverLines = (input: {
  task: NonNullable<AmazonMasterReportInput["packageData"]>["task"] | Record<string, never>;
  generatedAt: string;
  packageVersion: string;
  boundaryBullets: readonly string[];
}) => [
  "Chapter 1. Cover",
  `Task ID: ${input.task.taskId ?? "unknown"}`,
  `Marketplace: ${input.task.amazonMarketplace ?? "unknown"}`,
  `Target Market: ${input.task.targetMarket ?? "unknown"}`,
  `Product Direction: ${input.task.productDirection ?? "unknown"}`,
  `Language Preference: ${input.task.languagePreference ?? "unknown"}`,
  `Generated At: ${input.generatedAt}`,
  `Package Version: ${input.packageVersion}`,
  "Front Boundary Notice",
  ...input.boundaryBullets,
];

const buildTaskCompletenessLines = (summary: Record<string, unknown>) => [
  "Chapter 3. Task Completeness Overview",
  `Requested Keywords: ${String(summary["keywordCountRequested"] ?? 0)}`,
  `Generated Keywords: ${String(summary["keywordCountGenerated"] ?? 0)}`,
  `Completed Keywords: ${String(summary["keywordCountCompleted"] ?? 0)}`,
  `Search Results: ${String(summary["searchResultCount"] ?? 0)}`,
  `Products: ${String(summary["uniqueProductDetailCount"] ?? 0)}`,
  `Reviews: ${String(summary["reviewCount"] ?? 0)}`,
  `Exceptions: ${String(summary["exceptionCount"] ?? 0)}`,
  `Manual Required Count: ${String(summary["manualRequiredCount"] ?? 0)}`,
  `Failed Count: ${String(summary["failedCount"] ?? 0)}`,
  `Package Completeness Status: ${String(summary["packageCompletenessStatus"] ?? "unknown")}`,
];

const buildAiKeywordRunLines = (runs: NonNullable<AmazonMasterReportInput["packageData"]>["aiKeywordRuns"] | undefined) => [
  "Chapter 4. AI Keyword Runs",
  ...(runs?.map((run) => `Run ${run.runId ?? "unknown"} | status=${run.status ?? "unknown"} | keywords=${(run.dedupedKeywords ?? []).join(", ") || "none"}`) ?? ["No AI keyword runs."]),
];

const buildKeywordOverviewLines = (keywords: NonNullable<AmazonMasterReportInput["packageData"]>["keywords"] | undefined) => [
  "Chapter 5. Keyword Overview",
  ...(keywords?.map((keyword) => `${keyword.keyword ?? "unknown"} | status=${keyword.status ?? "unknown"} | results=${String(keyword.searchResultCount ?? 0)} | sponsored=${String(keyword.sponsoredCount ?? 0)} | organic=${String(keyword.organicCount ?? 0)}`) ?? ["No keywords."]),
];

const buildProductOverviewLines = (products: NonNullable<AmazonMasterReportInput["packageData"]>["products"] | undefined) => [
  "Chapter 7. Product Overview",
  ...(products?.map((product) => `${product.detailId ?? "unknown"} | ${truncateText(product.identity?.title ?? product.asin ?? "unknown product", 72)} | completeness=${String(product.completeness?.score ?? 0)} | reviews=${String(product.reviews?.capturedReviewCount ?? 0)}`) ?? ["No products."]),
];

const buildReviewSummaryLines = (reviewsIndex: NonNullable<AmazonMasterReportInput["packageData"]>["reviewsIndex"] | undefined) => [
  "Chapter 9. Review Summary",
  ...(reviewsIndex?.map((review) => `${review.detailId ?? "unknown"} | reviews=${String(review.capturedReviewCount ?? 0)} | pages=${String(review.pagesVisited ?? 0)} | images=${String(Boolean(review.hasImages))}`) ?? ["No review evidence."]),
];

const buildExceptionLines = (exceptions: NonNullable<AmazonMasterReportInput["exceptionSummary"]>["exceptions"] | undefined) => [
  "Chapter 10. Exceptions and Completeness",
  ...(exceptions?.map((exception) => `${exception.scope ?? "unknown"}/${exception.exceptionKind ?? "unknown"}: ${truncateText(exception.message, 100)}`) ?? ["No exceptions."]),
];

const buildEvidenceIndexLines = (products: NonNullable<AmazonMasterReportInput["evidenceIndex"]>["products"] | undefined) => [
  "Chapter 11. Evidence Index",
  ...(products?.map((product) => `${product.detailId ?? "unknown"} -> ${(product.sourceKeywordIds ?? []).join(", ")} -> ${(product.sourceSearchItemRefs ?? []).join(", ")}`) ?? ["No evidence index entries."]),
];

const renderTaskSummaryGrid = (input: {
  task: NonNullable<AmazonMasterReportInput["packageData"]>["task"] | Record<string, never>;
  generatedAt: string;
  reportVersion: string;
}) => `
    <section class="grid" style="margin-top: 20px;">
      <div class="card"><strong>Task ID</strong><br />${escapeHtml(input.task.taskId ?? "unknown")}</div>
      <div class="card"><strong>Marketplace</strong><br />${escapeHtml(input.task.amazonMarketplace ?? "unknown")}</div>
      <div class="card"><strong>Target Market</strong><br />${escapeHtml(input.task.targetMarket ?? "unknown")}</div>
      <div class="card"><strong>Product Direction</strong><br />${escapeHtml(input.task.productDirection ?? "unknown")}</div>
      <div class="card"><strong>Language Preference</strong><br />${escapeHtml(input.task.languagePreference ?? "unknown")}</div>
      <div class="card"><strong>Generated At</strong><br />${escapeHtml(input.generatedAt)}</div>
      <div class="card"><strong>Package Version</strong><br />${escapeHtml(input.reportVersion)}</div>
    </section>`;

const renderKeywordEvidenceCards = (keywords: NonNullable<AmazonMasterReportInput["evidenceIndex"]>["keywords"] | undefined) =>
  keywords?.map((keyword) => `
        <div class="card">
          <h3>${escapeHtml(keyword.keyword ?? "unknown")}</h3>
          <p><strong>Search Evidence:</strong> ${escapeHtml(keyword.searchEvidenceRef ?? "")}</p>
          <p><strong>Raw Visible Text:</strong> ${escapeHtml(keyword.rawVisibleTextRef ?? "")}</p>
          <p><strong>Search Items:</strong> ${escapeHtml((keyword.searchResultRefs ?? []).join(", ") || "none")}</p>
          <p><strong>Product Details:</strong> ${escapeHtml((keyword.productDetailRefs ?? []).join(", ") || "none")}</p>
        </div>`).join("") || "<p>No keyword evidence.</p>";

const renderProductEvidenceCard = (product: NonNullable<AmazonMasterReportInput["packageData"]>["products"][number]) => `
        <div class="card">
          <h3>${escapeHtml(product.identity?.title ?? product.asin ?? product.detailId ?? "unknown product")}</h3>
          <p><strong>A. Product Identity:</strong> ${escapeHtml(product.detailId ?? "unknown")} / ${escapeHtml(product.asin ?? "n/a")} / ${escapeHtml(product.identity?.brand ?? "n/a")}</p>
          <p><strong>B. Image Evidence:</strong> main=${escapeHtml(product.images?.mainImageUrl ?? "n/a")} | gallery=${String(product.images?.galleryImageUrls?.length ?? 0)}</p>
          <p><strong>C. Source Keywords:</strong> ${escapeHtml((product.sourceKeywords ?? []).map((keyword) => `${keyword.keyword ?? "unknown"}@${String(keyword.rankPosition ?? 0)}`).join(", ") || "none")}</p>
          <p><strong>D. Commerce:</strong> price=${escapeHtml(product.commerce?.currentPrice ?? "n/a")} | rating=${escapeHtml(product.commerce?.rating ?? "n/a")} | reviewCount=${escapeHtml(product.commerce?.reviewCount ?? "n/a")}</p>
          <p><strong>E. Listing:</strong> ${escapeHtml(((product.listing?.bulletPoints ?? []).join(" | ")) || product.listing?.productDescription || product.listing?.aboutThisItem || "n/a")}</p>
          <p><strong>F. Parameters:</strong> ${escapeHtml(product.parameters?.technicalDetails ?? product.parameters?.productInformation ?? product.parameters?.additionalInformation ?? "n/a")}</p>
          <p><strong>G. Related Modules:</strong> ${escapeHtml(product.relatedModules?.customersAlsoBoughtIfVisible ?? product.relatedModules?.compareWithSimilarItemsIfVisible ?? "n/a")}</p>
          <p><strong>H. Review Summary:</strong> captured=${String(product.reviews?.capturedReviewCount ?? 0)} | pages=${String(product.reviews?.pagesVisited ?? 0)} | summaryRef=${escapeHtml(product.reviews?.summaryRef ?? "")}</p>
          <p><strong>I. Representative Review Evidence:</strong> JSONL=${escapeHtml(product.reviews?.jsonlRef ?? "")} | pagesIndex=${escapeHtml(product.reviews?.reviewPagesIndexRef ?? "")}</p>
          <p><strong>J. Completeness & Exceptions:</strong> score=${String(product.completeness?.score ?? 0)} | missing=${escapeHtml((product.completeness?.missingFields ?? []).join(", ") || "none")} | warnings=${escapeHtml((product.completeness?.warnings ?? []).join(" | ") || "none")}</p>
          <p><strong>K. Evidence Refs:</strong> raw=${escapeHtml(product.rawVisibleTextRef ?? "")} | reviewSummary=${escapeHtml(product.reviews?.summaryRef ?? "")} | exceptions=${escapeHtml((product.exceptions ?? []).join(", ") || "none")}</p>
        </div>`;

const renderProductEvidenceCards = (products: NonNullable<AmazonMasterReportInput["packageData"]>["products"] | undefined) =>
  products?.map((product) => renderProductEvidenceCard(product)).join("") || "<p>No products.</p>";

const renderCompletenessSection = (input: {
  exceptions: NonNullable<AmazonMasterReportInput["exceptionSummary"]>["exceptions"];
  products: NonNullable<AmazonMasterReportInput["completenessReport"]>["products"];
}) => `
    <section class="panel section-stack">
      <h2>Chapter 10. Exceptions & Completeness</h2>
      ${renderTable(
        ["Scope", "Scope ID", "Kind", "Message"],
        input.exceptions.map((exception) => [
          exception.scope ?? "unknown",
          exception.scopeId ?? "",
          exception.exceptionKind ?? "unknown",
          truncateText(exception.message, 120),
        ]),
      )}
      ${renderTable(
        ["Detail ID", "Review Status", "Pages Visited", "Restriction", "Missing Fields", "Completeness Score"],
        input.products.map((product) => [
          product.detailId ?? "unknown",
          product.reviewStatus ?? "unknown",
          String(product.reviewPagesVisited ?? 0),
          product.reviewRestriction ?? "none",
          (product.missingFields ?? []).join(", ") || "none",
          String(product.dataCompletenessScore ?? 0),
        ]),
      )}
    </section>`;

const renderEvidenceIndexSection = (input: {
  artifacts: NonNullable<AmazonMasterReportInput["evidenceIndex"]>["artifacts"];
  checks: NonNullable<AmazonMasterReportInput["integrityReport"]>["checks"];
}) => `
    <section class="panel section-stack">
      <h2>Chapter 11. Evidence Index</h2>
      ${renderTable(
        ["Artifact ID", "Type", "File Ref"],
        input.artifacts.map((artifact) => [artifact.artifactId ?? "unknown", artifact.type ?? "unknown", artifact.fileRef ?? ""]),
      )}
      ${renderTable(
        ["Integrity Check", "Status", "Detail"],
        input.checks.map((check) => [check.checkId ?? "unknown", check.status ?? "unknown", check.detail ?? ""]),
      )}
    </section>`;

export const buildAmazonMasterReportLines = (input: AmazonMasterReportInput): string[] => {
  const task = input.packageData?.task ?? {};
  const summary = input.completenessReport?.summary ?? {};
  const boundaryBullets = markdownTextToBulletList(input.businessBoundaryNoticeText);
  return [
    "Amazon Product Mining Master Evidence Report",
    ...buildCoverLines({
      task,
      generatedAt: input.packageData?.generatedAt ?? input.generatedAt,
      packageVersion: input.packageData?.schemaVersion ?? "2.0.0",
      boundaryBullets,
    }),
    "Chapter 2. AI Reading Contract",
    ...markdownTextToBulletList(input.aiReadingContractText),
    ...buildTaskCompletenessLines(summary),
    ...buildAiKeywordRunLines(input.packageData?.aiKeywordRuns),
    ...buildKeywordOverviewLines(input.packageData?.keywords),
    ...buildProductOverviewLines(input.packageData?.products),
    ...buildReviewSummaryLines(input.packageData?.reviewsIndex),
    ...buildExceptionLines(input.exceptionSummary?.exceptions),
    ...buildEvidenceIndexLines(input.evidenceIndex?.products),
    "Chapter 12. Advanced AI Usage Guidance",
    "Allowed outputs: completeness-high products, user pain points, data gaps, risks, next-stage validation checklist.",
    "Forbidden outputs: final procurement, inventory, ads, guaranteed claims, profit certainty, winning-product certainty.",
    "Business Boundary Notice",
    ...boundaryBullets,
  ];
};

export const buildAmazonMasterReportHtml = (input: AmazonMasterReportInput): string => {
  const task = input.packageData?.task ?? {};
  const summary = input.completenessReport?.summary ?? {};
  const reportVersion = input.packageData?.schemaVersion ?? "2.0.0";
  const contractBullets = markdownTextToBulletList(input.aiReadingContractText);
  const boundaryBullets = markdownTextToBulletList(input.businessBoundaryNoticeText);
  const integrityChecks = input.integrityReport?.checks ?? [];
  const evidenceArtifacts = input.evidenceIndex?.artifacts ?? [];
  const keywords = input.packageData?.keywords ?? [];
  const products = input.packageData?.products ?? [];
  const reviewsIndex = input.packageData?.reviewsIndex ?? [];
  const exceptions = input.exceptionSummary?.exceptions ?? [];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Amazon Product Mining Master Evidence Report</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Georgia, "Iowan Old Style", serif;
        background: #f5efe1;
        color: #1f2933;
      }
      body {
        margin: 0;
        padding: 32px;
        background:
          radial-gradient(circle at top left, rgba(167, 123, 64, 0.16), transparent 40%),
          linear-gradient(180deg, #f5efe1 0%, #fcfaf5 100%);
      }
      h1, h2, h3 {
        margin: 0 0 16px;
      }
      h1 {
        font-size: 34px;
      }
      h2 {
        font-size: 22px;
        margin-top: 28px;
      }
      h3 {
        font-size: 18px;
        margin-top: 20px;
      }
      p, li, td, th {
        line-height: 1.6;
        font-size: 14px;
      }
      .hero, .panel, .card {
        background: rgba(255, 255, 255, 0.84);
        border: 1px solid rgba(94, 71, 38, 0.14);
        border-radius: 18px;
        padding: 18px;
        border: 1px solid rgba(41, 28, 12, 0.08);
      }
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 10px 8px;
        border-bottom: 1px solid rgba(94, 71, 38, 0.12);
        vertical-align: top;
      }
      .section-stack {
        display: grid;
        gap: 16px;
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>Amazon Product Mining Master Evidence Report</h1>
      <p>This report is the primary reading entrance for advanced AI and human reviewers. The structured package, evidence index, completeness report, and integrity report remain the source of truth.</p>
    </section>

    ${renderTaskSummaryGrid({
      task,
      generatedAt: input.packageData?.generatedAt ?? input.generatedAt,
      reportVersion,
    })}

    <section class="panel section-stack">
      <h2>Front Boundary Notice</h2>
      ${renderBulletList(boundaryBullets)}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 2. AI Reading Contract</h2>
      ${renderBulletList(contractBullets)}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 3. Task Completeness Overview</h2>
      <div class="grid">
        <div class="card"><strong>Requested Keywords</strong><br />${String(summary.keywordCountRequested ?? 0)}</div>
        <div class="card"><strong>Generated Keywords</strong><br />${String(summary.keywordCountGenerated ?? 0)}</div>
        <div class="card"><strong>Completed Keywords</strong><br />${String(summary.keywordCountCompleted ?? 0)}</div>
        <div class="card"><strong>Search Results</strong><br />${String(summary.searchResultCount ?? 0)}</div>
        <div class="card"><strong>Products</strong><br />${String(summary.uniqueProductDetailCount ?? 0)}</div>
        <div class="card"><strong>Reviews</strong><br />${String(summary.reviewCount ?? 0)}</div>
        <div class="card"><strong>Exceptions</strong><br />${String(summary.exceptionCount ?? 0)}</div>
        <div class="card"><strong>Manual Required</strong><br />${String(summary.manualRequiredCount ?? 0)}</div>
        <div class="card"><strong>Failed</strong><br />${String(summary.failedCount ?? 0)}</div>
        <div class="card"><strong>Package Status</strong><br />${escapeHtml(summary.packageCompletenessStatus ?? "unknown")}</div>
      </div>
    </section>

    <section class="panel section-stack">
      <h2>Chapter 4. AI Keyword Generation Record</h2>
      ${renderTable(
        ["Run", "Status", "Parsed Keywords", "Deduped Keywords", "Prompt Ref", "Raw Ref"],
        (input.packageData?.aiKeywordRuns ?? []).map((run) => [
          run.runId ?? "unknown",
          run.status ?? "unknown",
          (run.parsedKeywords ?? []).join(", ") || "none",
          (run.dedupedKeywords ?? []).join(", ") || "none",
          run.promptTextRef ?? "",
          run.rawResponseRef ?? "",
        ]),
      )}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 5. Keyword Overview</h2>
      ${renderTable(
        ["Keyword", "Status", "Search URL", "Visible Products", "Sponsored", "Organic", "Top Products", "Exceptions"],
        keywords.map((keyword) => [
          keyword.keyword ?? "unknown",
          keyword.status ?? "unknown",
          keyword.searchUrl ?? "",
          String(keyword.searchResultCount ?? 0),
          String(keyword.sponsoredCount ?? 0),
          String(keyword.organicCount ?? 0),
          (keyword.topProducts ?? []).map((product) => `${product.rankPosition ?? "?"}:${truncateText(product.title ?? product.asinIfAvailable ?? "unknown", 32)}`).join(" | ") || "none",
          (keyword.exceptionRefs ?? []).join(", ") || "none",
        ]),
      )}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 6. Keyword Search Evidence</h2>
      ${renderKeywordEvidenceCards(input.evidenceIndex?.keywords)}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 7. Product Overview</h2>
      ${renderTable(
        ["Detail ID", "ASIN", "Title", "Brand", "Price", "Rating", "Review Count", "Keywords", "Completeness", "Exceptions"],
        products.map((product) => [
          product.detailId ?? "unknown",
          product.asin ?? "",
          product.identity?.title ?? "",
          product.identity?.brand ?? "",
          product.commerce?.currentPrice ?? "",
          product.commerce?.rating ?? "",
          product.commerce?.reviewCount ?? "",
          (product.sourceKeywords ?? []).map((keyword) => keyword.keyword ?? "unknown").join(", ") || "none",
          String(product.completeness?.score ?? 0),
          (product.exceptions ?? []).join(", ") || "none",
        ]),
      )}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 8. Product Evidence Cards</h2>
      ${renderProductEvidenceCards(products)}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 9. Review Summary</h2>
      ${renderTable(
        ["Detail ID", "ASIN", "Reviews", "Pages", "Has Images", "Has Videos", "Summary Ref", "JSONL Ref"],
        reviewsIndex.map((review) => [
          review.detailId ?? "unknown",
          review.asin ?? "",
          String(review.capturedReviewCount ?? 0),
          String(review.pagesVisited ?? 0),
          String(Boolean(review.hasImages)),
          String(Boolean(review.hasVideos)),
          review.reviewsSummaryRef ?? "",
          review.reviewsJsonlRef ?? "",
        ]),
      )}
    </section>

    ${renderCompletenessSection({
      exceptions,
      products: input.completenessReport?.products ?? [],
    })}

    ${renderEvidenceIndexSection({
      artifacts: evidenceArtifacts,
      checks: integrityChecks,
    })}

    <section class="panel section-stack">
      <h2>Chapter 12. Advanced AI Usage Guidance</h2>
      ${renderBulletList([
        "Allowed outputs: products with higher evidence completeness, visible user pain-point evidence, data gaps, risk points, and next-stage validation checklist.",
        "Forbidden outputs: final procurement recommendation, inventory recommendation, ad-spend recommendation, guaranteed product quality, guaranteed compliance, guaranteed profit, or deterministic promotion claims.",
      ])}
    </section>

    <section class="panel section-stack">
      <h2>Business Boundary Notice</h2>
      ${renderBulletList(boundaryBullets)}
    </section>
  </body>
</html>`;
};