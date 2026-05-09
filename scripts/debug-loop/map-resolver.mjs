import { access } from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./command-runner.mjs";
import { getDebugLoopDir, getRepoRoot } from "./path-policy.mjs";

const SNAPSHOT_SCRIPT = [
  "import { getLocalAppShellMapRegistry } from './src/lib/local-app-shell/local-app-shell-map-registry.ts';",
  "const registry = getLocalAppShellMapRegistry();",
  "const payload = registry.active.listActivePackages().map((mapPackage) => ({",
  "  packageId: mapPackage.manifest.packageId,",
  "  packageVersion: mapPackage.manifest.packageVersion,",
  "  mapId: mapPackage.manifest.mapId,",
  "  taskTemplateId: mapPackage.taskTemplate.taskTemplateId,",
  "  requestedPlatformId: mapPackage.taskTemplate.requestedPlatformId,",
  "  mapVersion: mapPackage.operationalMap.mapVersion,",
  "  approvalStatus: mapPackage.manifest.approvalStatus,",
  "  humanApprovalRef: mapPackage.manifest.humanApprovalRef,",
  "  validationReportRef: mapPackage.manifest.validationReportRef,",
  "  capabilityCatalogVersion: mapPackage.manifest.capabilityCatalogVersion,",
  "  promptCatalogVersion: mapPackage.manifest.promptCatalogVersion,",
  "  activationRecord: registry.active.getRegistration(mapPackage.manifest.mapId)?.activationRecord ?? null,",
  "  steps: mapPackage.operationalMap.steps.map((step) => ({ stepId: step.stepId, stepKind: step.stepKind, promptContractId: step.promptContractId ?? null })),",
  "  promptBindings: mapPackage.promptBindings.bindings,",
  "}));",
  "console.log(JSON.stringify(payload));",
].join(" ");

const MAP_AUTHORING_PUBLIC_CONTRACT_PATH = path.join(getDebugLoopDir(), "map-authoring-public-contract.mjs");

const MAP_MODE_BLOCKERS = {
  "activate-existing-draft": ["BLOCKED_MAP_VALIDATION_INCOMPLETE", "Map validation, approval, and activation pipeline is incomplete for this mode."],
  "builtin-seed-map": ["BLOCKED_MAP_VALIDATION_INCOMPLETE", "Map validation, approval, and activation pipeline is incomplete for this mode."],
};

function buildBlockedResult(decision, rootCause, metadata = null) {
  return { status: "blocked", decision, rootCause, metadata };
}

async function readActiveMapSnapshot() {
  const result = await runCommand(process.execPath, ["--import", "tsx", "--input-type=module", "-e", SNAPSHOT_SCRIPT], {
    cwd: getRepoRoot(),
  });
  if (result.exitCode !== 0) {
    return { ok: false, failureReason: result.failureReason ?? result.stderr ?? "failed to read active map registry", entries: [] };
  }

  return { ok: true, failureReason: null, entries: JSON.parse(result.stdout) };
}

function findMatchingMapEntry(entries, taskTemplateId, platformId) {
  return entries.find((entry) => entry.taskTemplateId === taskTemplateId && entry.requestedPlatformId === platformId) ?? null;
}

function hasPromptBindingIssues(entry) {
  const aiSteps = entry.steps.filter((step) => step.stepKind === "ai");
  if (aiSteps.length === 0) {
    return false;
  }

  return aiSteps.some((step) => {
    const binding = entry.promptBindings.find((item) => item.stepId === step.stepId);
    return !binding || !binding.promptContractId || !binding.outputSchemaRef;
  });
}

function buildResolvedResult(entry) {
  return {
    status: "resolved",
    decision: null,
    rootCause: null,
    binding: {
      selectedMapId: entry.mapId,
      selectedMapVersion: entry.mapVersion,
      mapPackageVersion: entry.packageVersion,
      activationSnapshotRef: entry.activationRecord.activationSnapshotRef,
      capabilityCatalogVersion: entry.capabilityCatalogVersion,
      promptCatalogVersion: entry.promptCatalogVersion,
      taskTemplateId: entry.taskTemplateId,
      requestedPlatformId: entry.requestedPlatformId,
    },
  };
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function resolveAuthoringArtifactDir(input) {
  if (typeof input.iterationDir === "string" && input.iterationDir.length > 0) {
    return input.iterationDir;
  }

  return path.join(getRepoRoot(), ".debug-loop", "adhoc", input.scenario.scenarioId);
}

function resolveGeneratedMapPath(scenario) {
  const candidate = scenario.mapRequirement?.generatedMapPath ?? null;
  if (typeof candidate !== "string" || candidate.length === 0) {
    return null;
  }

  return path.isAbsolute(candidate) ? candidate : path.join(getRepoRoot(), candidate);
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : String(error) };
  }
}

async function buildAuthoringArtifacts(input) {
  const artifactDir = resolveAuthoringArtifactDir(input);
  const result = await runCommand(
    process.execPath,
    ["--import", "tsx", MAP_AUTHORING_PUBLIC_CONTRACT_PATH, "--scenario", JSON.stringify(input.scenario), "--artifactDir", artifactDir],
    { cwd: getRepoRoot() },
  );
  const parsed = tryParseJson(result.stdout);
  if (!parsed.ok) {
    return {
      ok: false,
      decision: "BLOCKED_AUTHORING_INPUT_INCOMPLETE",
      rootCause: result.failureReason ?? result.stderr ?? `Failed to parse map authoring public contract output: ${parsed.errorMessage}`,
      metadata: { artifactDir },
    };
  }

  if (parsed.value.status !== "ready") {
    return {
      ok: false,
      decision: parsed.value.decision ?? "BLOCKED_AUTHORING_INPUT_INCOMPLETE",
      rootCause: parsed.value.reason ?? "Map authoring public contract did not return ready status.",
      metadata: parsed.value,
    };
  }

  return {
    ok: true,
    metadata: {
      artifactDir,
      ...parsed.value,
    },
  };
}

async function resolveGenerateDraftMapMode(input) {
  const authoring = await buildAuthoringArtifacts(input);
  if (!authoring.ok) {
    return buildBlockedResult(authoring.decision, authoring.rootCause, authoring.metadata ?? null);
  }

  const snapshot = await readActiveMapSnapshot();
  if (snapshot.ok) {
    const entry = findMatchingMapEntry(snapshot.entries, input.scenario.mapRequirement.taskTemplateId, input.scenario.platformId);
    const entryBlock = resolveEntryBlock(entry, input);
    if (!entryBlock && entry) {
      return {
        ...buildResolvedResult(entry),
        metadata: authoring.metadata,
      };
    }
  }

  const generatedMapPath = resolveGeneratedMapPath(input.scenario);
  if (!generatedMapPath) {
    return buildBlockedResult(
      "BLOCKED_AUTHORING_INPUT_INCOMPLETE",
      "generate-draft-map requires scenario.mapRequirement.generatedMapPath.",
      authoring.metadata,
    );
  }

  const generatedMapExists = await pathExists(generatedMapPath);
  if (!generatedMapExists) {
    return buildBlockedResult(
      "BLOCKED_CODEX_MAP_GENERATION_REQUIRED",
      `Map authoring prompt created at ${authoring.metadata.promptPath}. Generate the governed map package at ${generatedMapPath} using ${authoring.metadata.inputPackagePath}.`,
      {
        ...authoring.metadata,
        generatedMapPath,
      },
    );
  }

  return buildBlockedResult(
    "BLOCKED_MAP_VALIDATION_INCOMPLETE",
    `Draft map package exists at ${generatedMapPath}, but debug-loop activation for generate-draft-map is not wired yet.`,
    {
      ...authoring.metadata,
      generatedMapPath,
    },
  );
}

function resolveModeResult(mode) {
  if (mode === "none") {
    return { status: "resolved", decision: null, rootCause: null, binding: null };
  }

  const blockedMode = MAP_MODE_BLOCKERS[mode];
  return blockedMode ? buildBlockedResult(...blockedMode) : null;
}

function hasActivationMetadata(entry) {
  const activationRecord = entry.activationRecord;
  return [
    entry.validationReportRef,
    activationRecord?.activationSnapshotRef,
    activationRecord?.activationSnapshotHash,
    activationRecord?.automationGateRef,
    activationRecord?.activationProofRef,
    activationRecord?.mapPackageHash,
    activationRecord?.operationalMapHash,
    entry.capabilityCatalogVersion,
    entry.promptCatalogVersion,
    entry.packageVersion,
    entry.mapVersion,
  ].every(Boolean);
}

function resolveEntryBlock(entry, input) {
  if (!entry) {
    return buildBlockedResult(
      "BLOCKED_NO_ACTIVE_MAP",
      `No active approved map matches taskTemplateId=${input.scenario.mapRequirement.taskTemplateId} platformId=${input.scenario.platformId}.`,
    );
  }

  if (!hasActivationMetadata(entry)) {
    return buildBlockedResult("BLOCKED_MAP_NOT_ACTIVATED", "Active map is missing activation record evidence or required version metadata.");
  }

  return input.scenario.mapRequirement.requiredPromptContracts && hasPromptBindingIssues(entry)
    ? buildBlockedResult("BLOCKED_NO_PROMPT_CONTRACT", "AI step prompt bindings are missing promptContractId or outputSchemaRef.")
    : null;
}

export async function resolveScenarioMapBinding(input) {
  const mode = input.scenario.mapRequirement?.mode ?? "none";
  if (mode === "generate-draft-map") {
    return resolveGenerateDraftMapMode(input);
  }

  const modeResult = resolveModeResult(mode);
  if (modeResult) {
    return modeResult;
  }

  const snapshot = await readActiveMapSnapshot();
  if (!snapshot.ok) {
    return buildBlockedResult("BLOCKED_NO_ACTIVE_MAP", snapshot.failureReason);
  }

  const entry = findMatchingMapEntry(snapshot.entries, input.scenario.mapRequirement.taskTemplateId, input.scenario.platformId);
  const entryBlock = resolveEntryBlock(entry, input);
  if (entryBlock) {
    return entryBlock;
  }

  return buildResolvedResult(entry);
}