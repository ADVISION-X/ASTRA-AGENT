import type { AmazonMasterReportInput } from "./amazon-product-mining.master-report-types.js";
import { renderAmazonMasterReportHtmlDocument } from "./amazon-product-mining.master-report-shell.js";

export type { AmazonMasterReportInput } from "./amazon-product-mining.master-report-types.js";

type ReportTask = Partial<NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["task"]>>;
type ReportKeyword = NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["keywords"]>[number];
type ReportProduct = NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["products"]>[number];
type ReportSourceKeyword = NonNullable<ReportProduct["sourceKeywords"]>[number];
type ReportReviewIndex = NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["reviewsIndex"]>[number];
type ReportException = NonNullable<NonNullable<AmazonMasterReportInput["exceptionSummary"]>["exceptions"]>[number];
type EvidenceIndexKeyword = NonNullable<NonNullable<AmazonMasterReportInput["evidenceIndex"]>["keywords"]>[number];
type EvidenceIndexProduct = NonNullable<NonNullable<AmazonMasterReportInput["evidenceIndex"]>["products"]>[number];
type EvidenceArtifact = NonNullable<NonNullable<AmazonMasterReportInput["evidenceIndex"]>["artifacts"]>[number];
type IntegrityCheck = NonNullable<NonNullable<AmazonMasterReportInput["integrityReport"]>["checks"]>[number];
type CompletenessProduct = NonNullable<NonNullable<AmazonMasterReportInput["completenessReport"]>["products"]>[number];

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

const formatFieldList = (fields: readonly string[] | null | undefined): string =>
  (fields ?? []).join(", ") || "none";

const formatCompletenessBuckets = (completeness: ReportProduct["completeness"] | undefined): string => [
  `missing=${formatFieldList(completeness?.missingFields)}`,
  `notPresent=${formatFieldList(completeness?.notPresentFields)}`,
  `blocked=${formatFieldList(completeness?.blockedFields)}`,
  `unsupported=${formatFieldList(completeness?.unsupportedFields)}`,
  `extractorMissing=${formatFieldList(completeness?.extractorMissingFields)}`,
  `manualRequired=${formatFieldList(completeness?.manualRequiredFields)}`,
  `failed=${formatFieldList(completeness?.failedFields)}`,
].join(" | ");

const readSummaryValue = (summary: Record<string, unknown>, key: string, defaultValue: string): string => {
  const value = summary[key];
  return typeof value === "string" ? value : value == null ? defaultValue : String(value);
};

const buildCoverLines = (input: {
  task: ReportTask;
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

const buildAiKeywordRunLines = (runs: readonly NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["aiKeywordRuns"]>[number][] | undefined) => [
  "Chapter 4. AI Keyword Runs",
  ...(runs?.map((run) => `Run ${run.runId ?? "unknown"} | status=${run.status ?? "unknown"} | keywords=${(run.dedupedKeywords ?? []).join(", ") || "none"}`) ?? ["No AI keyword runs."]),
];

const buildKeywordOverviewLines = (keywords: readonly ReportKeyword[] | undefined) => [
  "Chapter 5. Keyword Overview",
  ...(keywords?.map((keyword) => `${keyword.keyword ?? "unknown"} | status=${keyword.status ?? "unknown"} | results=${String(keyword.searchResultCount ?? 0)} | sponsored=${String(keyword.sponsoredCount ?? 0)} | organic=${String(keyword.organicCount ?? 0)}`) ?? ["No keywords."]),
];

const buildProductOverviewLines = (products: readonly ReportProduct[] | undefined) => [
  "Chapter 7. Product Overview",
  ...(products?.map((product) => `${product.detailId ?? "unknown"} | ${truncateText(product.identity?.title ?? product.asin ?? "unknown product", 72)} | completeness=${String(product.completeness?.score ?? 0)} | reviews=${String(product.reviews?.capturedReviewCount ?? 0)}`) ?? ["No products."]),
];

const buildReviewSummaryLines = (reviewsIndex: readonly ReportReviewIndex[] | undefined) => [
  "Chapter 9. Review Summary",
  ...(reviewsIndex?.map((review) => `${review.detailId ?? "unknown"} | reviews=${String(review.capturedReviewCount ?? 0)} | pages=${String(review.pagesVisited ?? 0)} | images=${String(Boolean(review.hasImages))}`) ?? ["No review evidence."]),
];

const buildExceptionLines = (exceptions: readonly ReportException[] | undefined) => [
  "Chapter 10. Exceptions and Completeness",
  ...(exceptions?.map((exception) => `${exception.scope ?? "unknown"}/${exception.exceptionKind ?? "unknown"}: ${truncateText(exception.message, 100)}`) ?? ["No exceptions."]),
];

const buildEvidenceIndexLines = (products: readonly EvidenceIndexProduct[] | undefined) => [
  "Chapter 11. Evidence Index",
  ...(products?.map((product) => `${product.detailId ?? "unknown"} -> ${(product.sourceKeywordIds ?? []).join(", ")} -> ${(product.sourceSearchItemRefs ?? []).join(", ")}`) ?? ["No evidence index entries."]),
];

const renderTaskSummaryGrid = (input: {
  task: ReportTask;
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

const renderKeywordEvidenceCards = (keywords: readonly EvidenceIndexKeyword[] | undefined) =>
  keywords?.map((keyword) => `
        <div class="card">
          <h3>${escapeHtml(keyword.keyword ?? "unknown")}</h3>
          <p><strong>Search Evidence:</strong> ${escapeHtml(keyword.searchEvidenceRef ?? "")}</p>
          <p><strong>Raw Visible Text:</strong> ${escapeHtml(keyword.rawVisibleTextRef ?? "")}</p>
          <p><strong>Search Items:</strong> ${escapeHtml((keyword.searchResultRefs ?? []).join(", ") || "none")}</p>
          <p><strong>Product Details:</strong> ${escapeHtml((keyword.productDetailRefs ?? []).join(", ") || "none")}</p>
        </div>`).join("") || "<p>No keyword evidence.</p>";

const formatSourceKeywords = (keywords: readonly ReportSourceKeyword[] | undefined): string =>
  (keywords ?? []).map((keyword) => `${keyword.keyword ?? "unknown"}@${String(keyword.rankPosition ?? 0)}`).join(", ") || "none";

const buildProductIdentityParagraphs = (product: ReportProduct): string[] => [
  `<strong>A. Product Identity:</strong> ${escapeHtml(product.detailId ?? "unknown")} / ${escapeHtml(product.asin ?? "n/a")} / ${escapeHtml(product.identity?.brand ?? "n/a")}`,
  `<strong>B. Image Evidence:</strong> main=${escapeHtml(product.images?.mainImageUrl ?? "n/a")} | gallery=${String(product.images?.galleryImageUrls?.length ?? 0)}`,
  `<strong>C. Source Keywords:</strong> ${escapeHtml(formatSourceKeywords(product.sourceKeywords))}`,
  `<strong>D. Commerce:</strong> price=${escapeHtml(product.commerce?.currentPrice ?? "n/a")} | rating=${escapeHtml(product.commerce?.rating ?? "n/a")} | reviewCount=${escapeHtml(product.commerce?.reviewCount ?? "n/a")}`,
];

const resolveProductListingText = (product: ReportProduct): string =>
  ((product.listing?.bulletPoints ?? []).join(" | ")) || product.listing?.productDescription || product.listing?.aboutThisItem || "n/a";

const resolveProductParameterText = (product: ReportProduct): string =>
  product.parameters?.technicalDetails ?? product.parameters?.productInformation ?? product.parameters?.additionalInformation ?? "n/a";

const resolveProductRelatedModulesText = (product: ReportProduct): string =>
  product.relatedModules?.customersAlsoBoughtIfVisible ?? product.relatedModules?.compareWithSimilarItemsIfVisible ?? "n/a";

const buildProductListingParagraphs = (product: ReportProduct): string[] => [
  `<strong>E. Listing:</strong> ${escapeHtml(resolveProductListingText(product))}`,
  `<strong>F. Parameters:</strong> ${escapeHtml(resolveProductParameterText(product))}`,
  `<strong>G. Related Modules:</strong> ${escapeHtml(resolveProductRelatedModulesText(product))}`,
];

const buildProductReviewParagraphs = (product: ReportProduct): string[] => [
  `<strong>H. Review Summary:</strong> captured=${String(product.reviews?.capturedReviewCount ?? 0)} | pages=${String(product.reviews?.pagesVisited ?? 0)} | summaryRef=${escapeHtml(product.reviews?.summaryRef ?? "")}`,
  `<strong>I. Representative Review Evidence:</strong> JSONL=${escapeHtml(product.reviews?.jsonlRef ?? "")} | pagesIndex=${escapeHtml(product.reviews?.reviewPagesIndexRef ?? "")}`,
  `<strong>J. Completeness & Exceptions:</strong> score=${String(product.completeness?.score ?? 0)} | ${escapeHtml(formatCompletenessBuckets(product.completeness))} | warnings=${escapeHtml((product.completeness?.warnings ?? []).join(" | ") || "none")}`,
  `<strong>K. Evidence Refs:</strong> raw=${escapeHtml(product.rawVisibleTextRef ?? "")} | reviewSummary=${escapeHtml(product.reviews?.summaryRef ?? "")} | exceptions=${escapeHtml((product.exceptions ?? []).join(", ") || "none")}`,
];

const buildProductEvidenceParagraphs = (product: ReportProduct): string[] => [
  ...buildProductIdentityParagraphs(product),
  ...buildProductListingParagraphs(product),
  ...buildProductReviewParagraphs(product),
];

const renderProductEvidenceCard = (product: ReportProduct) => `
        <div class="card">
          <h3>${escapeHtml(product.identity?.title ?? product.asin ?? product.detailId ?? "unknown product")}</h3>
          ${buildProductEvidenceParagraphs(product).map((paragraph) => `<p>${paragraph}</p>`).join("")}
        </div>`;

const renderProductEvidenceCards = (products: readonly ReportProduct[] | undefined) =>
  products?.map((product) => renderProductEvidenceCard(product)).join("") || "<p>No products.</p>";

const renderCompletenessSection = (input: {
  exceptions: readonly ReportException[];
  products: readonly CompletenessProduct[];
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
        ["Detail ID", "Review Status", "Pages Visited", "Restriction", "Missing Fields", "Not Present Fields", "Blocked Fields", "Unsupported Fields", "Extractor Missing Fields", "Manual/Failed Fields", "Completeness Score"],
        input.products.map((product) => [
          product.detailId ?? "unknown",
          product.reviewStatus ?? "unknown",
          String(product.reviewPagesVisited ?? 0),
          product.reviewRestriction ?? "none",
          formatFieldList(product.missingFields),
          formatFieldList(product.notPresentFields),
          formatFieldList(product.blockedFields),
          formatFieldList(product.unsupportedFields),
          formatFieldList(product.extractorMissingFields),
          formatFieldList([...(product.manualRequiredFields ?? []), ...(product.failedFields ?? [])]),
          String(product.dataCompletenessScore ?? 0),
        ]),
      )}
    </section>`;

const renderEvidenceIndexSection = (input: {
  artifacts: readonly EvidenceArtifact[];
  checks: readonly IntegrityCheck[];
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

const renderCompletenessOverviewSection = (summary: Record<string, unknown>): string => `
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
        <div class="card"><strong>Package Status</strong><br />${escapeHtml(readSummaryValue(summary, "packageCompletenessStatus", "unknown"))}</div>
      </div>
    </section>`;

const renderAiKeywordRunSection = (
  runs: readonly NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["aiKeywordRuns"]>[number][],
): string => `
    <section class="panel section-stack">
      <h2>Chapter 4. AI Keyword Generation Record</h2>
      ${renderTable(
        ["Run", "Status", "Parsed Keywords", "Deduped Keywords", "Prompt Ref", "Raw Ref"],
        runs.map((run) => [
          run.runId ?? "unknown",
          run.status ?? "unknown",
          (run.parsedKeywords ?? []).join(", ") || "none",
          (run.dedupedKeywords ?? []).join(", ") || "none",
          run.promptTextRef ?? "",
          run.rawResponseRef ?? "",
        ]),
      )}
    </section>`;

const renderKeywordOverviewSection = (keywords: readonly ReportKeyword[]): string => `
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
    </section>`;

const renderProductOverviewSection = (products: readonly ReportProduct[]): string => `
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
    </section>`;

const renderReviewSummarySection = (reviewsIndex: readonly ReportReviewIndex[]): string => `
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
    </section>`;

const buildMasterReportBodyInput = (input: AmazonMasterReportInput) => ({
  task: input.packageData?.task ?? {},
  generatedAt: input.packageData?.generatedAt ?? input.generatedAt,
  reportVersion: input.packageData?.schemaVersion ?? "2.0.0",
  summary: input.completenessReport?.summary ?? {},
  contractBullets: markdownTextToBulletList(input.aiReadingContractText),
  boundaryBullets: markdownTextToBulletList(input.businessBoundaryNoticeText),
  runs: input.packageData?.aiKeywordRuns ?? [],
  keywords: input.packageData?.keywords ?? [],
  products: input.packageData?.products ?? [],
  reviewsIndex: input.packageData?.reviewsIndex ?? [],
  exceptions: input.exceptionSummary?.exceptions ?? [],
  evidenceArtifacts: input.evidenceIndex?.artifacts ?? [],
  integrityChecks: input.integrityReport?.checks ?? [],
});

const renderMasterReportBody = (input: {
  task: ReportTask;
  generatedAt: string;
  reportVersion: string;
  summary: Record<string, unknown>;
  contractBullets: readonly string[];
  boundaryBullets: readonly string[];
  runs: readonly NonNullable<NonNullable<AmazonMasterReportInput["packageData"]>["aiKeywordRuns"]>[number][];
  keywords: readonly ReportKeyword[];
  products: readonly ReportProduct[];
  reviewsIndex: readonly ReportReviewIndex[];
  exceptions: readonly ReportException[];
  evidenceArtifacts: readonly EvidenceArtifact[];
  integrityChecks: readonly IntegrityCheck[];
}): string => [
  `
    <section class="hero">
      <h1>Amazon Product Mining Master Evidence Report</h1>
      <p>This report is the primary reading entrance for advanced AI and human reviewers. The structured package, evidence index, completeness report, and integrity report remain the source of truth.</p>
    </section>`,
  renderTaskSummaryGrid({ task: input.task, generatedAt: input.generatedAt, reportVersion: input.reportVersion }),
  `
    <section class="panel section-stack">
      <h2>Front Boundary Notice</h2>
      ${renderBulletList(input.boundaryBullets)}
    </section>`,
  `
    <section class="panel section-stack">
      <h2>Chapter 2. AI Reading Contract</h2>
      ${renderBulletList(input.contractBullets)}
    </section>`,
  renderCompletenessOverviewSection(input.summary),
  renderAiKeywordRunSection(input.runs),
  renderKeywordOverviewSection(input.keywords),
  `
    <section class="panel section-stack">
      <h2>Chapter 6. Keyword Search Evidence</h2>
      ${renderKeywordEvidenceCards(input.keywords)}
    </section>`,
  renderProductOverviewSection(input.products),
  `
    <section class="panel section-stack">
      <h2>Chapter 8. Product Evidence Cards</h2>
      ${renderProductEvidenceCards(input.products)}
    </section>`,
  renderReviewSummarySection(input.reviewsIndex),
  renderCompletenessSection({ exceptions: input.exceptions, products: input.products.map((product) => ({
    detailId: product.detailId,
    reviewStatus: product.completeness?.reviewStatus ?? product.reviews?.summaryRef ?? null,
    reviewPagesVisited: product.reviews?.pagesVisited ?? 0,
    reviewRestriction: null,
    missingFields: product.completeness?.missingFields ?? [],
    notPresentFields: product.completeness?.notPresentFields ?? [],
    blockedFields: product.completeness?.blockedFields ?? [],
    unsupportedFields: product.completeness?.unsupportedFields ?? [],
    manualRequiredFields: product.completeness?.manualRequiredFields ?? [],
    failedFields: product.completeness?.failedFields ?? [],
    extractorMissingFields: product.completeness?.extractorMissingFields ?? [],
    dataCompletenessScore: product.completeness?.score ?? 0,
  })) as readonly CompletenessProduct[] }),
  renderEvidenceIndexSection({ artifacts: input.evidenceArtifacts, checks: input.integrityChecks }),
  `
    <section class="panel section-stack">
      <h2>Chapter 12. Advanced AI Usage Guidance</h2>
      ${renderBulletList([
        "Allowed outputs: products with higher evidence completeness, visible user pain-point evidence, data gaps, risk points, and next-stage validation checklist.",
        "Forbidden outputs: final procurement recommendation, inventory recommendation, ad-spend recommendation, guaranteed product quality, guaranteed compliance, guaranteed profit, or deterministic promotion claims.",
      ])}
    </section>`,
  `
    <section class="panel section-stack">
      <h2>Business Boundary Notice</h2>
      ${renderBulletList(input.boundaryBullets)}
    </section>`,
].join("\n");

export const buildAmazonMasterReportLines = (input: AmazonMasterReportInput): string[] => {
  const task: ReportTask = input.packageData?.task ?? {};
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
  return renderAmazonMasterReportHtmlDocument(renderMasterReportBody(buildMasterReportBodyInput(input)));
};