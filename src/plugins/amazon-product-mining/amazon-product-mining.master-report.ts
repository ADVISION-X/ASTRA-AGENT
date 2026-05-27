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

export const buildAmazonMasterReportLines = (input: AmazonMasterReportInput): string[] => {
  const task = input.packageData?.task ?? {};
  const summary = input.completenessReport?.summary ?? {};
  const boundaryBullets = markdownTextToBulletList(input.businessBoundaryNoticeText);
  return [
    "Amazon Product Mining Master Evidence Report",
    "Chapter 1. Cover",
    `Task ID: ${task.taskId ?? "unknown"}`,
    `Marketplace: ${task.amazonMarketplace ?? "unknown"}`,
    `Target Market: ${task.targetMarket ?? "unknown"}`,
    `Product Direction: ${task.productDirection ?? "unknown"}`,
    `Language Preference: ${task.languagePreference ?? "unknown"}`,
    `Generated At: ${input.packageData?.generatedAt ?? input.generatedAt}`,
    `Package Version: ${input.packageData?.schemaVersion ?? "2.0.0"}`,
    "Front Boundary Notice",
    ...boundaryBullets,
    "Chapter 2. AI Reading Contract",
    ...markdownTextToBulletList(input.aiReadingContractText),
    "Chapter 3. Task Completeness Overview",
    `Requested Keywords: ${String(summary.keywordCountRequested ?? 0)}`,
    `Generated Keywords: ${String(summary.keywordCountGenerated ?? 0)}`,
    `Completed Keywords: ${String(summary.keywordCountCompleted ?? 0)}`,
    `Search Results: ${String(summary.searchResultCount ?? 0)}`,
    `Products: ${String(summary.uniqueProductDetailCount ?? 0)}`,
    `Reviews: ${String(summary.reviewCount ?? 0)}`,
    `Exceptions: ${String(summary.exceptionCount ?? 0)}`,
    `Manual Required Count: ${String(summary.manualRequiredCount ?? 0)}`,
    `Failed Count: ${String(summary.failedCount ?? 0)}`,
    `Package Completeness Status: ${summary.packageCompletenessStatus ?? "unknown"}`,
    "Chapter 4. AI Keyword Runs",
    ...(input.packageData?.aiKeywordRuns?.map((run) => `Run ${run.runId ?? "unknown"} | status=${run.status ?? "unknown"} | keywords=${(run.dedupedKeywords ?? []).join(", ") || "none"}`) ?? ["No AI keyword runs."]),
    "Chapter 5. Keyword Overview",
    ...(input.packageData?.keywords?.map((keyword) => `${keyword.keyword ?? "unknown"} | status=${keyword.status ?? "unknown"} | results=${String(keyword.searchResultCount ?? 0)} | sponsored=${String(keyword.sponsoredCount ?? 0)} | organic=${String(keyword.organicCount ?? 0)}`) ?? ["No keywords."]),
    "Chapter 7. Product Overview",
    ...(input.packageData?.products?.map((product) => `${product.detailId ?? "unknown"} | ${truncateText(product.identity?.title ?? product.asin ?? "unknown product", 72)} | completeness=${String(product.completeness?.score ?? 0)} | reviews=${String(product.reviews?.capturedReviewCount ?? 0)}`) ?? ["No products."]),
    "Chapter 9. Review Summary",
    ...(input.packageData?.reviewsIndex?.map((review) => `${review.detailId ?? "unknown"} | reviews=${String(review.capturedReviewCount ?? 0)} | pages=${String(review.pagesVisited ?? 0)} | images=${String(Boolean(review.hasImages))}`) ?? ["No review evidence."]),
    "Chapter 10. Exceptions and Completeness",
    ...(input.exceptionSummary?.exceptions?.map((exception) => `${exception.scope ?? "unknown"}/${exception.exceptionKind ?? "unknown"}: ${truncateText(exception.message, 100)}`) ?? ["No exceptions."]),
    "Chapter 11. Evidence Index",
    ...(input.evidenceIndex?.products?.map((product) => `${product.detailId ?? "unknown"} -> ${(product.sourceKeywordIds ?? []).join(", ")} -> ${(product.sourceSearchItemRefs ?? []).join(", ")}`) ?? ["No evidence index entries."]),
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

    <section class="grid" style="margin-top: 20px;">
      <div class="card"><strong>Task ID</strong><br />${escapeHtml(task.taskId ?? "unknown")}</div>
      <div class="card"><strong>Marketplace</strong><br />${escapeHtml(task.amazonMarketplace ?? "unknown")}</div>
      <div class="card"><strong>Target Market</strong><br />${escapeHtml(task.targetMarket ?? "unknown")}</div>
      <div class="card"><strong>Product Direction</strong><br />${escapeHtml(task.productDirection ?? "unknown")}</div>
      <div class="card"><strong>Language Preference</strong><br />${escapeHtml(task.languagePreference ?? "unknown")}</div>
      <div class="card"><strong>Generated At</strong><br />${escapeHtml(input.packageData?.generatedAt ?? input.generatedAt)}</div>
      <div class="card"><strong>Package Version</strong><br />${escapeHtml(reportVersion)}</div>
    </section>

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
      ${(input.evidenceIndex?.keywords ?? []).map((keyword) => `
        <div class="card">
          <h3>${escapeHtml(keyword.keyword ?? "unknown")}</h3>
          <p><strong>Search Evidence:</strong> ${escapeHtml(keyword.searchEvidenceRef ?? "")}</p>
          <p><strong>Raw Visible Text:</strong> ${escapeHtml(keyword.rawVisibleTextRef ?? "")}</p>
          <p><strong>Search Items:</strong> ${escapeHtml((keyword.searchResultRefs ?? []).join(", ") || "none")}</p>
          <p><strong>Product Details:</strong> ${escapeHtml((keyword.productDetailRefs ?? []).join(", ") || "none")}</p>
        </div>`).join("") || "<p>No keyword evidence.</p>"}
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
      ${products.map((product) => `
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
        </div>`).join("") || "<p>No products.</p>"}
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

    <section class="panel section-stack">
      <h2>Chapter 10. Exceptions & Completeness</h2>
      ${renderTable(
        ["Scope", "Scope ID", "Kind", "Message"],
        exceptions.map((exception) => [
          exception.scope ?? "unknown",
          exception.scopeId ?? "",
          exception.exceptionKind ?? "unknown",
          truncateText(exception.message, 120),
        ]),
      )}
      ${renderTable(
        ["Detail ID", "Review Status", "Pages Visited", "Restriction", "Missing Fields", "Completeness Score"],
        (input.completenessReport?.products ?? []).map((product) => [
          product.detailId ?? "unknown",
          product.reviewStatus ?? "unknown",
          String(product.reviewPagesVisited ?? 0),
          product.reviewRestriction ?? "none",
          (product.missingFields ?? []).join(", ") || "none",
          String(product.dataCompletenessScore ?? 0),
        ]),
      )}
    </section>

    <section class="panel section-stack">
      <h2>Chapter 11. Evidence Index</h2>
      ${renderTable(
        ["Artifact ID", "Type", "File Ref"],
        evidenceArtifacts.map((artifact) => [artifact.artifactId ?? "unknown", artifact.type ?? "unknown", artifact.fileRef ?? ""]),
      )}
      ${renderTable(
        ["Integrity Check", "Status", "Detail"],
        integrityChecks.map((check) => [check.checkId ?? "unknown", check.status ?? "unknown", check.detail ?? ""]),
      )}
    </section>

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