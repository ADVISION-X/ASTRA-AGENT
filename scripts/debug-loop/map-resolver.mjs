import { runCommand } from "./command-runner.mjs";
import { getRepoRoot } from "./path-policy.mjs";

const SNAPSHOT_SCRIPT = [
  "import { getDevelopmentMapPluginRegistry } from './src/map-plugins/registry/map-plugin-registry.ts';",
  "const registry = getDevelopmentMapPluginRegistry();",
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

const MAP_MODE_BLOCKERS = {
  "generate-draft-map": ["BLOCKED_MAP_AUTHORING_NOT_IMPLEMENTED", "Map authoring public contract is not implemented."],
  "activate-existing-draft": ["BLOCKED_MAP_VALIDATION_INCOMPLETE", "Map validation, approval, and activation pipeline is incomplete for this mode."],
  "builtin-seed-map": ["BLOCKED_MAP_VALIDATION_INCOMPLETE", "Map validation, approval, and activation pipeline is incomplete for this mode."],
};

function buildBlockedResult(decision, rootCause) {
  return { status: "blocked", decision, rootCause };
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

function resolveModeResult(mode) {
  if (mode === "none") {
    return { status: "resolved", decision: null, rootCause: null, binding: null };
  }

  const blockedMode = MAP_MODE_BLOCKERS[mode];
  return blockedMode ? buildBlockedResult(...blockedMode) : null;
}

function hasActivationMetadata(entry) {
  return entry.approvalStatus === "approved"
    && Boolean(entry.humanApprovalRef)
    && Boolean(entry.validationReportRef)
    && Boolean(entry.activationRecord?.activationSnapshotRef)
    && Boolean(entry.capabilityCatalogVersion)
    && Boolean(entry.promptCatalogVersion)
    && Boolean(entry.packageVersion)
    && Boolean(entry.mapVersion);
}

function resolveEntryBlock(entry, input) {
  if (!entry) {
    return buildBlockedResult(
      "BLOCKED_NO_ACTIVE_MAP",
      `No active approved map matches taskTemplateId=${input.scenario.mapRequirement.taskTemplateId} platformId=${input.scenario.platformId}.`,
    );
  }

  if (!hasActivationMetadata(entry)) {
    return buildBlockedResult("BLOCKED_MAP_NOT_ACTIVATED", "Active map is missing activation snapshot or required version metadata.");
  }

  return input.scenario.mapRequirement.requiredPromptContracts && hasPromptBindingIssues(entry)
    ? buildBlockedResult("BLOCKED_NO_PROMPT_CONTRACT", "AI step prompt bindings are missing promptContractId or outputSchemaRef.")
    : null;
}

export async function resolveScenarioMapBinding(input) {
  const mode = input.scenario.mapRequirement?.mode ?? "none";
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