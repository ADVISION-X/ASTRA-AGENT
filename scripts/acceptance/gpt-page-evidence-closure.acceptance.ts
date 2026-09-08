import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  completeGptPageEvidenceCaptureFailures,
  gptPageEvidencePrivacyFailures,
  scopedGptPageEvidenceFactFailures,
} from "../audit/domains/gpt/gpt-page-evidence-capture-inspection.js";
import { productPluginCatalogSnapshot } from "../../src/mediator/product-plugin-catalog.js";

type EvidenceProduct = Readonly<{
  productKey: string;
  productId: string;
  actionId: string;
  pluginId: string;
  contractPath: string | null;
  captureStatus: string;
  gaps: readonly string[];
  runs: readonly Readonly<{
    sourceSnapshotId: string;
    captureEpoch: string;
    calls: readonly Readonly<{
      childId: string;
      productStepId: string;
      actionOrdinal: number;
      traceEntryId: string;
      exactCallIdentityHash: string;
      pageOperationRequired: boolean;
      captureComplete: boolean;
    }>[];
  }>[];
}>;

type EvidenceReport = Readonly<{
  schemaVersion: string;
  primaryIndex: string;
  productionRuntimeConsumer: boolean;
  claimsQualityVerdict: boolean;
  captureStatus: string;
  productCaptureStatus: string;
  captureMetadata: unknown;
  products: readonly EvidenceProduct[];
  childIndex: Record<string, unknown>;
  children: readonly Record<string, unknown>[];
}>;

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]))
    : value;

const derivedChildIndex = (products: readonly EvidenceProduct[]): Record<string, unknown> => {
  const index: Record<string, unknown[]> = {};
  for (const product of products) for (const run of product.runs) for (const call of run.calls) {
    if (!call.pageOperationRequired) continue;
    (index[call.childId] ??= []).push(stable({
      productKey: product.productKey,
      sourceSnapshotId: run.sourceSnapshotId,
      captureEpoch: run.captureEpoch,
      productStepId: call.productStepId,
      actionOrdinal: call.actionOrdinal,
      traceEntryId: call.traceEntryId,
      exactCallIdentityHash: call.exactCallIdentityHash,
      captureComplete: call.captureComplete,
    }));
  }
  return stable(index) as Record<string, unknown>;
};

const forbiddenRepositoryBindingPaths = (value: unknown, path = "report"): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry, index) =>
    forbiddenRepositoryBindingPaths(entry, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(["candidateBinding", "worktreeDigest", "gitHead", "headCommit"].includes(key)
      ? [`${path}.${key}`] : []),
    ...forbiddenRepositoryBindingPaths(child, `${path}.${key}`),
  ]);
};

const report = JSON.parse(readFileSync(resolve(
  "docs/项目方案/GPT页面操作子能力实证资料.json",
), "utf8")) as EvidenceReport;

assert.equal(report.schemaVersion, "gpt-page-operation-evidence.v6");
assert.equal(report.primaryIndex, "products");
assert.equal(report.productionRuntimeConsumer, false);
assert.equal(report.claimsQualityVerdict, false);
assert.equal(report.captureStatus, "NOT_CAPTURED");
assert.equal(report.productCaptureStatus, "NOT_CAPTURED");
assert.equal(report.captureMetadata, null);
assert.deepEqual(gptPageEvidencePrivacyFailures(report), []);
assert.deepEqual(forbiddenRepositoryBindingPaths(report), []);

const expectedProductKeys = productPluginCatalogSnapshot.flatMap((plugin) => plugin.accepts.map((route) =>
  `${route.product_id}/${route.action_id}`)).sort();
const actualProductKeys = report.products.map((product) => product.productKey).sort();
assert.deepEqual(actualProductKeys, expectedProductKeys);
assert.equal(new Set(actualProductKeys).size, actualProductKeys.length);
assert.deepEqual(report.childIndex, derivedChildIndex(report.products));

const contracted = report.products.filter((product) => product.contractPath !== null);
const notYetContracted = report.products.filter((product) => product.contractPath === null);
assert.equal(contracted.length, 10);
assert.ok(contracted.every((product) => [
  "public-knowledge-article-pipeline", "localization-production",
].includes(product.pluginId)));
assert.ok(contracted.every((product) => product.captureStatus === "NOT_CAPTURED"
  && product.gaps.includes("PRODUCT_PRODUCTION_CAPTURE_NOT_PRESENT")));
assert.ok(notYetContracted.length > 0);
assert.ok(notYetContracted.every((product) => product.captureStatus === "NOT_CAPTURED"
  && product.gaps.includes("PRODUCT_EVIDENCE_CONTRACT_NOT_IMPLEMENTED")));

const seoProduce = report.products.find((product) =>
  product.productKey === "public_knowledge_article_pipeline/produce_article");
const localizationCatalog = report.products.find((product) =>
  product.productKey === "localization_static_catalog/produce_locale_catalog");
assert.equal(seoProduce?.contractPath,
  "src/plugins/public-knowledge-article-pipeline/page-evidence-contract.json");
assert.equal(localizationCatalog?.contractPath,
  "src/plugins/localization-production/page-evidence-contract.json");

type ProductEvidenceContract = Readonly<{
  traceAuthority: Record<string, string>;
  routes: ReadonlyArray<Readonly<{
    productId: string;
    actionId: string;
    materialPolicy: Readonly<{ requiredRoles: readonly string[] }>;
    topology: Readonly<{ stageOrder?: readonly string[]; passOrder?: readonly string[] }>;
  }>>;
}>;
const seoContract = JSON.parse(readFileSync(resolve(
  "src/plugins/public-knowledge-article-pipeline/page-evidence-contract.json",
), "utf8")) as ProductEvidenceContract;
const localizationContract = JSON.parse(readFileSync(resolve(
  "src/plugins/localization-production/page-evidence-contract.json",
), "utf8")) as ProductEvidenceContract;
for (const contract of [seoContract, localizationContract]) {
  assert.deepEqual(contract.traceAuthority, {
    kind: "durable-product-forensics",
    sequenceOwner: "accepted-production-attempt",
    currentFlowSourcesRole: "projection-only",
  });
  assert.equal(JSON.stringify(contract).includes("legalCallSequences"), false);
  assert.equal(JSON.stringify(contract).includes("callSequenceTemplates"), false);
}
const seoRoute = seoContract.routes.find((route) =>
  route.productId === "public_knowledge_article_pipeline" && route.actionId === "produce_article");
assert.ok(seoRoute);
assert.deepEqual(seoRoute.materialPolicy.requiredRoles, ["ready_corpus_archive"]);
assert.deepEqual(seoRoute.topology.stageOrder,
  ["corpus_research", "article_synthesis", "article_image_generation"]);
const localizationRoute = localizationContract.routes.find((route) =>
  route.productId === "localization_static_catalog" && route.actionId === "produce_locale_catalog");
assert.ok(localizationRoute);
assert.deepEqual(localizationRoute.materialPolicy.requiredRoles, ["static_catalog_input"]);
assert.deepEqual(localizationRoute.topology.passOrder, ["candidate-a", "candidate-b", "selector"]);

const pageChildren = report.children.filter((child) => child.pageOperationRequired === true);
assert.equal(pageChildren.length, 22);
for (const child of pageChildren) {
  assert.equal(child.captureComplete, false);
  assert.ok(Array.isArray(child.captureMissing) && child.captureMissing.length > 0);
  assert.ok(completeGptPageEvidenceCaptureFailures(
    child, child.evidenceDemand as Record<string, unknown>,
  ).length > 0);
}

const modelSelection = pageChildren.find((child) =>
  child.childCapabilityId === "select_exact_gpt_model_v2")!;
const modelDemand = modelSelection.evidenceDemand as Record<string, unknown>;
assert.ok(scopedGptPageEvidenceFactFailures(
  modelSelection, modelDemand, ["target:model-option"],
).includes("fact-not-observed:target:model-option"));
assert.ok(scopedGptPageEvidenceFactFailures(
  modelSelection, modelDemand, ["target:not-declared"],
).includes("fact-not-declared:target:not-declared"));

assert.ok(gptPageEvidencePrivacyFailures({ url: "/c/raw-conversation-id" }).length > 0);
assert.ok(gptPageEvidencePrivacyFailures({ accessToken: "forbidden" }).length > 0);

for (const script of [
  ".agents/skills/gpt-page-operation-evidence/scripts/production-source.acceptance.mjs",
  ".agents/skills/gpt-page-operation-evidence/scripts/pipeline.acceptance.mjs",
  ".agents/skills/gpt-page-operation-evidence/scripts/report-tool.acceptance.mjs",
]) {
  const result = spawnSync(process.execPath, [resolve(script)], {
    cwd: resolve("."), encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${script}\n${result.stderr || result.stdout}`);
}

process.stdout.write("gpt-page-evidence-closure-acceptance-ok\n");
