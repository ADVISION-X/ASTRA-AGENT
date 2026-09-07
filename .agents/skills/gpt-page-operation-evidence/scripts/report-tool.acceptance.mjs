#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const TOOL = resolve(new URL("./report-tool.mjs", import.meta.url).pathname);
const MATRIX = "/Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json";
const REPO = "/Users/nexgen/Documents/AGENT";

const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const sha256 = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
const admissionCandidate = (children, scopedFacts = []) => `CHILDSET:${sha256(JSON.stringify(stable(children.map((child) => [
  child.childCapabilityId, child.evidenceDemand.childCandidateDigest,
]).sort().concat(scopedFacts.length > 0 ? [["FACT_SCOPE", [...scopedFacts].sort()]] : [])))).slice("sha256:".length)}`;

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, ["--import", "tsx", TOOL, ...args], {
    cwd: REPO,
    encoding: "utf8",
  });
  if ((result.status ?? 1) !== expectedStatus) {
    throw new Error(`COMMAND_STATUS_MISMATCH:${args[0]}:${result.status}:${result.stderr || result.stdout}`);
  }
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function exactProjection(value) {
  return { kind: "SYNTHETIC_FIXTURE", value, sha256: sha256(value), length: value.length };
}

function setAtPath(root, path, value) {
  const parts = path.split(".");
  let current = root;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function observedStateSignature(specimen) {
  return sha256(JSON.stringify(stable({
    sceneSignature: specimen.sourceSceneSignature,
    url: specimen.peripheral.sanitizedUrlIdentity,
    targets: specimen.core.targets,
  })));
}

function liveSpecimen(child, requirement, runId, stateId, index, observationIds) {
  const observationId = observationIds[index];
  const sourceSceneId = `${child.childCapabilityId}:${stateId}:scene`;
  const sourceSceneSignature = sha256(`scene:${sourceSceneId}`);
  const attributes = { role: "region", "data-testid": `synthetic-${stateId}` };
  const stateFacts = { stateId, ordinal: index, observed: true };
  for (const assertion of requirement.stateAssertions?.[stateId] ?? []) {
    if (assertion.operator === "equals" && assertion.path.startsWith("stateFacts.")) {
      stateFacts[assertion.path.slice("stateFacts.".length)] = assertion.value;
    }
  }
  const observationOnly = child.contract.profile === "DOM_OBSERVATION";
  const actionId = `action:${child.childCapabilityId}`;
  const specimen = {
    stateId,
    evidenceKind: "LIVE_PAGE",
    capturedAt: `2026-09-06T00:00:${String(index).padStart(2, "0")}.000Z`,
    observationId,
    sourceSceneId,
    sourceSceneSignature,
    documentIdentityHash: sha256(`document:${child.childCapabilityId}`),
    targetIdentityHash: sha256("target"),
    revision: sha256(`revision:${sourceSceneId}`),
    stateFacts,
    stateSignature: "",
    core: {
      normalizedStructure: { tag: "div", sourceSceneSignature },
      sanitizedOuterHtml: `<div data-testid="synthetic-${stateId}"></div>`,
      attributes,
      computedStyle: { display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" },
      connected: true,
      layout: { x: 1, y: 1, width: 10, height: 10, inViewport: true },
      scope: { candidateCount: 1, selectedReason: stateId },
      candidates: [{ qualified: true, rejectionReasons: [], identityHash: sha256(stateId) }],
      targets: Object.fromEntries(requirement.liveStateTargets[stateId].map((target, targetIndex) => [target, {
        observed: true,
        identityHash: sha256(`${stateId}:${target}`),
        nodeIndex: targetIndex,
        sourceSceneId,
        sourceSceneSignature,
        attributes: { role: "region", "data-testid": `synthetic-${target}` },
      }])),
      textProjection: exactProjection(stateId),
      actionQualification: { qualified: true, stateId },
    },
    related: {
      ancestors: [{ role: "main" }],
      siblings: [],
      linkedNodes: [{ relation: "owner", identityHash: sha256(`owner:${stateId}`) }],
      beforeAfterDiff: { kind: index === 0 ? "PRECONDITION" : "POSTCONDITION", changed: index > 0 },
      contractReference: { childCapabilityId: child.childCapabilityId, contractVersion: child.contractVersion },
      sourceReferences: child.webImplementationReferences.length > 0
        ? child.webImplementationReferences.map(({ path }) => ({ path }))
        : [{ path: `src/capabilities/gpt/children/${child.childCapabilityId}/handler.ts` }],
      authorityEvidence: child.evidenceDemand.sourceBinding.authority,
      postconditions: { positive: true, negative: false },
      browserCommand: { kind: observationOnly ? "NOT_APPLICABLE" : "CAPTURED_BROWSER_COMMAND",
        childCapabilityId: child.childCapabilityId, actionId, operation: "click" },
      walProjection: { kind: observationOnly ? "NOT_APPLICABLE" : "CAPTURED_DISPATCH_RETURN",
        committedMutation: observationOnly ? "no" : "confirmed", actionId, operation: "click" },
      transitionChain: {
        preObservationId: observationIds[0],
        typedCommand: { kind: observationOnly ? "NOT_APPLICABLE" : "CAPTURED_BROWSER_COMMAND", actionId, operation: "click" },
        terminalReceipt: { kind: observationOnly ? "NOT_APPLICABLE" : "CAPTURED_DISPATCH_RETURN",
          actionId, operation: "click", preSceneSignature: sha256(`scene:${child.childCapabilityId}:${requirement.requiredLiveStates[0]}:scene`) },
        postObservationId: observationIds.at(-1),
        directPostcondition: { passed: true,
          sourceSceneId: `${child.childCapabilityId}:${requirement.requiredLiveStates.at(-1)}:scene`,
          sourceSceneSignature: sha256(`scene:${child.childCapabilityId}:${requirement.requiredLiveStates.at(-1)}:scene`) },
      },
    },
    peripheral: {
      pageKind: "chatgpt",
      sanitizedUrlIdentity: `/c/${sha256("conversation")}`,
      locale: "zh-CN",
      viewport: { width: 1440, height: 1000 },
      theme: "light",
      chromeVersion: "acceptance",
      providerBuildMarker: sha256("provider-build"),
      uiVariant: { syntheticAcceptance: true },
      pageState: { stateId },
      runId,
    },
  };
  for (const assertion of requirement.stateAssertions?.[stateId] ?? []) {
    if (assertion.operator === "equals"
      && assertion.path === "related.transitionChain.typedCommand.kind"
      && assertion.value === "ZERO_ACTION") {
      specimen.related.transitionChain.preObservationId = observationId;
      specimen.related.transitionChain.typedCommand = { kind: "ZERO_ACTION", reason: "ALREADY_SATISFIED" };
      specimen.related.transitionChain.terminalReceipt = { kind: "COHERENT_READBACK" };
      specimen.related.transitionChain.postObservationId = observationId;
      specimen.related.browserCommand = specimen.related.transitionChain.typedCommand;
      specimen.related.walProjection = specimen.related.transitionChain.terminalReceipt;
    }
    if (assertion.operator === "equals") setAtPath(specimen, assertion.path, assertion.value);
    if (assertion.operator === "present" && assertion.path.split(".").reduce((value, part) => value?.[part], specimen) === undefined) {
      setAtPath(specimen, assertion.path, "present");
    }
    if (assertion.operator === "greaterThan") setAtPath(specimen, assertion.path, Number(assertion.value) + 1);
  }
  specimen.stateSignature = observedStateSignature(specimen);
  return specimen;
}

function derivedSpecimen(child, requirement, runId, stateId, observationId, ordinal) {
  return {
    stateId,
    evidenceKind: "DERIVED_FIXTURE",
    capturedAt: "2026-09-06T00:00:00.000Z",
    derivedFromObservationId: observationId,
    mutation: { kind: `TYPED_${stateId.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}`, changes: [{
      path: "core.connected",
      fromHash: sha256(JSON.stringify(true)),
      toValueHash: sha256(JSON.stringify(false)),
    }] },
    expectedFailureCode: `SYNTHETIC_${stateId.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}`,
  };
}

function captureFromInventory(inventory, matrix) {
  const runId = "v5-acceptance";
  const captureEpoch = sha256(`capture-epoch:${runId}`);
  const syntheticIds = [...new Set(matrix.children.flatMap((child) => child.requiredInputRefs)
    .filter((id) => id.startsWith("synthetic-")))].sort();
  const authorizedIds = [...new Set(matrix.children.flatMap((child) => child.requiredInputRefs)
    .filter((id) => id.startsWith("authorized-")))].sort();
  const chainIds = [...new Set(matrix.children.flatMap((child) => child.requiredInputRefs)
    .filter((id) => id.startsWith("chain-")))].sort();
  const matrixById = Object.fromEntries(matrix.children.map((entry) => [entry.childCapabilityId, entry]));
  const children = inventory.children.filter((child) => child.pageOperationRequired).map((child) => {
    const requirement = matrixById[child.childCapabilityId];
    const observationIds = requirement.requiredLiveStates.map((stateId) => `${child.childCapabilityId}:${stateId}:live`);
    const live = requirement.requiredLiveStates.map((stateId, index) => liveSpecimen(child, requirement, runId, stateId, index, observationIds));
    const derivedStates = [...matrix.commonRequiredDerivedStates, ...requirement.childSpecificDerivedStates];
    const derived = derivedStates.map((stateId, index) => derivedSpecimen(child, requirement, runId, stateId, observationIds[0], index + live.length));
    const byState = Object.fromEntries(live.map((specimen) => [specimen.stateId, specimen]));
    const factBindings = child.evidenceDemand.facts.map((fact) => {
      let observationId = observationIds[0];
      let pointers = ["related.contractReference"];
      if (fact.factId.startsWith("target:")) {
        const target = fact.factId.slice("target:".length);
        const targetSpecimen = live.find((entry) => entry.core.targets[target]);
        observationId = targetSpecimen.observationId;
        pointers = [`core.targets.${target}`];
      }
      if (fact.factId.startsWith("live-state:")) {
        const stateId = fact.factId.slice("live-state:".length);
        observationId = byState[stateId].observationId;
        pointers = ["stateFacts.stateId"];
      }
      if (fact.factId.startsWith("derived-state:")) pointers = ["stateFacts.stateId"];
      if (fact.factId.startsWith("chain:")) pointers = ["related.transitionChain"];
      if (fact.factId.startsWith("authority:")) pointers = ["related.authorityEvidence"];
      return { factId: fact.factId, observationId, pointers,
        expectedHash: sha256(JSON.stringify(stable(fact.expected))) };
    });
    return {
      childCapabilityId: child.childCapabilityId,
      demandDigest: child.evidenceDemand.digest,
      childCandidateDigest: child.evidenceDemand.childCandidateDigest,
      inputRefs: requirement.requiredInputRefs,
      factBindings,
      specimens: [...live, ...derived],
    };
  });
  return {
    schemaVersion: "gpt-page-operation-capture.v5",
    capturedAt: "2026-09-06T00:00:00.000Z",
    runId,
    captureEpoch,
    recaptureTrigger: {
      kind: "HUMAN_REQUESTED_RECAPTURE",
      scope: ["acceptance-fixture"],
      requestedAt: "2026-09-06T00:00:00.000Z",
    },
    candidateBinding: inventory.candidateBinding,
    matrixDigest: inventory.matrixBinding.digest,
    browser: {
      family: "chrome", version: "acceptance", controlSkill: "chrome:control-chrome",
      dedicatedQaTab: true, qaTabCreatedByRun: true, livePageObserved: true,
      productionBrowserIdleEvidence: { kind: "SYNTHETIC_ACCEPTANCE_ONLY", sha256: sha256("idle") },
      qaTabIdentityHash: sha256("qa-tab"),
    },
    environment: { locale: "zh-CN", viewport: { width: 1440, height: 1000 }, theme: "light", providerBuildMarker: sha256("provider") },
    fixtureManifest: {
      schemaVersion: "gpt-page-operation-fixtures.v2", runId, syntheticOnly: true,
      inputs: Object.fromEntries(syntheticIds.map((id) => [id, exactProjection(id)])),
    },
    authorizedInputs: Object.fromEntries(authorizedIds.map((id) => {
      const expected = inventory.children.find((child) => child.collectionRequirements?.requiredInputRefs.includes(id))
        .evidenceDemand.authorizedInputRequirements[id];
      return [id, { kind: "AUTHORIZED_FACT_SET", sourceKind: "PRODUCT_PROFILE",
        variants: expected.variants, setHash: expected.setHash }];
    })),
    chainInputs: Object.fromEntries(chainIds.map((id) => {
      const sourceChildCapabilityId = matrix.chainInputSources[id];
      const source = children.find((child) => child.childCapabilityId === sourceChildCapabilityId);
      const observationId = source.specimens.find((entry) => entry.evidenceKind === "LIVE_PAGE").observationId;
      const sourceInventory = inventory.children.find((child) => child.childCapabilityId === sourceChildCapabilityId);
      const observationSignature = source.specimens.find((entry) => entry.observationId === observationId).stateSignature;
      const sourceDemandDigest = sourceInventory.evidenceDemand.digest;
      const sourceChildCandidateDigest = sourceInventory.evidenceDemand.childCandidateDigest;
      const evidenceRef = `${sourceChildCapabilityId}:${sourceChildCandidateDigest}:${observationId}:${observationSignature}`;
      return [id, { kind: "PRIOR_CHILD_OUTPUT", sourceChildCapabilityId, sourceDemandDigest,
        sourceChildCandidateDigest, observationId, observationSignature, evidenceRef, sha256: sha256(evidenceRef) }];
    })),
    sceneManifest: children.flatMap((child) => {
      const live = child.specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE");
      const actionId = `action:${child.childCapabilityId}`;
      return live.map((entry, index) => {
      const observationOnly = inventory.children.find((candidate) =>
        candidate.childCapabilityId === child.childCapabilityId).contract.profile === "DOM_OBSERVATION";
      const pre = live[0];
      const scene = stable({
        sceneId: entry.sourceSceneId,
        capturedAt: entry.capturedAt,
        stateSignature: entry.sourceSceneSignature,
        activeTabIdentityHash: sha256("qa-tab"),
        documentIdentityHash: entry.documentIdentityHash,
        observationRevisionHash: entry.revision,
        binding: { runId, captureEpoch, qaTabIdentityHash: sha256("qa-tab") },
        transitionReceipt: !observationOnly && index === live.length - 1 ? {
          actionId,
          operation: "click",
          issuedAt: pre.capturedAt,
          completedAt: pre.capturedAt,
          outcome: "DISPATCH_RETURNED",
          preSceneId: pre.sourceSceneId,
          preSceneSignature: pre.sourceSceneSignature,
        } : null,
        decisionReceipt: !observationOnly && index === 0 ? {
          kind: "ACTION_REQUIRED",
          actionId,
          operation: "click",
        } : null,
      });
      return { ...scene, envelopeHash: sha256(JSON.stringify(stable(scene))) };
    });
    }),
    children,
  };
}

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "gpt-page-evidence-v5-"));
  const inventoryPath = join(directory, "inventory.json");
  const capturePath = join(directory, "capture.json");
  const reportPath = join(directory, "report.json");
  run(["inventory", "--repo", REPO, "--matrix", MATRIX, "--output", inventoryPath]);
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const matrix = JSON.parse(await readFile(MATRIX, "utf8"));
  const capture = captureFromInventory(inventory, matrix);
  await writeFile(capturePath, `${JSON.stringify(capture)}\n`, "utf8");
  const forbiddenCapture = structuredClone(capture);
  delete forbiddenCapture.recaptureTrigger;
  const forbiddenCapturePath = join(directory, "recapture-forbidden.capture.json");
  await writeFile(forbiddenCapturePath, `${JSON.stringify(forbiddenCapture)}\n`, "utf8");
  const forbidden = run(["merge", "--repo", REPO, "--matrix", MATRIX,
    "--capture", forbiddenCapturePath, "--output", join(directory, "recapture-forbidden.report.json")], 1);
  if (!/RECAPTURE_FORBIDDEN/u.test(forbidden.stderr)) throw new Error("UNAUTHORIZED_RECAPTURE_PASSED");
  const merged = JSON.parse(run(["merge", "--repo", REPO, "--matrix", MATRIX, "--capture", capturePath, "--output", reportPath]).stdout);
  if (merged.status !== "CAPTURE_COMPLETE") throw new Error(`BASELINE_NOT_COMPLETE:${merged.status}`);
  run(["validate", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath, "--require-complete"]);
  const completeReport = JSON.parse(await readFile(reportPath, "utf8"));
  run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath, "--child", "all",
    "--candidate", admissionCandidate(completeReport.children.filter((child) => child.pageOperationRequired))]);
  const missingCandidate = run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath,
    "--child", "prepare_clean_gpt_chat"], 1);
  if (!/ADMISSION_CANDIDATE_REQUIRED/u.test(missingCandidate.stderr)) throw new Error("MISSING_CANDIDATE_PASSED");
  const headCandidate = run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", reportPath,
    "--child", "prepare_clean_gpt_chat", "--candidate", completeReport.candidateBinding.head], 1);
  if (!/ADMISSION_CANDIDATE_MISMATCH/u.test(headCandidate.stderr)) throw new Error("HEAD_CANDIDATE_PASSED");
  const nonCanonical = run(["inventory", "--repo", REPO, "--matrix", MATRIX,
    "--output", `${REPO}/docs/项目方案/GPT页面操作子能力实证资料-第二份.json`], 1);
  if (!/REPORT_CANONICAL_PATH_REQUIRED/u.test(nonCanonical.stderr)) throw new Error("NON_CANONICAL_REPORT_PASSED");

  const refreshedPath = join(directory, "refreshed.report.json");
  const refreshResult = JSON.parse(run(["refresh", "--repo", REPO, "--matrix", MATRIX,
    "--base-report", reportPath, "--output", refreshedPath, "--child", "prepare_clean_gpt_chat"]).stdout);
  if (refreshResult.chromeOpened !== false) throw new Error("OFFLINE_REFRESH_OPENED_CHROME");
  const refreshed = JSON.parse(await readFile(refreshedPath, "utf8"));
  if (refreshed.captureEpoch !== completeReport.captureEpoch) throw new Error("OFFLINE_REFRESH_CHANGED_CAPTURE_EPOCH");
  const preservedId = "verify_gpt_conversation_identity";
  if (JSON.stringify(refreshed.children.find((child) => child.childCapabilityId === preservedId).collection.specimens)
    !== JSON.stringify(completeReport.children.find((child) => child.childCapabilityId === preservedId).collection.specimens)) {
    throw new Error("STABLE_SNAPSHOT_NOT_PRESERVED");
  }

  const partialBase = structuredClone(completeReport);
  const partialWait = partialBase.children.find((child) => child.childCapabilityId === "wait_for_stable_gpt_text");
  partialWait.collection.specimens = partialWait.collection.specimens.filter((specimen) =>
    specimen.stateId !== "generation-error");
  const partialBasePath = join(directory, "partial-base.report.json");
  const partialPath = join(directory, "partial-refreshed.report.json");
  await writeFile(partialBasePath, `${JSON.stringify(partialBase)}\n`, "utf8");
  run(["refresh", "--repo", REPO, "--matrix", MATRIX, "--base-report", partialBasePath,
    "--output", partialPath, "--child", "wait_for_stable_gpt_text"]);
  const partialReport = JSON.parse(await readFile(partialPath, "utf8"));
  const partialChild = partialReport.children.find((child) => child.childCapabilityId === "wait_for_stable_gpt_text");
  const observedScope = ["live-state:text-stable"];
  run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", partialPath,
    "--child", "wait_for_stable_gpt_text", "--facts", observedScope.join(","),
    "--candidate", admissionCandidate([partialChild], observedScope)]);
  const missingScope = ["live-state:generation-error"];
  const missingFact = run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", partialPath,
    "--child", "wait_for_stable_gpt_text", "--facts", missingScope.join(","),
    "--candidate", admissionCandidate([partialChild], missingScope)], 1);
  if (!/ADMISSION_FACT_NOT_OBSERVED/u.test(missingFact.stderr)) throw new Error("UNOBSERVED_FACT_ADMITTED");

  const cases = [
    ["reused-live-scene", (value) => {
      const target = value.children.find((child) => child.childCapabilityId === "open_gpt_model_selector_v2");
      const second = target.specimens.find((specimen) => specimen.stateId === "model-selector-open");
      second.sourceSceneId = target.specimens[0].sourceSceneId;
      second.sourceSceneSignature = target.specimens[0].sourceSceneSignature;
      second.stateSignature = observedStateSignature(second);
    }],
    ["contradictory-unchecked-model", (value) => {
      const target = value.children.find((child) => child.childCapabilityId === "select_exact_gpt_model_v2");
      target.specimens.find((specimen) => specimen.stateId === "target-model-actionable-unchecked").core.attributes["aria-checked"] = "true";
    }],
    ["missing-demand-binding", (value) => {
      const target = value.children.find((child) => child.childCapabilityId === "prepare_clean_gpt_chat");
      target.factBindings.pop();
    }],
    ["derived-terminal-substitution", (value) => {
      const target = value.children.find((child) => child.childCapabilityId === "wait_for_stable_gpt_image");
      target.specimens.find((specimen) => specimen.stateId === "image-error-terminal").evidenceKind = "DERIVED_FIXTURE";
    }],
  ];
  for (const [name, mutate] of cases) {
    const variant = structuredClone(capture);
    mutate(variant);
    const variantCapture = join(directory, `${name}.capture.json`);
    const variantReport = join(directory, `${name}.report.json`);
    await writeFile(variantCapture, `${JSON.stringify(variant)}\n`, "utf8");
    if (name === "derived-terminal-substitution") {
      const rejectedAtMerge = run(["merge", "--repo", REPO, "--matrix", MATRIX,
        "--capture", variantCapture, "--output", variantReport], 1);
      if (!/CAPTURE_CHAIN_SOURCE_NOT_ADMITTED/u.test(rejectedAtMerge.stderr)) {
        throw new Error(`WRONG_REJECTION:${name}:${rejectedAtMerge.stderr}`);
      }
      continue;
    }
    const output = JSON.parse(run(["merge", "--repo", REPO, "--matrix", MATRIX,
      "--capture", variantCapture, "--output", variantReport]).stdout);
    if (output.status !== "CAPTURE_PARTIAL") throw new Error(`ADVERSARIAL_CASE_PASSED:${name}`);
    const rejected = run(["validate", "--repo", REPO, "--matrix", MATRIX,
      "--report", variantReport, "--require-complete"], 1);
    if (!/REPORT_NOT_COMPLETE/u.test(rejected.stderr)) throw new Error(`WRONG_REJECTION:${name}:${rejected.stderr}`);
    if (name === "missing-demand-binding") {
      const partialReport = JSON.parse(await readFile(variantReport, "utf8"));
      const modelCandidate = admissionCandidate([partialReport.children.find((child) =>
        child.childCapabilityId === "select_exact_gpt_model_v2")]);
      const prepareCandidate = admissionCandidate([partialReport.children.find((child) =>
        child.childCapabilityId === "prepare_clean_gpt_chat")]);
      run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", variantReport,
        "--child", "select_exact_gpt_model_v2", "--candidate", modelCandidate]);
      const localReject = run(["admit", "--repo", REPO, "--matrix", MATRIX, "--report", variantReport,
        "--child", "prepare_clean_gpt_chat", "--candidate", prepareCandidate], 1);
      if (!/ADMISSION_CHILD_NOT_READY/u.test(localReject.stderr)) {
        throw new Error(`LOCAL_ADMISSION_SCOPE_INVALID:${localReject.stderr}`);
      }
    }
  }

  const stale = JSON.parse(await readFile(reportPath, "utf8"));
  stale.candidateBinding.candidate = "WORKTREE:stale";
  const stalePath = join(directory, "stale-candidate.report.json");
  await writeFile(stalePath, `${JSON.stringify(stale)}\n`, "utf8");
  const staleRejected = run(["validate", "--repo", REPO, "--matrix", MATRIX,
    "--report", stalePath, "--require-complete"], 1);
  if (!/REPORT_PROJECTION_STALE/u.test(staleRejected.stderr)) throw new Error(`STALE_CANDIDATE_PASSED:${staleRejected.stderr}`);

  process.stdout.write(`${JSON.stringify({ passed: true, cases: ["recapture-without-trigger-rejected", "baseline-complete", "admit-all", "candidate-required", "head-candidate-rejected", "canonical-report-path", "offline-refresh-same-capture-epoch", "observation-scoped-partial-admit", "unobserved-fact-rejected", "partial-report-child-local-admit", ...cases.map(([name]) => name), "stale-projection"], directory })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
