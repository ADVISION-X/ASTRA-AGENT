#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { captureContext, preserveUnselectedProductSlices, productRunFailures,
  publicProductionSource } from "./report-tool.mjs";

const TOOL = resolve(new URL("./report-tool.mjs", import.meta.url).pathname);
const REPO = resolve(new URL("../../../../", import.meta.url).pathname);
const MATRIX = join(REPO, "src/capabilities/gpt/page-operation-matrix.json");
const localStable = (value) => Array.isArray(value) ? value.map(localStable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, localStable(value[key])])) : value;
const localHash = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
const rehashEnvelope = (entry) => {
  const { envelopeHash: _ignored, ...content } = entry;
  entry.envelopeHash = localHash(JSON.stringify(localStable(content)));
};

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, ["--import", "tsx", TOOL, ...args], {
    cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}

const hasForbiddenBinding = (value) => {
  if (Array.isArray(value)) return value.some(hasForbiddenBinding);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    ["candidateBinding", "worktreeDigest", "gitHead", "headCommit"].includes(key) || hasForbiddenBinding(child));
};

async function main() {
  const priorOther = { productKey: "other/action", nested: { untouched: ["exact", 1] } };
  const preserved = preserveUnselectedProductSlices([
    { productKey: "selected/action", revision: "current" },
    { productKey: "other/action", revision: "new-projection" },
  ], [{ productKey: "selected/action", revision: "old" }, priorOther], "selected/action");
  assert.equal(preserved[1], priorOther);
  assert.equal(JSON.stringify(preserved[1]), JSON.stringify(priorOther));
  const deletedFromCurrentCatalog = { productKey: "removed/action", nested: { historical: true } };
  const newCurrentRoute = { productKey: "new/action", revision: "current" };
  const preservedAcrossCatalogChange = preserveUnselectedProductSlices([
    { productKey: "selected/action", revision: "current" }, newCurrentRoute,
  ], [{ productKey: "selected/action", revision: "old" }, deletedFromCurrentCatalog], "selected/action");
  assert.equal(preservedAcrossCatalogChange[1], deletedFromCurrentCatalog);
  assert.equal(preservedAcrossCatalogChange[2], newCurrentRoute);

  const rawTaskBinding = localStable({ jobId: "aiprod_private", requestHash: localHash("request"),
    taskEnvelopeHash: localHash("task"), businessContextHash: localHash("context"),
    productId: "private_product", actionId: "private_action", parametersHash: localHash("parameters"),
    resultContractId: "result", resultContractVersion: 1 });
  const rawMaterials = [localStable({ materialIdHash: localHash("material-id"), ordinal: 0,
    role: "source", displayName: "secret-file.zip", bytes: 7, sha256: localHash("content"),
    mediaType: "application/zip", storageClass: "task_scoped" })];
  const rawTrace = [localStable({ traceEntryId: localHash("trace"), productStepId: "private_action",
    capabilityCallId: `gpt-call:${"1".repeat(64)}`, callId: "fresh-chat", actionOrdinal: 1,
    childId: "prepare_clean_gpt_chat", exactCallIdentityHash: localHash("exact-call"),
    resultStatus: "success", failureCode: null, mutationOutcome: "no", postconditionResult: "passed",
    candidateCardinality: { raw: 1, eligible: 1 }, observationRevisionHash: localHash("revision"),
    startedAt: "2026-09-08T00:00:00.000Z", endedAt: "2026-09-08T00:00:01.000Z",
    evidenceRef: "record-private", evidenceHash: localHash("evidence"),
    inputBinding: { schemaVersion: "gpt-page-input-binding.v1", source: "FORENSICS_SAFE_PROJECTION",
      inputHash: localHash("input"), roleHashes: { promptHash: null, responseHash: null,
        attachmentLabelHashes: null, attachmentSetHash: null, modelDisplayNameHash: null,
        reasoningRequirement: null, conversationUrlHash: null, turnMarkerHash: null,
        assistantTurnIdHash: null } },
    browserReceipts: [{ command_id: "command-private", reason: "private failure reason" }] })];
  const rawSource = localStable({ schemaVersion: "gpt-page-operation-production-source.v1",
    sourceKind: "PRODUCTION_RUNTIME_DURABLE_TASK", synthetic: false,
    jobId: "aiprod_private", attemptId: "33333333-3333-4333-8333-333333333333",
    productId: "private_product", actionId: "private_action", pluginId: "private-plugin", pluginVersion: 1,
    taskStatus: "completed", taskReason: "private failure reason", taskBinding: rawTaskBinding,
    materials: rawMaterials, materialSetHash: localHash(JSON.stringify(localStable(rawMaterials))),
    sourceSnapshotId: localHash(JSON.stringify(localStable({ taskBinding: rawTaskBinding, materials: rawMaterials }))),
    pageEvidenceContract: { path: "src/plugins/private/page-evidence-contract.json", sha256: localHash("contract") },
    flowContractBinding: { files: [{ path: "src/plugins/private/index.ts", sha256: localHash("flow") }],
      digest: localHash("binding") }, flowContractDigest: localHash("flow-contract"),
    flowStatus: "OBSERVED_COMPLETE_PATH", terminalBranch: "task-action-complete",
    terminalBranchProof: { kind: "DURABLE_COMPLETION_RECEIPT", receiptHash: localHash("result"),
      resultPayloadHash: localHash("payload"), resultObjectReceiptHash: localHash("object-receipt"),
      resultPayloadOutboxHash: localHash("outbox") },
    flowGaps: [], expectedStageCount: 1, observedStageCount: 1, actualTrace: rawTrace,
    traceDigest: localHash(JSON.stringify(rawTrace)), reportInputs: { input: { kind: "HASH_ONLY", sha256: localHash("input") } } });
  const publicSource = publicProductionSource(rawSource);
  const serializedPublic = JSON.stringify(publicSource);
  for (const forbidden of ["aiprod_private", "33333333-3333-4333-8333-333333333333",
    "secret-file.zip", "record-private", "command-private", "private failure reason"]) {
    assert.equal(serializedPublic.includes(forbidden), false, forbidden);
  }
  const rawRunId = "private-run-id";
  const runIdHash = localHash(rawRunId);
  const captureEpoch = localHash("epoch");
  const qaTabIdentityHash = localHash("tab");
  const rawSceneWithoutEnvelope = localStable({ sceneId: "scene-1",
    capturedAt: "2026-09-08T00:00:00.000Z", stateSignature: localHash("scene-state"),
    activeTabIdentityHash: qaTabIdentityHash, documentIdentityHash: localHash("document"),
    observationRevisionHash: localHash("revision"),
    binding: { runId: rawRunId, captureEpoch, qaTabIdentityHash },
    decisionReceipt: null, transitionReceipt: null });
  const rawScene = { ...rawSceneWithoutEnvelope,
    envelopeHash: localHash(JSON.stringify(rawSceneWithoutEnvelope)) };
  const rawCaptureContext = { schemaVersion: "gpt-page-operation-capture.v6",
    capturedAt: "2026-09-08T00:00:00.000Z", runId: rawRunId, captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE", scope: ["private/action"],
      requestedAt: "2026-09-08T00:00:00.000Z" }, matrixDigest: localHash("matrix"),
    browser: { family: "chrome", version: "acceptance", controlSkill: "chrome:control-chrome",
      dedicatedQaTab: true, qaTabCreatedByRun: true, livePageObserved: true,
      productionBrowserIdleEvidence: { observed: true }, qaTabIdentityHash },
    environment: { locale: "zh-CN", viewport: { width: 1200, height: 800 }, theme: "light",
      providerBuildMarker: localHash("provider") }, authorizedInputs: {}, chainInputs: {},
    sceneManifest: [rawScene] };
  const projectedContext = captureContext(rawCaptureContext);
  const publicScene = projectedContext.sceneManifest[0];
  const targets = { root: { observed: true } };
  const specimenWithoutEnvelope = localStable({ evidenceKind: "LIVE_PAGE", stateId: "observed",
    capturedAt: "2026-09-08T00:00:00.000Z", observationId: "observed:scene-1:live",
    sourceSceneId: "scene-1", sourceSceneSignature: publicScene.stateSignature,
    documentIdentityHash: publicScene.documentIdentityHash, targetIdentityHash: localHash("target"),
    revision: publicScene.observationRevisionHash, stateFacts: { observed: true },
    stateSignature: localHash(JSON.stringify(localStable({ sceneSignature: publicScene.stateSignature,
      url: "https://chatgpt.com/c/sha256:private", targets }))),
    core: { normalizedStructure: { kind: "ELEMENT", tag: "main", children: [] },
      sanitizedOuterHtml: "<main></main>", targets }, related: { admitted: true },
    peripheral: { sanitizedUrlIdentity: "https://chatgpt.com/c/sha256:private", runId: runIdHash } });
  const specimen = { ...specimenWithoutEnvelope,
    envelopeHash: localHash(JSON.stringify(specimenWithoutEnvelope)) };
  const validRun = localStable({ productId: publicSource.productId, actionId: publicSource.actionId,
    pluginId: publicSource.pluginId, pluginVersion: publicSource.pluginVersion,
    sourceSnapshotId: publicSource.sourceSnapshotId,
    reportSourceSnapshotId: publicSource.reportSourceSnapshotId,
    flowContractDigest: publicSource.flowContractDigest, traceDigest: publicSource.traceDigest,
    reportTraceDigest: publicSource.reportTraceDigest, flowStatus: publicSource.flowStatus,
    flowProjectionStatus: publicSource.flowProjectionStatus,
    flowProjectionGaps: publicSource.flowProjectionGaps,
    terminalBranch: publicSource.terminalBranch, terminalBranchProof: publicSource.terminalBranchProof,
    calls: [{ ...publicSource.actualTrace[0], pageOperationRequired: true,
      pageRequirementSnapshot: { matrixDigest: projectedContext.matrixDigest,
        childCandidateDigest: localHash("candidate"), requiredLiveStates: ["observed"] },
      inputBindingProof: { schemaVersion: "gpt-page-input-binding-proof.v1",
        inputHash: localHash("input"), inputHashBound: true, checks: [], complete: true },
      domEvidence: { specimens: [specimen] }, captureComplete: true, gaps: [] }],
    captureComplete: true, gaps: [], captureContext: projectedContext });
  const tinyMatrix = { children: [{ childCapabilityId: "prepare_clean_gpt_chat", requiredLiveStates: ["observed"] }] };
  assert.deepEqual(productRunFailures(validRun, publicSource, tinyMatrix), []);
  const tamperedRun = structuredClone(validRun);
  tamperedRun.captureComplete = false;
  assert.ok(productRunFailures(tamperedRun, publicSource, tinyMatrix).includes("captureComplete"));
  const tamperedSpecimenRun = structuredClone(validRun);
  tamperedSpecimenRun.calls[0].domEvidence.specimens[0].related.injected = true;
  assert.ok(productRunFailures(tamperedSpecimenRun, publicSource, tinyMatrix)
    .includes("call[0].specimenEnvelope"));
  for (const [field, value, expectedFailure] of [
    ["runId", localHash("wrong-run"), "scene.scene-1.runId"],
    ["captureEpoch", localHash("wrong-epoch"), "scene.scene-1.captureEpoch"],
    ["qaTabIdentityHash", localHash("wrong-tab"), "scene.scene-1.qaTabIdentityHash"],
  ]) {
    const bindingTamper = structuredClone(validRun);
    bindingTamper.captureContext.sceneManifest[0].binding[field] = value;
    rehashEnvelope(bindingTamper.captureContext.sceneManifest[0]);
    assert.ok(productRunFailures(bindingTamper, publicSource, tinyMatrix, null, null, false)
      .includes(expectedFailure));
  }
  const activeTabTamper = structuredClone(validRun);
  activeTabTamper.captureContext.sceneManifest[0].activeTabIdentityHash = localHash("wrong-active-tab");
  rehashEnvelope(activeTabTamper.captureContext.sceneManifest[0]);
  assert.ok(productRunFailures(activeTabTamper, publicSource, tinyMatrix, null, null, false)
    .includes("scene.scene-1.qaTabIdentityHash"));
  const snapshotMatrixTamper = structuredClone(validRun);
  snapshotMatrixTamper.calls[0].pageRequirementSnapshot.matrixDigest = localHash("wrong-matrix");
  assert.ok(productRunFailures(snapshotMatrixTamper, publicSource, tinyMatrix, null, null, false)
    .includes("call[0].pageRequirementSnapshot.matrixDigest"));
  const authorizedContextTamper = structuredClone(validRun);
  authorizedContextTamper.captureContext.authorizedInputs.injected = { debugNote: "must-not-pass" };
  assert.ok(productRunFailures(authorizedContextTamper, publicSource, tinyMatrix, null, null, false)
    .includes("captureContext.schema"));
  const chainContextTamper = structuredClone(validRun);
  chainContextTamper.captureContext.chainInputs.injected = { kind: "PRIOR_CHILD_OUTPUT", debugNote: "must-not-pass" };
  assert.ok(productRunFailures(chainContextTamper, publicSource, tinyMatrix, null, null, false)
    .includes("captureContext.schema"));

  const unknownBrowserField = structuredClone(rawCaptureContext);
  unknownBrowserField.browser.debugNote = "must-not-pass";
  assert.throws(() => captureContext(unknownBrowserField), /CAPTURE_PUBLIC_METADATA_INVALID/u);
  const unknownReceiptField = structuredClone(rawCaptureContext);
  unknownReceiptField.sceneManifest[0].decisionReceipt = { kind: "ALREADY_SATISFIED", debugNote: "must-not-pass" };
  const { envelopeHash: _oldEnvelope, ...unknownReceiptScene } = unknownReceiptField.sceneManifest[0];
  unknownReceiptField.sceneManifest[0].envelopeHash = localHash(JSON.stringify(localStable(unknownReceiptScene)));
  assert.throws(() => captureContext(unknownReceiptField), /CAPTURE_SCENE_PUBLIC_SCHEMA_INVALID/u);

  const secondRawTrace = localStable({ ...rawTrace[0], traceEntryId: localHash("trace-2"),
    exactCallIdentityHash: localHash("exact-call-2"), actionOrdinal: 2 });
  const twoTraceRawSource = localStable({ ...rawSource, actualTrace: [rawTrace[0], secondRawTrace] });
  twoTraceRawSource.traceDigest = localHash(JSON.stringify(localStable(twoTraceRawSource.actualTrace)));
  const twoTracePublicSource = publicProductionSource(twoTraceRawSource);
  const reusedSceneRun = localStable({ ...validRun,
    sourceSnapshotId: twoTracePublicSource.sourceSnapshotId,
    reportSourceSnapshotId: twoTracePublicSource.reportSourceSnapshotId,
    flowContractDigest: twoTracePublicSource.flowContractDigest,
    traceDigest: twoTracePublicSource.traceDigest,
    reportTraceDigest: twoTracePublicSource.reportTraceDigest,
    calls: twoTracePublicSource.actualTrace.map((entry) => ({ ...entry, pageOperationRequired: true,
      pageRequirementSnapshot: { matrixDigest: projectedContext.matrixDigest,
        childCandidateDigest: localHash("candidate"), requiredLiveStates: ["observed"] },
      inputBindingProof: { schemaVersion: "gpt-page-input-binding-proof.v1",
        inputHash: entry.inputBinding.inputHash, inputHashBound: true, checks: [], complete: true },
      domEvidence: { specimens: [specimen] }, captureComplete: true, gaps: [] })),
  });
  assert.ok(productRunFailures(reusedSceneRun, twoTracePublicSource, tinyMatrix)
    .includes("call[1].sceneCrossCallReuse"));

  const directory = await mkdtemp(join(tmpdir(), "gpt-product-report-v6-"));
  const reportPath = join(directory, "report.json");
  run(["inventory", "--repo", REPO, "--matrix", MATRIX, "--output", reportPath]);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.schemaVersion, "gpt-page-operation-evidence.v6");
  assert.equal(report.primaryIndex, "products");
  assert.equal(report.products.length, 40);
  assert.equal(report.productCaptureStatus, "NOT_CAPTURED");
  assert.equal(report.claimsQualityVerdict, false);
  assert.equal(hasForbiddenBinding(report), false);
  assert.ok(report.products.some((entry) => entry.productKey === "public_knowledge_article_pipeline/produce_article"
    && entry.contractPath?.endsWith("page-evidence-contract.json")));
  assert.ok(report.products.some((entry) => entry.productKey === "localization_static_catalog/produce_locale_catalog"
    && entry.contractPath?.endsWith("page-evidence-contract.json")));
  assert.ok(report.products.some((entry) => entry.gaps.includes("PRODUCT_EVIDENCE_CONTRACT_NOT_IMPLEMENTED")));
  run(["validate", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath]);

  const digest = `sha256:${"0".repeat(64)}`;
  const candidate = JSON.parse(run(["candidate", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath,
    "--product", "public_knowledge_article_pipeline", "--action", "produce_article"]).stdout).candidate;
  assert.match(candidate, /^PRODUCT:[a-f0-9]{64}$/u);
  const unrelatedDrift = structuredClone(report);
  unrelatedDrift.projectionRevision = digest;
  unrelatedDrift.matrixBinding = { schemaVersion: "changed-elsewhere", digest };
  unrelatedDrift.generatedAt = "2099-01-01T00:00:00.000Z";
  unrelatedDrift.products.find((entry) => entry.productKey !== "public_knowledge_article_pipeline/produce_article")
    .gaps = ["UNRELATED_PRODUCT_CHANGED"];
  unrelatedDrift.childIndex = { unrelated_child: [] };
  const unrelatedDriftPath = join(directory, "unrelated-drift.json");
  await writeFile(unrelatedDriftPath, `${JSON.stringify(unrelatedDrift)}\n`);
  const localCandidate = JSON.parse(run(["candidate", "--repo", REPO, "--matrix", MATRIX,
    "--report", unrelatedDriftPath, "--product", "public_knowledge_article_pipeline",
    "--action", "produce_article"]).stdout).candidate;
  assert.equal(localCandidate, candidate);
  const preservedHistorical = structuredClone(report);
  preservedHistorical.projectionRevision = digest;
  preservedHistorical.matrixBinding = { schemaVersion: "historical", digest };
  preservedHistorical.products.find((entry) => entry.productKey !== "public_knowledge_article_pipeline/produce_article")
    .contractDigest = digest;
  const preservedHistoricalPath = join(directory, "preserved-historical.json");
  await writeFile(preservedHistoricalPath, `${JSON.stringify(preservedHistorical)}\n`);
  const preservedValidation = JSON.parse(run(["validate", "--repo", REPO, "--matrix", MATRIX,
    "--report", preservedHistoricalPath]).stdout);
  assert.equal(preservedValidation.valid, true);
  assert.equal(preservedValidation.projectionCurrent, false);
  assert.ok(preservedValidation.staleProducts.length > 0);
  assert.match(run(["candidate", "--repo", REPO, "--matrix", MATRIX,
    "--report", reportPath, "--product", "public_knowledge_article_pipeline", "--action", "produce_article",
    "--child", "submit_exact_gpt_turn_once"], 1).stderr,
  /ADMISSION_CHILD_SCOPE_FORBIDDEN/u);
  assert.match(run(["refresh", "--repo", REPO, "--matrix", MATRIX, "--base-report", reportPath,
    "--output", join(directory, "child-refresh.json"), "--product", "public_knowledge_article_pipeline",
    "--action", "produce_article", "--child", "submit_exact_gpt_turn_once"], 1).stderr,
  /PRODUCT_CHILD_SCOPE_FORBIDDEN/u);
  const incomplete = run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath,
    "--product", "public_knowledge_article_pipeline", "--action", "produce_article", "--candidate", candidate], 1);
  assert.match(incomplete.stderr, /ADMISSION_PRODUCT_EVIDENCE_INCOMPLETE/u);

  const tampered = structuredClone(report);
  tampered.childIndex = { fake_child: [] };
  const tamperedPath = join(directory, "tampered.json");
  await writeFile(tamperedPath, `${JSON.stringify(tampered)}\n`);
  assert.match(run(["validate", "--repo", REPO, "--matrix", MATRIX, "--report", tamperedPath], 1).stderr,
    /REPORT_CHILD_INDEX_NOT_DERIVED/u);

  const gitBound = structuredClone(report);
  gitBound.candidateBinding = { head: "deadbeef" };
  const gitBoundPath = join(directory, "git-bound.json");
  await writeFile(gitBoundPath, `${JSON.stringify(gitBound)}\n`);
  assert.match(run(["validate", "--repo", REPO, "--matrix", MATRIX, "--report", gitBoundPath], 1).stderr,
    /REPORT_GIT_BINDING_FORBIDDEN/u);

  const staleProductRun = structuredClone(report);
  const staleProduct = staleProductRun.products.find((entry) =>
    entry.productKey === "public_knowledge_article_pipeline/produce_article");
  const staleSource = structuredClone(publicSource);
  staleSource.productId = staleProduct.productId;
  staleSource.actionId = staleProduct.actionId;
  staleSource.pluginId = staleProduct.pluginId;
  staleSource.pluginVersion = staleProduct.pluginVersion;
  staleSource.taskBinding.productId = staleProduct.productId;
  staleSource.taskBinding.actionId = staleProduct.actionId;
  staleSource.reportSourceSnapshotId = localHash(JSON.stringify(localStable({
    taskBinding: staleSource.taskBinding, materials: staleSource.materials,
  })));
  const staleRun = { ...validRun, productId: staleProduct.productId, actionId: staleProduct.actionId,
    pluginId: staleProduct.pluginId, pluginVersion: staleProduct.pluginVersion,
    reportSourceSnapshotId: staleSource.reportSourceSnapshotId,
    capturedAt: rawCaptureContext.capturedAt,
    captureEpoch, recaptureTrigger: rawCaptureContext.recaptureTrigger,
    productionSource: staleSource };
  staleProduct.runs = [staleRun];
  staleProduct.captureStatus = "CAPTURE_COMPLETE";
  staleProduct.gaps = [];
  staleProductRun.productCaptureStatus = "CAPTURE_PARTIAL";
  staleProductRun.childIndex = localStable({ prepare_clean_gpt_chat: [{
    productKey: staleProduct.productKey, sourceSnapshotId: staleRun.sourceSnapshotId, captureEpoch,
    productStepId: staleRun.calls[0].productStepId, actionOrdinal: staleRun.calls[0].actionOrdinal,
    traceEntryId: staleRun.calls[0].traceEntryId,
    exactCallIdentityHash: staleRun.calls[0].exactCallIdentityHash, captureComplete: true,
  }] });
  const staleProductPath = join(directory, "stale-product-run.json");
  await writeFile(staleProductPath, `${JSON.stringify(staleProductRun)}\n`);
  const staleValidation = JSON.parse(run(["validate", "--repo", REPO, "--matrix", MATRIX,
    "--report", staleProductPath]).stdout);
  assert.equal(staleValidation.projectionCurrent, false);
  const staleAggregateTamper = structuredClone(staleProductRun);
  staleAggregateTamper.products.find((entry) => entry.productKey === staleProduct.productKey)
    .captureStatus = "CAPTURE_PARTIAL";
  const staleAggregateTamperPath = join(directory, "stale-aggregate-tampered.json");
  await writeFile(staleAggregateTamperPath, `${JSON.stringify(staleAggregateTamper)}\n`);
  assert.match(run(["validate", "--repo", REPO, "--matrix", MATRIX,
    "--report", staleAggregateTamperPath], 1).stderr, /REPORT_PRODUCT_CAPTURE_PROJECTION_INVALID/u);
  const staleContextTamper = structuredClone(staleProductRun);
  staleContextTamper.products.find((entry) => entry.productKey === staleProduct.productKey)
    .runs[0].captureContext.browser.debugNote = "must-not-pass-after-write";
  const staleContextTamperPath = join(directory, "stale-context-tampered.json");
  await writeFile(staleContextTamperPath, `${JSON.stringify(staleContextTamper)}\n`);
  assert.match(run(["validate", "--repo", REPO, "--matrix", MATRIX,
    "--report", staleContextTamperPath], 1).stderr, /captureContext\.schema/u);
  const refreshedPath = join(directory, "refreshed-stale-product.json");
  run(["refresh", "--repo", REPO, "--matrix", MATRIX, "--base-report", staleProductPath,
    "--output", refreshedPath, "--product", "public_knowledge_article_pipeline", "--action", "produce_article"]);
  const refreshed = JSON.parse(await readFile(refreshedPath, "utf8"));
  const refreshedProduct = refreshed.products.find((entry) =>
    entry.productKey === "public_knowledge_article_pipeline/produce_article");
  assert.equal(refreshedProduct.captureStatus, "CAPTURE_COMPLETE");
  assert.deepEqual(refreshedProduct.gaps, []);
  run(["validate", "--repo", REPO, "--matrix", MATRIX, "--report", refreshedPath]);

  const legacy = structuredClone(report);
  legacy.schemaVersion = "gpt-page-operation-evidence.v5";
  const legacyPath = join(directory, "legacy.json");
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  assert.match(run(["validate", "--repo", REPO, "--matrix", MATRIX, "--report", legacyPath], 1).stderr,
    /REPORT_LEGACY_INVALIDATED/u);

  process.stdout.write(`${JSON.stringify({ passed: true, products: report.products.length,
    cases: ["catalog-denominator", "product-primary-index", "head-independent", "derived-child-index",
      "public-source-redaction", "product-run-recomputed", "product-admission-fails-closed",
      "product-candidate-locality", "targeted-slice-preserves-unselected-bytes",
      "global-drift-does-not-block-targeted-product", "child-admission-forbidden",
      "stale-slice-internal-validation", "persisted-capture-context-tamper-rejected",
      "persisted-scene-binding-tamper-rejected", "stale-matrix-snapshot-tamper-rejected",
      "stale-product-aggregate-derived", "product-local-projection-staleness",
      "v5-invalidated"] })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
