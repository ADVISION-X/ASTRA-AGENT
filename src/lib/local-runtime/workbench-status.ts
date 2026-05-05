import { getDevelopmentMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";
import type { MissionReadinessReport, RuntimeHealthReport } from "../../types/runtime.js";
import type { MissionStartPreflightComponent, RequestedPlatformId, WorkbenchRuntime } from "./workbench-contract.js";
import { getOpenLocalProgramAdapterReadiness } from "./open-local-program-adapter.js";
import { checkMissionCommandSchemaPreflight, describeMissionCommandSchemaPreflight } from "./workbench-mission-command-preflight.js";

const PLATFORM_MODE_INFO = {
  "agent-shell": {
    platformLabel: "Mission-governed multi-platform agent shell",
    executionMode: "Platform binding is resolved at mission start",
    fallbackMode: "No startup-time platform binding or silent default",
    geometryGuard: "Capability-owned at execution time",
    viewport: "Derived from governed browser session",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
  "tiktok-web": {
    platformLabel: "TikTok web governed map runtime",
    executionMode: "Ability-group governed runtime",
    fallbackMode: "No platform-owned fallback chain",
    geometryGuard: "Capability-owned at execution time",
    viewport: "Derived from governed browser session",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
  "facebook-web": {
    platformLabel: "Facebook web governed map runtime",
    executionMode: "Ability-group governed runtime",
    fallbackMode: "No platform-owned fallback chain",
    geometryGuard: "Capability-owned at execution time",
    viewport: "Derived from governed browser session",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
  "macos-local": {
    platformLabel: "macOS local program governed handoff runtime",
    executionMode: "Open Local Program handoff only",
    fallbackMode: "No raw app name, shell command, AppleScript, or local workbench substitution",
    geometryGuard: "Desktop geometry owned by Geometry Guard runtime proof",
    viewport: "Derived from governed local app window handoff",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
  "iphone-mirroring-facebook-app": {
    platformLabel: "iPhone Mirroring Facebook app governed visual runtime",
    executionMode: "Open Local Program handoff followed by capability-owned visual chain",
    fallbackMode: "No web URL, workbench, or debug-loop local app fallback",
    geometryGuard: "Desktop geometry owned by Geometry Guard runtime proof",
    viewport: "Derived from governed local app window handoff and screenshots",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
  "iphone-mirroring-tiktok-app": {
    platformLabel: "iPhone Mirroring TikTok app governed visual runtime",
    executionMode: "Open Local Program handoff followed by capability-owned visual chain",
    fallbackMode: "No web URL, workbench, or debug-loop local app fallback",
    geometryGuard: "Desktop geometry owned by Geometry Guard runtime proof",
    viewport: "Derived from governed local app window handoff and screenshots",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
} as const;

const CAPABILITY_ROSTER = [
  { abilityGroupId: "commander-console", displayName: "Commander Console", currentStrength: "governed", purpose: "Mission command and read-only operator console" },
  { abilityGroupId: "orchestration", displayName: "Orchestration", currentStrength: "governed", purpose: "Mission command, map execution, and controlled transitions" },
  { abilityGroupId: "nerve-bus", displayName: "Nerve Bus", currentStrength: "governed", purpose: "Governed transport between orchestration, abilities, AI, and commander" },
  { abilityGroupId: "ai", displayName: "AI", currentStrength: "specialized", purpose: "Local model execution under governed contracts" },
  { abilityGroupId: "open", displayName: "Open", currentStrength: "governed", purpose: "Governed target-page opening and session-safe navigation" },
  { abilityGroupId: "screenshot", displayName: "Screenshot", currentStrength: "governed", purpose: "Governed capture and image preparation" },
  { abilityGroupId: "visual-target", displayName: "Visual Target", currentStrength: "governed", purpose: "Visual target detection and coordinate truth" },
  { abilityGroupId: "geometry-guard", displayName: "Geometry Guard", currentStrength: "governed", purpose: "Coordinate normalization and geometry safety" },
  { abilityGroupId: "mouse-click", displayName: "Mouse Click", currentStrength: "governed", purpose: "Governed click execution" },
  { abilityGroupId: "text-input", displayName: "Text Input", currentStrength: "governed", purpose: "Governed approved-text writing" },
  { abilityGroupId: "mouse-scroll", displayName: "Mouse Scroll", currentStrength: "governed", purpose: "Governed scroll execution" },
  { abilityGroupId: "post-action-verification", displayName: "Post-action Verification", currentStrength: "governed", purpose: "Action-result verification after platform operations" },
  { abilityGroupId: "forensics-persistence", displayName: "Forensics Persistence", currentStrength: "governed", purpose: "Evidence, ledger, and runtime proof persistence" },
  { abilityGroupId: "page-state", displayName: "Page State", currentStrength: "governed", purpose: "Page readiness and safety-state truth" },
] as const;

const resolveMissionBindingReadinessComponent = async (
  runtime: WorkbenchRuntime,
): Promise<MissionReadinessReport["components"][number]> => {
  const mission = await runtime.orchestrationAbilityGroup.getMissionState();
  if (mission.mapId !== null) {
    return { name: "mission", ok: true, detail: `mission_status=${mission.status}; selectedMapId=${mission.mapId}; requestedPlatformId=${mission.requestedPlatform ?? "none"}; round=${mission.currentRoundIndex}`, ownerResponsible: "Orchestration", actionableMessage: "Mission binding already exists for the active run.", severity: "info", source: "active-mission" };
  }
  const readyTemplates = getDevelopmentMapPluginRegistry().active.listOrdinaryTaskTemplates().filter((template) => template.availability === "ready");
  if (readyTemplates.length === 0) {
    return { name: "mission", ok: false, detail: "no active approved task template can resolve a governed map binding", ownerResponsible: "Orchestration / Map Plugin Registry", actionableMessage: "Activate at least one approved task template before starting a mission.", severity: "blocked", source: "active-task-template-feed" };
  }
  const defaultTemplate = readyTemplates[0];
  const binding = defaultTemplate ? getDevelopmentMapPluginRegistry().active.getTaskTemplateDeveloperBinding(defaultTemplate.taskTemplateId) : null;
  if (!defaultTemplate || !binding) {
    return { name: "mission", ok: false, detail: "active task-template feed is missing an approved developer binding", ownerResponsible: "Orchestration / Map Plugin Registry", actionableMessage: "Repair the active task template binding before starting a mission.", severity: "blocked", source: "active-task-template-feed" };
  }
  return { name: "mission", ok: true, detail: `launchBinding taskTemplateId=${binding.taskTemplateId}; selectedMapId=${binding.mapId}; requestedPlatformId=${binding.requestedPlatformId}; readyTemplates=${readyTemplates.length}`, ownerResponsible: "Orchestration / Map Plugin Registry", actionableMessage: readyTemplates.length === 1 ? "Mission start binding will be resolved from the active approved task template at command time." : "Mission start binding will be resolved from the selected approved task template at command time.", severity: "info", source: "active-task-template-feed" };
};

export const getHealthReport = async (runtime: WorkbenchRuntime): Promise<RuntimeHealthReport> => {
  const [dataStoreHealth, mission] = await Promise.all([runtime.evidenceStore.getHealth(), runtime.orchestrationAbilityGroup.getMissionState()]);
  const browserHealth = runtime.browserController.getHealth();
  const components = [
    { name: "console", ok: true, detail: "Commander Console route ready" },
    { name: "agent", ok: true, detail: `mission_status=${mission.status}; map=${mission.mapId ?? "none"}; round=${mission.currentRoundIndex}` },
    { name: "browserController", ok: browserHealth.ok, detail: browserHealth.detail },
    { name: "dataStore", ok: dataStoreHealth.ok, detail: dataStoreHealth.detail },
  ] as const;
  const ok = components.every((component) => component.ok);
  return {
    kind: "app-shell-health",
    status: ok ? "ready" : "failed",
    actionableMessage: ok ? "App Shell ready. Commander Console can stay open while mission dependencies are checked separately." : "App Shell unavailable. Repair the failing shell component before retrying startup.",
    generatedAt: new Date().toISOString(),
    components: [...components],
  };
};

export const getMissionReadinessReport = async (
  runtime: WorkbenchRuntime,
): Promise<MissionReadinessReport> => {
  const [bindingComponent, dataStoreHealth, localAiHealth, localAiRuntimeHealth] = await Promise.all([
    resolveMissionBindingReadinessComponent(runtime),
    runtime.evidenceStore.getHealth(),
    runtime.aiAbilityGroup.getHealth(),
    runtime.aiAbilityGroup.getRuntimeHealth(),
  ]);
  const browserHealth = runtime.browserController.getHealth();
  const components = [
    bindingComponent,
    { name: "browserController", ok: browserHealth.ok, detail: browserHealth.detail, ownerResponsible: "Commander Console / Local Browser Session", actionableMessage: "Restore the governed local browser session before retrying mission start.", severity: browserHealth.ok ? "info" : "blocked", source: "service-health" },
    { name: "localAi", ok: localAiHealth.ok, detail: `${localAiHealth.detail}; lastTask=${localAiRuntimeHealth.lastTaskType ?? "none"}; lastStatus=${localAiRuntimeHealth.lastInvocationStatus ?? "none"}; lastFailure=${localAiRuntimeHealth.lastFailureReason ?? "none"}`, ownerResponsible: "AI Capability / Local AI Runtime", actionableMessage: "Start Ollama or repair the local AI runtime before starting this mission.", severity: localAiHealth.ok ? "info" : "blocked", source: "service-health" },
    { name: "dataStore", ok: dataStoreHealth.ok, detail: dataStoreHealth.detail, ownerResponsible: "Forensics Persistence", actionableMessage: "Repair the local Forensics store before starting this mission.", severity: dataStoreHealth.ok ? "info" : "blocked", source: "service-health" },
  ] as const;
  const blockingReasons = components.filter((component) => component.ok !== true);
  const warnings = components.filter((component) => component.ok && component.severity === "warning");
  const primaryBlockingReason = blockingReasons[0] ?? null;
  return {
    kind: "mission-readiness",
    status: blockingReasons.length === 0 ? "ready" : "degraded",
    actionableMessage: primaryBlockingReason === null ? "Mission dependencies are ready for command preflight." : primaryBlockingReason.actionableMessage ?? "Mission start is blocked until the primary readiness issue is repaired.",
    generatedAt: new Date().toISOString(),
    components: [...components],
    primaryBlockingReason,
    blockingReasons,
    warnings,
  };
};

const buildMissionStartPreflightComponents = (input: {
  requestedPlatformId: RequestedPlatformId;
  selectedMapId: string;
  taskTemplateId?: string | null;
  activationId?: string | null;
  activationSnapshotRef?: string | null;
  targetProfileRef?: string | null;
  selectedMapOk: boolean;
  commandContractOk: boolean;
  commandSchemaOk: boolean;
  commandSchemaDetail: string;
  browserDetail: string;
  browserOk: boolean;
  openLocalProgramDetail: string;
  openLocalProgramOk: boolean;
  requiresOpenLocalProgram: boolean;
  localAiDetail: string;
  localAiOk: boolean;
  dataStoreDetail: string;
  dataStoreOk: boolean;
}): MissionStartPreflightComponent[] => [
  { name: "requestedPlatform", ok: true, detail: `requestedPlatformId=${input.requestedPlatformId}`, ownerResponsible: "Commander Console / Orchestration", actionableMessage: "Provide an explicit requestedPlatformId before dispatching the mission command." },
  { name: "selectedMap", ok: input.selectedMapOk, detail: input.selectedMapOk ? `selectedMapId=${input.selectedMapId}` : `selectedMapId=${input.selectedMapId} is not an active approved map`, ownerResponsible: "Commander Console / Orchestration", actionableMessage: "Choose an active approved task template or map binding before retrying mission start." },
  { name: "commandTransportContract", ok: input.commandContractOk, detail: input.commandContractOk ? `taskTemplateId=${input.taskTemplateId}; activationId=${input.activationId}; activationSnapshotRef=${input.activationSnapshotRef}; targetProfileRef=${input.targetProfileRef}; runId=generated-before-transport` : "selected task binding is missing taskTemplateId, activationId, activationSnapshotRef, or targetProfileRef before command dispatch", ownerResponsible: "Commander Console / Nerve Bus / Orchestration", actionableMessage: "Repair the selected task binding so command envelope, transport result, and runtime proof can preserve explicit runId and activation refs before dispatch." },
  { name: "missionCommandSchema", ok: input.commandSchemaOk, detail: input.commandSchemaOk ? "MissionCommandSchema accepts the final start-mission command shape before dispatch." : `MissionCommandSchema rejected the final start-mission command shape before dispatch: ${input.commandSchemaDetail}`, ownerResponsible: "Commander Console / Orchestration", actionableMessage: "Repair start-mission command construction before dispatch so COMMAND_REJECTED is not discovered after Nerve Bus dispatch." },
  { name: "browserController", ok: input.browserOk, detail: input.browserDetail, ownerResponsible: "Commander Console / Local Browser Session", actionableMessage: "Restore the governed local browser session before retrying mission start." },
  ...(input.requiresOpenLocalProgram ? [{ name: "openLocalProgram" as const, ok: input.openLocalProgramOk, detail: input.openLocalProgramDetail, ownerResponsible: "Open Capability / Local Runtime", actionableMessage: "Repair BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED or install the governed iPhone Mirroring profile before starting this mission." }] : []),
  { name: "localAi", ok: input.localAiOk, detail: input.localAiDetail, ownerResponsible: "AI Capability / Local AI Runtime", actionableMessage: "Start Ollama or repair the local AI runtime before starting this mission." },
  { name: "dataStore", ok: input.dataStoreOk, detail: input.dataStoreDetail, ownerResponsible: "Forensics Persistence", actionableMessage: "Repair the local Forensics store before starting this mission." },
];

const buildBlockedMissionStartPreflight = (components: MissionStartPreflightComponent[]) => {
  const blockingComponents = components.filter((component) => component.ok !== true);
  return {
    status: "blocked" as const,
    actionableMessage: `Mission start is blocked: ${blockingComponents.map((component) => `${component.name}=${component.detail}`).join("; ")}`,
    failureReason: blockingComponents.map((component) => `${component.name}=${component.detail}`).join("; "),
    nextAction: blockingComponents.map((component) => component.actionableMessage).join(" "),
    ownerResponsible: [...new Set(blockingComponents.map((component) => component.ownerResponsible))].join(" / "),
    components,
  };
};

export const getMissionStartPreflight = async (
  runtime: WorkbenchRuntime,
  input: {
    requestedPlatformId: RequestedPlatformId;
    selectedMapId: string;
    taskTemplateId?: string | null;
    activationId?: string | null;
    activationSnapshotRef?: string | null;
    targetProfileRef?: string | null;
  },
): Promise<{
  status: "passed" | "blocked";
  actionableMessage: string;
  failureReason: string | null;
  nextAction: string;
  ownerResponsible: string;
  components: MissionStartPreflightComponent[];
}> => {
  const [dataStoreHealth, localAiHealth, localAiRuntimeHealth] = await Promise.all([
    runtime.evidenceStore.getHealth(),
    runtime.aiAbilityGroup.getHealth(),
    runtime.aiAbilityGroup.getRuntimeHealth(),
  ]);
  const browserHealth = runtime.browserController.getHealth();
  const openLocalProgramReadiness = getOpenLocalProgramAdapterReadiness();
  const requiresOpenLocalProgram = input.requestedPlatformId === "macos-local" || input.requestedPlatformId === "iphone-mirroring-facebook-app" || input.requestedPlatformId === "iphone-mirroring-tiktok-app";
  const availableMapIds = new Set(runtime.orchestrationAbilityGroup.listMapIds());
  const selectedMapOk = availableMapIds.has(input.selectedMapId);
  const commandContractOk = Boolean(input.taskTemplateId && input.activationId && input.activationSnapshotRef && input.targetProfileRef);
  const commandSchemaCheck = checkMissionCommandSchemaPreflight(input);
  const commandSchemaOk = commandContractOk && commandSchemaCheck.success;
  const components = buildMissionStartPreflightComponents({
    requestedPlatformId: input.requestedPlatformId,
    selectedMapId: input.selectedMapId,
    taskTemplateId: input.taskTemplateId ?? null,
    activationId: input.activationId ?? null,
    activationSnapshotRef: input.activationSnapshotRef ?? null,
    targetProfileRef: input.targetProfileRef ?? null,
    selectedMapOk,
    commandContractOk,
    commandSchemaOk,
    commandSchemaDetail: describeMissionCommandSchemaPreflight(commandSchemaCheck),
    browserDetail: browserHealth.detail,
    browserOk: browserHealth.ok,
    openLocalProgramDetail: openLocalProgramReadiness.ok ? openLocalProgramReadiness.detail : `${openLocalProgramReadiness.code}: ${openLocalProgramReadiness.detail}`,
    openLocalProgramOk: !requiresOpenLocalProgram || openLocalProgramReadiness.ok,
    requiresOpenLocalProgram,
    localAiDetail: `${localAiHealth.detail}; lastTask=${localAiRuntimeHealth.lastTaskType ?? "none"}; lastStatus=${localAiRuntimeHealth.lastInvocationStatus ?? "none"}; lastFailure=${localAiRuntimeHealth.lastFailureReason ?? "none"}`,
    localAiOk: localAiHealth.ok,
    dataStoreDetail: dataStoreHealth.detail,
    dataStoreOk: dataStoreHealth.ok,
  });
  if (components.every((component) => component.ok === true)) {
    return { status: "passed", actionableMessage: "Mission preflight passed. Commander Console can dispatch the governed human command.", failureReason: null, nextAction: "Dispatch the governed human command through Commander Console and Nerve Bus.", ownerResponsible: "Commander Console", components };
  }
  return buildBlockedMissionStartPreflight(components);
};

export const getModeInfo = (runtime: WorkbenchRuntime) => {
  const session = runtime.browserController.getSessionState();
  const platformMode = PLATFORM_MODE_INFO[runtime.options.platformTarget];
  return {
    dataMode: "Real Platform" as const,
    platformId: runtime.options.platformTarget,
    platformLabel: platformMode.platformLabel,
    realPlatformConnection: runtime.browserController.getHealth().detail,
    browserMode: session.browserMode,
    browserExecutable: session.browserExecutable,
    browserProfileRef: session.browserProfileRef,
    browserProfileStatus: session.profileStatus,
    browserProfileDirectory: session.profileDirectory,
    browserProfileProvisioning: session.profileProvisioning,
    browserProfileVerificationStatus: session.profileVerificationStatus,
    browserProfileVerificationReason: session.profileVerificationReason ?? "profile verification not required",
    loginState: session.loginState,
    lastLoginCheckAt: session.lastLoginCheckAt,
    loginRequiredReason: session.loginRequiredReason,
    reviewRequiredReason: session.reviewRequiredReason,
    storeScope: "Authorized local profile + local evidence store",
    executionMode: platformMode.executionMode,
    fallbackMode: platformMode.fallbackMode,
    geometryGuard: platformMode.geometryGuard,
    viewport: platformMode.viewport,
    calibration: platformMode.calibration,
    orientation: platformMode.orientation,
  };
};

export const listCapabilityRoster = async () => [...CAPABILITY_ROSTER];
