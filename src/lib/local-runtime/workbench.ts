import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  createCommanderConsoleAbilityGroup,
} from "../../capabilities/commander-console/index.js";
import type {
  CommanderAuditSummary,
  CommanderConsoleAbilityGroup,
  CommanderHumanCommandEnvelope,
  CommanderMissionDashboardView,
} from "../../capabilities/commander-console/index.js";
import {
  createOrchestrationAbilityGroup,
  OperationalMapIdSchema,
  type OrchestrationAbilityGroup,
  type RequestedPlatformId,
} from "../../capabilities/orchestration/index.js";
import type { OpenAbilityGroup } from "../../capabilities/open/contract.js";
import type { OpenRequest, OpenResult } from "../../capabilities/open/contract.js";
import { createOpenAbilityGroup } from "../../capabilities/open/index.js";
import { AI_ABILITY_GROUP_ID, createAiAbilityGroup, type AiAbilityGroup } from "../../capabilities/ai/index.js";
import { createAiModelRosterPort } from "../../capabilities/ai/model-roster.js";
import { createAiPromptRegistry } from "../../capabilities/ai/runtime/ai-prompt-registry.js";
import { createSystemAiClock } from "../../capabilities/ai/runtime/ai-clock.js";
import { createLocalAiRuntimePort, type AiRuntimeStructuredDebugEvent } from "../../capabilities/ai/runtime-adapters/local-ai-runtime-adapter.js";
import {
  createForensicsPersistenceAbilityGroup,
  type ForensicsArtifactRef,
  type ForensicsPersistenceAbilityGroup,
} from "../../capabilities/forensics-persistence/index.js";
import { createMouseClickAbilityGroup, type MouseClickAbilityGroup } from "../../capabilities/mouse-click/index.js";
import { createSystemMouseClickClock } from "../../capabilities/mouse-click/runtime/mouse-click-clock.js";
import { createMouseClickIdempotencyRegistry } from "../../capabilities/mouse-click/runtime/mouse-click-idempotency.js";
import { createTextInputAbilityGroup, type TextInputAbilityGroup } from "../../capabilities/text-input/index.js";
import { createSystemTextInputClock } from "../../capabilities/text-input/runtime/text-input-clock.js";
import { createMouseScrollAbilityGroup, type MouseScrollAbilityGroup } from "../../capabilities/mouse-scroll/index.js";
import { createDefaultPageStateRuntimeContext, createPageStateAbilityGroup, type PageStateAbilityGroup } from "../../capabilities/page-state/index.js";
import { createPostActionVerificationAbilityGroup, type PostActionVerificationAbilityGroup } from "../../capabilities/post-action-verification/index.js";
import {
  createGeometryGuardAbilityGroup,
  type GeometryGuardAbilityGroup,
} from "../../capabilities/geometry-guard/index.js";
import {
  createScreenshotAbilityGroup,
  type ScreenshotAbilityGroup,
} from "../../capabilities/screenshot/index.js";
import {
  createBrowserControllerScreenshotCapturePort,
  createFilesystemScreenshotArtifactPort,
  createSharpScreenshotImageProcessingPort,
  createSystemScreenshotClockPort,
} from "../../capabilities/screenshot/adapters/index.js";
import {
  createSystemVisualTargetClock,
  createVisualTargetAbilityGroup,
  createVisualTargetRuntimeContext,
  type VisualTargetAbilityGroup,
} from "../../capabilities/visual-target/index.js";
import {
  type AiResponseEnvelope,
  createNerveBusAbilityGroup,
  type HumanCommandDispatchInput,
  type AbilityCommandEnvelope,
  type AbilityResultEnvelope,
  type HumanCommandEnvelope,
  type HumanCommandResultEnvelope,
  type NerveBusAbilityGroup,
  type NerveBusHandledResult,
  type NerveBusPayloadDocument,
} from "../../capabilities/nerve-bus/index.js";
import {
  createEvidenceStoreForensicsArtifactStoragePort,
  createEvidenceStoreForensicsRecordStoragePort,
} from "../storage/evidence-store/forensics-storage-adapter.js";
import { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";
import type { BrowserController } from "../browser/browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";
import { createBrowserControllerTextInputExecutionPort } from "../browser/text-input-primitive-port.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";
import { createSystemClipboardPort } from "../browser/system-clipboard-port.js";
import { createMouseScrollExecutionContext } from "../../capabilities/mouse-scroll/runtime/mouse-scroll-execution-context.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";
import { getDefaultLocalDataDir } from "./default-data-dir.js";
import { createId } from "./ids.js";
import type { MissionReadinessReport, RuntimeHealthReport } from "../../types/runtime.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { VisionProductPresenceRequestInputSchema } from "../../types/vision-product-presence.js";
import {
  createStructuredTerminalLogListener,
  isStructuredLogStdoutEnabled,
  resolveStructuredLogLevel,
  StructuredLogBus,
} from "./structured-log-bus.js";
export type GrassEyePlatformTarget = "tiktok-web";

const PLATFORM_MODE_INFO = {
  "tiktok-web": {
    platformLabel: "TikTok web governed map runtime",
    executionMode: "Ability-group governed runtime",
    fallbackMode: "No platform-owned fallback chain",
    geometryGuard: "Capability-owned at execution time",
    viewport: "Derived from governed browser session",
    calibration: "Held by Geometry Guard runtime proof",
    orientation: "capability-owned",
  },
} as const;

type GrassEyeWorkbenchOptions = {
  dataDir?: string;
  baseUrl: string;
  platformTarget: GrassEyePlatformTarget;
  realPlatformUrl?: string;
  browserHeadless?: boolean;
  browserProfileDirectory?: string;
};

type CommanderBrowserSessionSnapshot = ReturnType<BrowserController["getSessionState"]>;

type MissionStartPreflightComponent = {
  name: "requestedPlatform" | "selectedMap" | "browserController" | "localAi" | "dataStore";
  ok: boolean;
  detail: string;
  ownerResponsible: string;
  actionableMessage: string;
};

function resolveMissionBindingReadinessComponent(mission: Awaited<ReturnType<OrchestrationAbilityGroup["getMissionState"]>>): MissionReadinessReport["components"][number] {
  if (mission.mapId !== null) {
    return {
      name: "mission",
      ok: true,
      detail: `mission_status=${mission.status}; selectedMapId=${mission.mapId}; requestedPlatformId=${mission.requestedPlatform ?? "none"}; round=${mission.currentRoundIndex}`,
      ownerResponsible: "Orchestration",
      actionableMessage: "Mission binding already exists for the active run.",
      severity: "info",
      source: "active-mission",
    };
  }

  const activeRegistry = getDefaultMapPluginRegistry().active;
  const readyTemplates = activeRegistry.listOrdinaryTaskTemplates().filter((template) => template.availability === "ready");
  if (readyTemplates.length === 0) {
    return {
      name: "mission",
      ok: false,
      detail: "no active approved task template can resolve a governed map binding",
      ownerResponsible: "Orchestration / Map Plugin Registry",
      actionableMessage: "Activate at least one approved task template before starting a mission.",
      severity: "blocked",
      source: "active-task-template-feed",
    };
  }

  const defaultTemplate = readyTemplates[0];
  if (!defaultTemplate) {
    return {
      name: "mission",
      ok: false,
      detail: "active task-template feed became empty during readiness evaluation",
      ownerResponsible: "Orchestration / Map Plugin Registry",
      actionableMessage: "Retry readiness after the active registry settles on at least one approved task template.",
      severity: "blocked",
      source: "active-task-template-feed",
    };
  }
  const binding = activeRegistry.getTaskTemplateDeveloperBinding(defaultTemplate.taskTemplateId);
  if (!binding) {
    return {
      name: "mission",
      ok: false,
      detail: `taskTemplateId=${defaultTemplate.taskTemplateId} is active but missing an approved developer binding`,
      ownerResponsible: "Orchestration / Map Plugin Registry",
      actionableMessage: "Repair the active task template binding before starting a mission.",
      severity: "blocked",
      source: "active-task-template-feed",
    };
  }

  return {
    name: "mission",
    ok: true,
    detail: `launchBinding taskTemplateId=${binding.taskTemplateId}; selectedMapId=${binding.mapId}; requestedPlatformId=${binding.requestedPlatformId}; readyTemplates=${readyTemplates.length}`,
    ownerResponsible: "Orchestration / Map Plugin Registry",
    actionableMessage: readyTemplates.length === 1
      ? "Mission start binding will be resolved from the active approved task template at command time."
      : "Mission start binding will be resolved from the selected approved task template at command time.",
    severity: "info",
    source: "active-task-template-feed",
  };
}

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

function resolveAiDebugChildCapabilityId(taskType: AiRuntimeStructuredDebugEvent["taskType"]): "local-vision-ai" | "local-text-ai" | "local-ocr-ai" | "internal-schema-validator" {
  switch (taskType) {
    case "ocr_cleanup":
      return "local-ocr-ai";
    case "comment_signal_summary":
    case "product_signal_summary":
    case "evidence_packet_analysis":
      return "local-text-ai";
    case "schema_validation_only":
      return "internal-schema-validator";
    default:
      return "local-vision-ai";
  }
}

function resolveAiDebugStep(taskType: AiRuntimeStructuredDebugEvent["taskType"]): "ask_ai_product_presence" | "extract_visible_comments" | "summarize_comment_signals" | "create_pending_candidate" | "validate_ai_output" {
  switch (taskType) {
    case "ocr_cleanup":
      return "extract_visible_comments";
    case "comment_signal_summary":
      return "summarize_comment_signals";
    case "product_signal_summary":
    case "evidence_packet_analysis":
      return "create_pending_candidate";
    case "schema_validation_only":
      return "validate_ai_output";
    default:
      return "ask_ai_product_presence";
  }
}

export class GrassEyeWorkbench {
  readonly structuredLogBus: StructuredLogBus;
  readonly evidenceStore: EvidenceStoreService;
  readonly browserController: BrowserController;
  readonly aiAbilityGroup: AiAbilityGroup;
  readonly forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  readonly openAbilityGroup: OpenAbilityGroup;
  readonly mouseClickAbilityGroup: MouseClickAbilityGroup;
  readonly textInputAbilityGroup: TextInputAbilityGroup;
  readonly mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  readonly pageStateAbilityGroup: PageStateAbilityGroup;
  readonly postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup;
  readonly screenshotAbilityGroup: ScreenshotAbilityGroup;
  readonly visualTargetAbilityGroup: VisualTargetAbilityGroup;
  readonly geometryGuardAbilityGroup: GeometryGuardAbilityGroup;
  readonly nerveBusAbilityGroup: NerveBusAbilityGroup;
  readonly orchestrationAbilityGroup: OrchestrationAbilityGroup;
  readonly commanderConsole: CommanderConsoleAbilityGroup;
  readonly browserSessionConfig;

  constructor(private readonly options: GrassEyeWorkbenchOptions) {
    const dataDir = options.dataDir ?? getDefaultLocalDataDir();
    this.structuredLogBus = new StructuredLogBus();
    if (isStructuredLogStdoutEnabled()) {
      this.structuredLogBus.subscribe(createStructuredTerminalLogListener(resolveStructuredLogLevel()));
    }
    this.evidenceStore = new EvidenceStoreService(dataDir, this.structuredLogBus);
        this.nerveBusAbilityGroup = createNerveBusAbilityGroup({
          handlerPort: {
            dispatchAbilityCommand: async ({ envelope, inputPayload }) => this.dispatchAbilityCommandEnvelope(envelope, inputPayload),
            dispatchHumanCommand: async ({ envelope, inputPayload }) => this.handleHumanCommandEnvelope(envelope, inputPayload),
            requestAi: async ({ envelope, inputPayload }) => {
            const taskType = "product_presence_judgment" as const;
            const input = VisionProductPresenceRequestInputSchema.parse(this.payloadDocumentToObject(inputPayload));
            const aiResult = await this.aiAbilityGroup.execute({
              abilityGroupId: AI_ABILITY_GROUP_ID,
              missionId: envelope.missionId,
              taskType,
              inputModality: "image_collection",
              inputRefs: [],
              promptContractId: "vision.productPresence.v1",
              expectedOutputSchema: "ai.product_presence_judgment.v1",
              requestedBy: "orchestration",
              transportedBy: "nerve-bus",
              sessionId: envelope.missionId,
              roundId: envelope.stepId,
              videoVisitId: null,
              qualityPolicy: { minimumConfidence: 0.6, requireSchemaValidation: true },
              providerPolicy: { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["local-vision-ai"], operatorApprovalRef: null },
              costPolicy: { maxEstimatedCost: 0 },
              dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
              safetyPolicy: { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true },
              input,
            });
            const status = aiResult.status;
            const aiTaskType = aiResult.taskType ?? "dispatch_failure";
            const aiConfidence = "confidence" in aiResult ? aiResult.confidence : null;
            const outputPayload = this.buildPayloadDocument({
              documentType: "ai.response",
              documentRef: `${envelope.requestId}:response`,
              summary: status === "success" ? "AI response accepted." : (aiResult.failureReason ?? "AI response failed."),
              content: {
                aiTaskType,
                confidence: aiConfidence,
                failureReason: aiResult.failureReason,
              },
            });
            return {
              envelope: {
                ...this.buildTransportEnvelopeBase({
                  channelId: "ai-to-orchestration",
                  envelopeId: `${envelope.envelopeId}:response`,
                  missionId: envelope.missionId,
                  mapId: envelope.mapId,
                  stepId: envelope.stepId,
                  inputRef: envelope.inputRef,
                  payloadRefs: outputPayload.evidenceRefs.length > 0 ? Object.fromEntries(outputPayload.evidenceRefs.map((ref) => [ref, ref])) : { output: outputPayload.documentRef },
                  summary: outputPayload.summary,
                  tags: ["ai", aiTaskType],
                }),
                envelopeKind: "ai_response",
                responseId: `${envelope.requestId}:response`,
                from: "ai",
                to: "orchestration",
                status,
                decision: aiTaskType,
                confidence: aiConfidence,
                outputRef: outputPayload.documentRef,
                diagnosticPayloadRef: null,
                failureReason: status === "failed" ? aiResult.failureReason : null,
                reviewRequiredReason: aiResult.status === "review_required" ? aiResult.reviewRequiredReason : null,
              },
              outputPayload,
            } satisfies NerveBusHandledResult<AiResponseEnvelope>;
          },
        },
        });
        this.orchestrationAbilityGroup = createOrchestrationAbilityGroup({
          nerveBus: this.nerveBusAbilityGroup,
        });
        this.commanderConsole = createCommanderConsoleAbilityGroup({
          defaultOperatorRef: "commander-console:operator",
          commandTransport: {
            emitHumanCommand: async (command) => {
              const transport = await this.nerveBusAbilityGroup.dispatchHumanCommand(this.buildHumanCommandDispatchInput(command));
              const status = transport.resultEnvelope.status === "success"
                ? "accepted"
                : transport.resultEnvelope.status;
              return {
                commandId: command.commandId,
                envelopeRef: transport.commandEnvelope.envelopeId,
                resultEnvelopeRef: transport.resultEnvelope.envelopeId,
                status,
                failureReason: transport.resultEnvelope.failureReason,
                reviewRequiredReason: transport.resultEnvelope.status === "review_required"
                  ? (transport.resultEnvelope.failureReason ?? "review required")
                  : null,
                message: this.describeHumanCommandTransportMessage(transport.resultEnvelope),
                debugLogRef: null,
              };
            },
          },
          missionReadModel: {
            readMission: async () => {
              const mission = await this.orchestrationAbilityGroup.getMissionState();
              const missionStatus = mission.status === "pending" ? "idle" : mission.status;
              const lastHumanCommand = mission.lastHumanCommand === "submit-review-decision"
                ? null
                : mission.lastHumanCommand;
              return {
                missionId: mission.missionId,
                humanGoal: mission.humanGoal ?? "",
                status: missionStatus,
                missionRunRef: mission.activeTaskRunId,
                currentRoundIndex: mission.currentRoundIndex,
                requestedPlatform: mission.requestedPlatform,
                selectedMapId: mission.mapId,
                lastHumanCommand,
                reviewRequiredReason: mission.reviewRequiredReason,
                failureReason: mission.failureReason,
                startedAt: mission.startedAt,
                updatedAt: mission.updatedAt,
                endedAt: mission.endedAt,
              };
            },
          },
          forensicsReadModel: {
            listCandidates: async () => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              return state.candidates.map((candidate) => ({
                id: candidate.id,
                category: candidate.category,
                useCase: candidate.useCase,
                score: candidate.score,
                purchaseIntent: candidate.purchaseIntent,
                reviewStatus:
                  candidate.reviewStatus === "approve"
                    ? "approved"
                    : candidate.reviewStatus === "reject"
                      ? "rejected"
                      : candidate.reviewStatus,
                evidenceCount: candidate.evidenceRefs.length,
                notes: candidate.notes,
                createdAt: candidate.createdAt,
                updatedAt: candidate.updatedAt,
              }));
            },
            listReviewQueue: async () => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              return state.candidates
                .filter((candidate) => candidate.reviewStatus === "pending" || candidate.reviewStatus === "hold")
                .map((candidate) => ({
                  id: candidate.id,
                  primary: candidate.category,
                  secondary: candidate.useCase,
                  detail: candidate.reviewStatus,
                }));
            },
            listEvidencePackets: async (limit = 50) => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              return state.evidencePackets.slice(-limit).reverse().map((packet) => ({
                id: packet.packetId,
                primary: packet.roundId,
                secondary: packet.roundOutcome,
                detail: packet.candidate.candidateId ?? "no_candidate",
              }));
            },
            listBrowseLedger: async (limit = 50) => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              return state.browseLedgerEntries.slice(-limit).reverse().map((entry) => ({
                id: entry.roundId,
                primary: entry.videoVisitId,
                secondary: entry.browseOutcome,
                detail: entry.productPresenceDecision,
              }));
            },
            listFailedRecords: async (limit = 50) => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              return state.structuredRuntimeEvents
                .filter((event) => event.status === "failed" || event.status === "review_required")
                .slice(-limit)
                .reverse()
                .map((event) => ({
                  id: event.eventId,
                  primary: event.eventType,
                  secondary: event.step,
                  detail: event.failureReason ?? event.reviewRequiredReason ?? event.reason ?? "runtime failure",
                }));
            },
            inspectRecordDetail: async (recordId) => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              const candidate = state.candidates.find((item) => item.id === recordId);
              if (candidate) {
                return {
                  recordType: "candidate" as const,
                  recordId: candidate.id,
                  title: `${candidate.category} / ${candidate.useCase}`,
                  summary: candidate.reviewStatus,
                  details: candidate.notes,
                  status: candidate.reviewStatus,
                  createdAt: candidate.createdAt,
                };
              }

              const packet = state.evidencePackets.find((item) => item.packetId === recordId);
              if (packet) {
                return {
                  recordType: "evidence-packet" as const,
                  recordId: packet.packetId,
                  title: packet.roundId,
                  summary: packet.roundOutcome,
                  details: [packet.candidate.candidateId ?? "no_candidate"],
                  status: packet.roundOutcome,
                  createdAt: packet.capturedAt,
                };
              }

              const ledger = state.browseLedgerEntries.find((item) => item.roundId === recordId);
              if (ledger) {
                return {
                  recordType: "browse-ledger" as const,
                  recordId: ledger.roundId,
                  title: ledger.videoVisitId,
                  summary: ledger.browseOutcome,
                  details: [ledger.productPresenceDecision],
                  status: ledger.browseOutcome,
                  createdAt: ledger.observedAt,
                };
              }

              const runtimeEvent = state.structuredRuntimeEvents.find((item) => item.eventId === recordId);
              if (runtimeEvent) {
                return {
                  recordType: "runtime-event" as const,
                  recordId: runtimeEvent.eventId,
                  title: runtimeEvent.eventType,
                  summary: runtimeEvent.step,
                  details: [runtimeEvent.failureReason ?? runtimeEvent.reviewRequiredReason ?? runtimeEvent.reason ?? runtimeEvent.status],
                  status: runtimeEvent.status,
                  createdAt: runtimeEvent.createdAt,
                };
              }

              return {
                recordType: "not-found" as const,
                recordId,
                title: "Record not found",
                summary: `No governed record matches ${recordId}`,
                details: [],
                status: null,
                createdAt: null,
              };
            },
          },
          capabilityHealthReadModel: {
            readRuntimeSummary: async () => {
              const mission = await this.orchestrationAbilityGroup.getMissionState();
              const state = await this.evidenceStore.getOperatorSnapshot();
              const runtimeStatus = mission.status === "pending" ? "idle" : mission.status;
              return {
                runtimeStatus,
                currentStep: mission.currentStepId,
                reviewReason: mission.reviewRequiredReason,
                totalSeenCount: state.roundStructuralLogs.length,
                evidencePacketCount: state.evidencePackets.length,
                browseLedgerCount: state.browseLedgerEntries.length,
                candidateCount: state.candidates.length,
                lastAiFailureReason: mission.failureReason,
              };
            },
            readBrowserSummary: async () => {
              const mode = this.getModeInfo();
              return {
                browserMode: mode.browserMode,
                browserExecutable: mode.browserExecutable,
                browserProfileRef: mode.browserProfileRef,
                browserProfileStatus: mode.browserProfileStatus,
                loginState: mode.loginState,
                executionMode: mode.executionMode,
                geometryGuard: mode.geometryGuard,
                viewport: mode.viewport,
                calibration: mode.calibration,
              };
            },
            listHealthSummaries: async () => {
              const [health, readiness] = await Promise.all([
                this.getHealthReport(),
                this.getMissionReadinessReport(),
              ]);
              return [
                {
                  id: "app-shell",
                  label: "app-shell",
                  tone: health.status === "ready" ? "good" : "danger",
                  detail: health.actionableMessage,
                },
                ...readiness.components.map((component) => {
                  const tone: "good" | "warn" | "danger" = component.ok
                    ? "good"
                    : component.severity === "warning"
                      ? "warn"
                      : "danger";
                  return {
                    id: component.name,
                    label: component.name,
                    tone,
                    detail: component.detail,
                    ownerResponsible: component.ownerResponsible ?? null,
                    actionableMessage: component.actionableMessage ?? null,
                  };
                }),
              ];
            },
            listCapabilityRoster: async () => {
              return [...CAPABILITY_ROSTER];
            },
          },
          auditReadModel: {
            readAuditSummary: async () => this.readAuditSummary(),
          },
          runtimeProofReadModel: {
            listRuntimeProofEntries: async (limit = 50) => {
              const state = await this.evidenceStore.getOperatorSnapshot();
              return state.structuredRuntimeEvents.slice(-limit).reverse().map((event) => ({
                id: event.eventId,
                createdAt: event.createdAt,
                step: event.step,
                status: event.status,
                message: event.failureReason ?? event.reviewRequiredReason ?? event.reason ?? event.eventType,
              }));
            },
          },
        });
    this.forensicsPersistenceAbilityGroup = createForensicsPersistenceAbilityGroup({
      recordStorage: createEvidenceStoreForensicsRecordStoragePort(this.evidenceStore),
      artifactStorage: createEvidenceStoreForensicsArtifactStoragePort(),
    });
    this.aiAbilityGroup = createAiAbilityGroup({
      runtime: createLocalAiRuntimePort({
        emitDebugEvent: async (event) => this.recordAiDebugEvent(event),
      }),
      clock: createSystemAiClock(),
      modelRoster: createAiModelRosterPort(),
      promptRegistry: createAiPromptRegistry(),
    });
    if (options.platformTarget !== "tiktok-web") {
      throw new Error(`Unsupported GrassEye platform target: ${options.platformTarget}`);
    }
    this.browserSessionConfig = createLocalBrowserSessionConfig({
      platform: options.platformTarget,
      ...(options.browserProfileDirectory ? { profileDirectory: options.browserProfileDirectory } : {}),
    });
    this.browserController = new CurrentChromeBrowserController({
      sessionConfig: this.browserSessionConfig,
      screenshotDir: path.join(dataDir, "browser-captures"),
      headlessRequested: options.browserHeadless === true,
    });
    this.screenshotAbilityGroup = createScreenshotAbilityGroup({
      capturePort: createBrowserControllerScreenshotCapturePort(this.browserController),
      artifactPort: createFilesystemScreenshotArtifactPort(path.join(dataDir, "artifacts", "screenshot")),
      imageProcessingPort: createSharpScreenshotImageProcessingPort(),
      clockPort: createSystemScreenshotClockPort(),
    });
    this.mouseClickAbilityGroup = createMouseClickAbilityGroup({
      context: {
        primitivePort: createBrowserControllerMouseClickPrimitivePort({
          browserController: this.browserController,
        }),
        clock: createSystemMouseClickClock(),
        idempotency: createMouseClickIdempotencyRegistry(),
      },
    });
    this.textInputAbilityGroup = createTextInputAbilityGroup({
      context: {
        executionPort: createBrowserControllerTextInputExecutionPort({
          browserController: this.browserController,
        }),
        clipboardPort: createSystemClipboardPort(),
        clock: createSystemTextInputClock(),
      },
    });
    this.mouseScrollAbilityGroup = createMouseScrollAbilityGroup({
      context: createMouseScrollExecutionContext({
        primitivePort: createBrowserControllerMouseScrollPrimitivePort({
          browserController: this.browserController,
        }),
      }),
    });
    this.pageStateAbilityGroup = createPageStateAbilityGroup(createDefaultPageStateRuntimeContext());
    this.postActionVerificationAbilityGroup = createPostActionVerificationAbilityGroup({
      clock: {
        portKind: "post-action-verification-clock",
        now() {
          const epochMs = Date.now();
          const monotonicMs = typeof globalThis.performance?.now === "function"
            ? globalThis.performance.now()
            : epochMs;
          return {
            isoTimestamp: new Date(epochMs).toISOString(),
            monotonicMs,
          };
        },
      },
      evidenceReadPort: {
        listObservations(request) {
          return request.observationSet.observations;
        },
        getObservationByRef(request, ref) {
          return request.observationSet.observations.find((observation) => observation.ref === ref) ?? null;
        },
        getEvidenceByRef(request, ref) {
          return [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence]
            .find((evidence) => evidence?.evidenceRef === ref) ?? null;
        },
        getActionLogByRef(request, ref) {
          const actionLogRef = request.actionProof.actionLogRef ?? request.actionProof.actionRecordRef;
          if (actionLogRef !== ref) {
            return null;
          }
          return {
            actionLogRef: ref,
            sourceRuntimeProofRef: request.actionProof.sourceRuntimeProofRef,
            sourceActionResultRef: request.actionProof.sourceActionResultRef,
            sourceActionOutputRef: request.actionProof.sourceActionOutputRef,
          };
        },
        verifyProofRef(request, ref) {
          if (request.actionProof.sourceRuntimeProofRef === ref) {
            return true;
          }
          if (request.beforeAfterEvidence.beforeEvidence?.source.sourceProofRef === ref || request.beforeAfterEvidence.afterEvidence?.source.sourceProofRef === ref) {
            return true;
          }
          return request.observationSet.observations.some((observation) => observation.source.sourceProofRef === ref);
        },
        verifyEvidenceBinding(request, evidenceRef) {
          return [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence]
            .some((evidence) => evidence?.evidenceRef === evidenceRef && evidence.sessionId === request.sessionId && evidence.roundId === request.roundId && evidence.videoVisitId === request.videoVisitId);
        },
      },
    });
    this.visualTargetAbilityGroup = createVisualTargetAbilityGroup({
      runtimeContext: createVisualTargetRuntimeContext({
        clock: createSystemVisualTargetClock(),
      }),
    });
    this.geometryGuardAbilityGroup = createGeometryGuardAbilityGroup();
    this.openAbilityGroup = createOpenAbilityGroup({
      browser: {
        getSessionSnapshot: async () => this.browserController.getSessionState(),
        open: async (openInput) => {
          if (openInput.abortSignal.aborted) {
            throw new Error("open browser adapter aborted before navigation dispatch");
          }

          const abortPromise = new Promise<never>((_, reject) => {
            openInput.abortSignal.addEventListener(
              "abort",
              () => reject(new Error("open browser adapter aborted during navigation dispatch")),
              { once: true },
            );
          });

          const actionResult = await Promise.race([
            this.browserController.open({
              url: openInput.url,
              title: openInput.title ?? "",
            }),
            abortPromise,
          ]);

          return {
            browserActionId: actionResult.browserActionId,
            ok: actionResult.ok,
            message: actionResult.message,
            createdAt: actionResult.createdAt,
            openedUrl: openInput.url,
            pageTitleAfter: null,
            redirectChain: [openInput.url],
            portKind: "current-chrome-browser-controller",
          };
        },
      },
      profilePort: {
        resolveProfileOverride: ({ childCapabilityId }) => {
          if (childCapabilityId !== "open-local-workbench") {
            return null;
          }

          const workbenchUrl = new URL(this.options.baseUrl);
          return {
            defaultUrl: workbenchUrl.toString(),
            defaultTitle: "GrassEye Local Workbench",
            allowedHostnames: [workbenchUrl.hostname],
          };
        },
      },
    });
  }

  async init(): Promise<void> {
    await this.evidenceStore.init();
  }

  async getHealthReport(): Promise<RuntimeHealthReport> {
    const dataStoreHealth = await this.evidenceStore.getHealth();
    const mission = await this.orchestrationAbilityGroup.getMissionState();
    const browserHealth = this.browserController.getHealth();
    const components = [
      { name: "console", ok: true, detail: "Commander Console route ready" },
      { name: "agent", ok: true, detail: `mission_status=${mission.status}; map=${mission.mapId ?? "none"}; round=${mission.currentRoundIndex}` },
      { name: "browserController", ok: browserHealth.ok, detail: browserHealth.detail },
      { name: "dataStore", ok: dataStoreHealth.ok, detail: dataStoreHealth.detail }
    ] as const;
    const ok = components.every((component) => component.ok);
    return {
      kind: "app-shell-health",
      status: ok ? "ready" : "failed",
      actionableMessage: ok
        ? "App Shell ready. Commander Console can stay open while mission dependencies are checked separately."
        : "App Shell unavailable. Repair the failing shell component before retrying startup.",
      generatedAt: new Date().toISOString(),
      components: [...components]
    };
  }

  async getMissionReadinessReport(): Promise<MissionReadinessReport> {
    const dataStoreHealth = await this.evidenceStore.getHealth();
    const mission = await this.orchestrationAbilityGroup.getMissionState();
    const browserHealth = this.browserController.getHealth();
    const localAiHealth = await this.aiAbilityGroup.getHealth();
    const localAiRuntimeHealth = await this.aiAbilityGroup.getRuntimeHealth();
    const components = [
      resolveMissionBindingReadinessComponent(mission),
      {
        name: "browserController",
        ok: browserHealth.ok,
        detail: browserHealth.detail,
        ownerResponsible: "Commander Console / Local Browser Session",
        actionableMessage: "Restore the governed local browser session before retrying mission start.",
        severity: browserHealth.ok ? "info" : "blocked",
        source: "service-health",
      },
      {
        name: "localAi",
        ok: localAiHealth.ok,
        detail: `${localAiHealth.detail}; lastTask=${localAiRuntimeHealth.lastTaskType ?? "none"}; lastStatus=${localAiRuntimeHealth.lastInvocationStatus ?? "none"}; lastFailure=${localAiRuntimeHealth.lastFailureReason ?? "none"}`,
        ownerResponsible: "AI Capability / Local AI Runtime",
        actionableMessage: "Start Ollama or repair the local AI runtime before starting this mission.",
        severity: localAiHealth.ok ? "info" : "blocked",
        source: "service-health",
      },
      {
        name: "dataStore",
        ok: dataStoreHealth.ok,
        detail: dataStoreHealth.detail,
        ownerResponsible: "Forensics Persistence",
        actionableMessage: "Repair the local Forensics store before starting this mission.",
        severity: dataStoreHealth.ok ? "info" : "blocked",
        source: "service-health",
      }
    ] as const;
    const blockingReasons = components.filter((component) => component.ok !== true);
    const warnings = components.filter((component) => component.ok && component.severity === "warning");
    const primaryBlockingReason = blockingReasons[0] ?? null;
    return {
      kind: "mission-readiness",
      status: blockingReasons.length === 0 ? "ready" : "degraded",
      actionableMessage: primaryBlockingReason === null
        ? "Mission dependencies are ready for command preflight."
        : primaryBlockingReason.actionableMessage ?? "Mission start is blocked until the primary readiness issue is repaired.",
      generatedAt: new Date().toISOString(),
      components: [...components],
      primaryBlockingReason,
      blockingReasons,
      warnings,
    };
  }

  async getMissionStartPreflight(input: {
    requestedPlatformId: RequestedPlatformId;
    selectedMapId: string;
  }): Promise<{
    status: "passed" | "blocked";
    actionableMessage: string;
    failureReason: string | null;
    nextAction: string;
    ownerResponsible: string;
    components: MissionStartPreflightComponent[];
  }> {
    const dataStoreHealth = await this.evidenceStore.getHealth();
    const browserHealth = this.browserController.getHealth();
    const localAiHealth = await this.aiAbilityGroup.getHealth();
    const localAiRuntimeHealth = await this.aiAbilityGroup.getRuntimeHealth();
    const parsedMapId = OperationalMapIdSchema.safeParse(input.selectedMapId);
    const availableMapIds = new Set(this.orchestrationAbilityGroup.listMapIds());
    const selectedMapOk = parsedMapId.success && availableMapIds.has(parsedMapId.data);
    const components: MissionStartPreflightComponent[] = [
      {
        name: "requestedPlatform",
        ok: true,
        detail: `requestedPlatformId=${input.requestedPlatformId}`,
        ownerResponsible: "Commander Console / Orchestration",
        actionableMessage: "Provide an explicit requestedPlatformId before dispatching the mission command.",
      },
      {
        name: "selectedMap",
        ok: selectedMapOk,
        detail: selectedMapOk
          ? `selectedMapId=${parsedMapId.data}`
          : `selectedMapId=${input.selectedMapId} is not an active approved map`,
        ownerResponsible: "Commander Console / Orchestration",
        actionableMessage: "Choose an active approved task template or map binding before retrying mission start.",
      },
      {
        name: "browserController",
        ok: browserHealth.ok,
        detail: browserHealth.detail,
        ownerResponsible: "Commander Console / Local Browser Session",
        actionableMessage: "Restore the governed local browser session before retrying mission start.",
      },
      {
        name: "localAi",
        ok: localAiHealth.ok,
        detail: `${localAiHealth.detail}; lastTask=${localAiRuntimeHealth.lastTaskType ?? "none"}; lastStatus=${localAiRuntimeHealth.lastInvocationStatus ?? "none"}; lastFailure=${localAiRuntimeHealth.lastFailureReason ?? "none"}`,
        ownerResponsible: "AI Capability / Local AI Runtime",
        actionableMessage: "Start Ollama or repair the local AI runtime before starting this mission.",
      },
      {
        name: "dataStore",
        ok: dataStoreHealth.ok,
        detail: dataStoreHealth.detail,
        ownerResponsible: "Forensics Persistence",
        actionableMessage: "Repair the local Forensics store before starting this mission.",
      },
    ];
    const blockingComponents = components.filter((component) => component.ok !== true);
    if (blockingComponents.length === 0) {
      return {
        status: "passed",
        actionableMessage: "Mission preflight passed. Commander Console can dispatch the governed human command.",
        failureReason: null,
        nextAction: "Dispatch the governed human command through Commander Console and Nerve Bus.",
        ownerResponsible: "Commander Console",
        components,
      };
    }

    return {
      status: "blocked",
      actionableMessage: `Mission start is blocked: ${blockingComponents.map((component) => `${component.name}=${component.detail}`).join("; ")}`,
      failureReason: blockingComponents.map((component) => `${component.name}=${component.detail}`).join("; "),
      nextAction: blockingComponents.map((component) => component.actionableMessage).join(" "),
      ownerResponsible: [...new Set(blockingComponents.map((component) => component.ownerResponsible))].join(" / "),
      components,
    };
  }

  async recordCommanderDebugEvent(input: {
    eventType: string;
    status: "started" | "success" | "failed" | "review_required";
    traceId: string;
    spanId: string;
    attemptId: string;
    missionId?: string | null;
    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
  }): Promise<void> {
    await this.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
      abilityGroupId: "forensics-persistence",
      childCapabilityId: "write-structured-runtime-event",
      recordType: "structured_runtime_event",
      requestedBy: "commander-console",
      sourceAbilityGroupId: "commander-console",
      sourceChildCapabilityId: "issue-human-command-debug",
      sessionId: input.traceId,
      roundId: input.attemptId,
      videoVisitId: null,
      sourceRecordRefs: [],
      parentRefs: [],
      artifactRefs: [],
      persistencePolicy: { mode: "append", allowPartialRefs: true },
      dataQualityFlags: [],
      payload: {
        structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
          eventId: createId("event"),
          eventType: input.eventType,
          level: "DEBUG",
          phase: "mission-command",
          component: "commander-console",
          owner: "Commander Console",
          abilityGroupId: "commander-console",
          childCapabilityId: "issue-human-command",
          skillId: null,
          skillCategory: null,
          sessionId: input.traceId,
          missionId: input.missionId ?? null,
          roundId: input.attemptId,
          videoVisitId: null,
          mapId: input.mapId ?? null,
          taskTemplateId: input.taskTemplateId ?? null,
          traceId: input.traceId,
          spanId: input.spanId,
          attemptId: input.attemptId,
          browserProfileRef: this.browserSessionConfig.profileRef,
          loginState: this.browserController.getSessionState().loginState,
          step: "task_start",
          previousStep: null,
          nextStep: null,
          status: input.status,
          reason: input.reason ?? null,
          failureReason: input.failureReason ?? null,
          reviewRequiredReason: input.status === "review_required" ? (input.failureReason ?? input.reason ?? null) : null,
          actionableMessage: input.actionableMessage ?? null,
          ownerResponsible: input.ownerResponsible ?? null,
          decision: input.decision ?? null,
          roundOutcome: null,
          finalizationType: null,
          samplingStrategy: null,
          expectedFrameCount: null,
          validFrameCount: null,
          fallbackReason: null,
          missingFrames: [],
          snapshotSummary: null,
          createdAt: new Date().toISOString(),
          durationMs: input.durationMs ?? null,
          refs: [],
          inputRefs: [],
          outputRefs: [],
          evidenceRefs: [],
          proofRefs: [],
          artifactRefs: [],
          actionLogRefs: [],
          dataQualityFlags: [],
        }),
      },
    });
  }

  async recordAiDebugEvent(input: AiRuntimeStructuredDebugEvent): Promise<void> {
    const childCapabilityId = resolveAiDebugChildCapabilityId(input.taskType);
    const step = resolveAiDebugStep(input.taskType);
    const artifactRefs: ForensicsArtifactRef[] = [];
    if (input.promptDebugRef) {
      artifactRefs.push({
        artifactType: "json",
        artifactId: input.promptDebugRef,
        storageRef: null,
        sourceRecordRef: null,
      });
    }
    if (input.rawResponseRef) {
      artifactRefs.push({
        artifactType: "json",
        artifactId: input.rawResponseRef,
        storageRef: null,
        sourceRecordRef: null,
      });
    }
    if (input.aiInputArtifactRef) {
      artifactRefs.push({
        artifactType: "other",
        artifactId: input.aiInputArtifactRef,
        storageRef: null,
        sourceRecordRef: null,
      });
    }

    await this.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
      abilityGroupId: "forensics-persistence",
      childCapabilityId: "write-structured-runtime-event",
      recordType: "structured_runtime_event",
      requestedBy: "ai",
      sourceAbilityGroupId: "ai",
      sourceChildCapabilityId: childCapabilityId,
      sessionId: input.sessionId,
      roundId: input.roundId ?? input.attemptId,
      videoVisitId: input.videoVisitId,
      sourceRecordRefs: [],
      parentRefs: [],
      artifactRefs,
      persistencePolicy: { mode: "append", allowPartialRefs: true },
      dataQualityFlags: [...input.parserErrors, ...(input.errorKind ? [input.errorKind] : [])],
      payload: {
        structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
          eventId: createId("event"),
          eventType: input.eventType,
          level: input.level,
          phase: "ai-runtime",
          component: "local-ai-runtime",
          owner: "AI Capability",
          abilityGroupId: "ai",
          childCapabilityId,
          skillId: null,
          skillCategory: null,
          sessionId: input.sessionId,
          missionId: input.missionId,
          roundId: input.roundId,
          videoVisitId: input.videoVisitId,
          mapId: null,
          stepId: input.roundId,
          taskTemplateId: null,
          traceId: input.traceId,
          spanId: input.spanId,
          attemptId: input.attemptId,
          browserProfileRef: this.browserSessionConfig.profileRef,
          loginState: this.browserController.getSessionState().loginState,
          step,
          previousStep: null,
          nextStep: null,
          status: input.status,
          reason: input.eventType === "AI_REQUEST_DEBUG"
            ? `AI request prepared for ${input.taskType}.`
            : input.eventType === "AI_RESPONSE_DEBUG"
              ? `AI response captured for ${input.taskType}.`
              : input.failureReason,
          failureReason: input.failureReason,
          reviewRequiredReason: input.status === "review_required" ? input.failureReason : null,
          actionableMessage: input.actionableMessage,
          ownerResponsible: input.ownerResponsible,
          decision: input.parsedDecision,
          roundOutcome: null,
          finalizationType: null,
          samplingStrategy: null,
          expectedFrameCount: null,
          validFrameCount: null,
          fallbackReason: null,
          missingFrames: [],
          snapshotSummary: null,
          provider: input.provider,
          model: input.model,
          modelRole: input.modelRole,
          runtime: input.runtime,
          promptContractId: input.promptContractId,
          promptVersion: input.promptVersion,
          outputSchemaRef: input.outputSchemaRef,
          promptDebugRef: input.promptDebugRef,
          systemPromptHash: input.systemPromptHash,
          userPromptHash: input.userPromptHash,
          promptPreview: input.promptPreview,
          promptFullText: input.promptFullText,
          rawResponsePreview: input.rawResponsePreview,
          rawResponseText: input.rawResponseText,
          rawResponseHash: input.rawResponseHash,
          rawResponseRef: input.rawResponseRef,
          parsedJson: input.parsedJson,
          parsedDecision: input.parsedDecision,
          parserErrors: input.parserErrors,
          sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
          aiInputArtifactRef: input.aiInputArtifactRef,
          imageInputs: input.imageInputs,
          tokenEstimate: input.tokenEstimate,
          exitCode: null,
          signal: null,
          pid: null,
          startedAt: null,
          endedAt: null,
          lastRuntimeEventId: null,
          lastCommandEventId: null,
          lastAiEventId: null,
          likelyCauseRef: null,
          crashBundleRef: null,
          createdAt: new Date().toISOString(),
          durationMs: input.durationMs,
          refs: input.refs,
          inputRefs: [],
          outputRefs: [],
          evidenceRefs: [],
          proofRefs: [],
          artifactRefs,
          actionLogRefs: [],
          dataQualityFlags: [...input.parserErrors, ...(input.errorKind ? [input.errorKind] : [])],
        }),
      },
    });
  }

  async getCommanderConsoleSnapshot(): Promise<CommanderMissionDashboardView> {
    const result = await this.commanderConsole.execute({
      childCapabilityId: "show-mission-dashboard",
      operatorRef: "commander-console:shell",
      input: {},
    });
    if (result.status !== "success" || result.output === null) {
      throw new Error(result.failureReason ?? result.reviewRequiredReason ?? "Failed to read commander dashboard.");
    }

    return result.output as CommanderMissionDashboardView;
  }

  private buildTransportEnvelopeBase<TChannelId extends "commander-to-orchestration" | "orchestration-to-commander" | "orchestration-to-ai" | "ai-to-orchestration">(input: {
    channelId: TChannelId;
    envelopeId: string;
    missionId: string;
    mapId: string;
    stepId: string;
    inputRef: string;
    payloadRefs: Record<string, string | null>;
    summary: string;
    tags: string[];
  }) {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const refs = Object.values(input.payloadRefs).filter((value): value is string => typeof value === "string" && value.length > 0);
    return {
      abilityGroupId: "nerve-bus" as const,
      channelId: input.channelId,
      envelopeId: input.envelopeId,
      transportId: `${input.envelopeId}:transport`,
      traceId: `${input.missionId}:${input.mapId}`,
      spanId: `${input.stepId}:${input.channelId}`,
      attemptId: `${input.envelopeId}:attempt:1`,
      missionId: input.missionId,
      mapId: input.mapId,
      stepId: input.stepId,
      idempotencyKey: `${input.envelopeId}:idempotent`,
      sequenceNo: 0,
      inputRef: input.inputRef,
      payloadRef: refs.length > 0 ? refs : [`${input.envelopeId}:payload`],
      payload: {
        summary: input.summary,
        entityRefs: refs,
        evidenceRefs: refs,
        tags: input.tags,
        attributes: [],
      },
      createdAt,
      expiresAt,
    };
  }

  private buildPayloadDocument(input: {
    documentType: string;
    documentRef: string;
    summary: string;
    content: Record<string, string | number | boolean | null | undefined>;
  }): NerveBusPayloadDocument {
    const contentBlocks = Object.entries(input.content)
      .filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined)
      .map(([key, value]) => ({ key, value }));
    return {
      documentType: input.documentType,
      documentRef: input.documentRef,
      summary: input.summary,
      entityRefs: [],
      evidenceRefs: [],
      contentBlocks,
    };
  }

  private payloadDocumentToObject(payload: NerveBusPayloadDocument): Record<string, string | number | boolean | null> {
    return Object.fromEntries(payload.contentBlocks.map((block) => [block.key, block.value]));
  }

  private payloadValueToString(value: string | number | boolean | null | undefined): string | null {
    return typeof value === "string" ? value : null;
  }

  private payloadValueToInteger(value: string | number | boolean | null | undefined): number | null {
    return typeof value === "number" && Number.isInteger(value) ? value : null;
  }

  private async dispatchAbilityCommandEnvelope(envelope: AbilityCommandEnvelope, inputPayload: NerveBusPayloadDocument): Promise<NerveBusHandledResult<AbilityResultEnvelope>> {
    const abilityDispatchers: Record<AbilityCommandEnvelope["to"], AbilityDispatchHandler> = {
      open: async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.openAbilityGroup.execute(this.buildOpenAbilityInput(commandEnvelope, commandPayload)),
      screenshot: async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.screenshotAbilityGroup.execute({
        abilityGroupId: "screenshot",
        childCapabilityId: commandEnvelope.commandName === "prepare-ai-input" ? "prepare-ai-input" : "capture-browser-viewport",
        sessionId: commandEnvelope.missionId,
        roundId: commandEnvelope.stepId,
        videoVisitId: null,
        missionId: commandEnvelope.missionId,
        runId: commandEnvelope.mapId,
        requestedBy: "orchestration",
        purpose: commandPayload.summary,
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: commandEnvelope.commandName,
        idempotencyKey: commandEnvelope.idempotencyKey,
      }),
      "visual-target": async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.visualTargetAbilityGroup.execute({
        abilityGroupId: "visual-target",
        childCapabilityId: commandEnvelope.commandName === "detect-comments-button" ? "detect-comments-button" : "detect-next-video-region",
        sessionId: commandEnvelope.missionId,
        roundId: commandEnvelope.stepId,
        videoVisitId: null,
        requestedBy: "orchestration",
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: commandEnvelope.commandName,
        inputRef: commandEnvelope.inputRef,
        targetType: commandEnvelope.commandName === "detect-comments-button" ? "comments_button" : "next_video_region",
        targetNature: "action",
        sourceProof: {
          screenshot: { decision: "review_required", screenshotEvidenceRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).screenshotEvidenceRef), screenshotProofRef: commandEnvelope.inputRef, coordinateSpace: "browser_viewport", imageSize: null, scaleMapping: null, reason: "Dispatch proof carried by Nerve Bus payload refs." },
          ai: { decision: "not_required", aiResultRef: null, aiProofRef: null, confidence: null, reason: null },
          pageState: { decision: "review_required", pageStateRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).pageStateRef), pageStateProofRef: null, pageStateType: null, reason: "Page state is referenced by transport payload when available." },
        },
        candidates: [],
      }),
      "geometry-guard": async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.geometryGuardAbilityGroup.execute({
        abilityGroupId: "geometry-guard",
        childCapabilityId: commandEnvelope.commandName === "normalize-coordinate-geometry" ? "validate-click-point" : "validate-coordinate-space",
        sessionId: commandEnvelope.missionId,
        roundId: commandEnvelope.stepId,
        videoVisitId: null,
        requestedBy: "orchestration",
        purpose: commandPayload.summary,
        sourceAbilityGroupId: "visual-target",
        sourceChildCapabilityId: commandEnvelope.commandName,
        inputRef: commandEnvelope.inputRef,
        sourceScreenshotEvidenceRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).screenshotEvidenceRef),
        sourceTargetRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).visualTargetRef),
        sourceAiResultRef: null,
        sourceCoordinateSpace: "browserViewport",
        requestedExecutionSpace: "browserViewport",
        bbox: { x: 0, y: 0, width: 1, height: 1 },
        clickPoint: { x: 0, y: 0 },
        viewportSize: { width: 1, height: 1 },
      }),
      "mouse-click": async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.mouseClickAbilityGroup.execute({
        abilityGroupId: "mouse-click",
        childCapabilityId: "click-browser-coordinate",
        sessionId: commandEnvelope.missionId,
        roundId: commandEnvelope.stepId,
        videoVisitId: null,
        requestedBy: "orchestration",
        purpose: commandPayload.summary,
        sourceCoordinateProofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).geometryProofRef) ?? commandEnvelope.inputRef,
        sourceEvidenceRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).sourceEvidenceRef),
        sourceTargetRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).visualTargetRef) ?? commandEnvelope.inputRef,
        geometryGuardProof: { proofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).geometryProofRef) ?? commandEnvelope.inputRef, normalizedCoordinateSpace: "browserViewport", clickPoint: { x: 0, y: 0 }, safetyMarginPx: 4 },
        bounds: { width: 1, height: 1 },
      }),
      "text-input": async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.textInputAbilityGroup.execute({
        abilityGroupId: "text-input",
        childCapabilityId: "type-text",
        sessionId: commandEnvelope.missionId,
        roundId: commandEnvelope.stepId,
        videoVisitId: null,
        requestedBy: "orchestration",
        purpose: commandPayload.summary,
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: commandEnvelope.commandName,
        sourceOwner: "map-plugin",
        sourceProofRef: commandEnvelope.inputRef,
        targetRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).sourceTargetRef) ?? commandEnvelope.inputRef,
        targetProofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).geometryProofRef) ?? commandEnvelope.inputRef,
        targetProofOwner: "geometry-guard",
        targetKind: "commentComposer",
        focusProofRef: commandEnvelope.inputRef,
        focusProofOwner: "post-action-verification",
        focusVerifiedAt: envelope.createdAt,
        geometryGuardProofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).geometryProofRef),
        mouseClickProofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).abilityResultRef),
        postActionFocusVerificationRef: commandEnvelope.inputRef,
        operatorApprovalRef: null,
        humanApprovalRef: null,
        mapPolicyApprovalRef: commandEnvelope.mapId,
        inputText: "governed text input",
        inputTextRef: `${commandEnvelope.inputRef}:input-text`,
        inputTextHash: "sha256:governed-text-input",
        approvedText: "governed text input",
        approvedTextRef: `${commandEnvelope.inputRef}:approved-text`,
        approvedTextHash: "sha256:governed-text-input",
        approvedCommitRef: null,
      }),
      "mouse-scroll": async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.mouseScrollAbilityGroup.execute({
        abilityGroupId: "mouse-scroll",
        childCapabilityId: "scroll-browser-viewport",
        sessionId: commandEnvelope.missionId,
        roundId: commandEnvelope.stepId,
        videoVisitId: null,
        requestedBy: "orchestration",
        purpose: commandPayload.summary,
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: commandEnvelope.commandName,
        sourceCoordinateProofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).geometryProofRef) ?? commandEnvelope.inputRef,
        sourceEvidenceRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).sourceEvidenceRef),
        sourceTargetRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).sourceTargetRef) ?? commandEnvelope.inputRef,
        geometryScrollProof: { proofRef: this.payloadValueToString(this.payloadDocumentToObject(commandPayload).geometryProofRef) ?? commandEnvelope.inputRef, normalizedCoordinateSpace: "browserViewport", normalizedAnchor: { x: 0, y: 0 }, normalizedBounds: { width: 1, height: 1 }, normalizedRegion: null },
        coordinateSpace: "browserViewport",
        bounds: { width: 1, height: 1 },
        direction: "down",
        magnitude: "medium",
      }),
      "post-action-verification": async ({ envelope: commandEnvelope, inputPayload: commandPayload }) => this.postActionVerificationAbilityGroup.execute(this.buildPostActionVerificationInput(commandEnvelope, commandPayload)),
      "forensics-persistence": async ({ envelope: commandEnvelope }) => this.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent(this.buildForensicsRuntimeEventInput(commandEnvelope)),
      "page-state": async ({ envelope: commandEnvelope }) => this.pageStateAbilityGroup.execute(this.buildPageStateDispatchInput(commandEnvelope)),
    };

    try {
      const result = await abilityDispatchers[envelope.to]({ envelope, inputPayload });
      return this.buildAbilityCommandResultEnvelope({ envelope, result });
    } catch (error) {
      return this.buildAbilityCommandResultEnvelope({
        envelope,
        result: {
          abilityGroupId: envelope.to,
          childCapabilityId: envelope.commandName,
          status: "failed",
          failureReason: error instanceof Error ? error.message : "Ability dispatch failed.",
          reviewRequiredReason: null,
        },
      });
    }
  }

  private buildHumanCommandDispatchInput(command: CommanderHumanCommandEnvelope) {
    const commandId = createId("commander_command");
    const inputPayload = this.buildPayloadDocument({
      documentType: "human.command",
      documentRef: `commander-console:${commandId}:input`,
      summary: `Commander command ${command.commandType}`,
      content: {
        commandType: command.commandType,
        targetMissionId: command.targetMissionId ?? null,
        selectedMapId: command.selectedMapId ?? null,
        requestedPlatformId: command.requestedPlatformId ?? null,
        humanGoal: command.humanGoal ?? null,
        maxRounds: command.maxRounds ?? null,
        maxMinutes: command.maxMinutes ?? null,
        operatorNote: command.operatorNote ?? null,
        targetRecordId: command.targetRecordRef?.recordId ?? null,
      },
    });
    return {
      envelope: {
      ...this.buildTransportEnvelopeBase({
        channelId: "commander-to-orchestration",
        envelopeId: `commander-console:${commandId}`,
        missionId: command.targetMissionId ?? "human-command",
        mapId: command.selectedMapId ?? "human-command",
        stepId: command.commandType,
        inputRef: inputPayload.documentRef,
        payloadRefs: { input: inputPayload.documentRef },
        summary: inputPayload.summary,
        tags: ["commander-console", command.commandType],
      }),
      commandId,
      envelopeKind: "human_command" as const,
      from: "commander-console" as const,
      to: "orchestration" as const,
      commandType: command.commandType,
      },
      inputPayload,
    } satisfies HumanCommandDispatchInput;
  }

  private describeHumanCommandTransportMessage(resultEnvelope: HumanCommandResultEnvelope): string {
    if (resultEnvelope.status === "failed") {
      return resultEnvelope.failureReason ?? "command transport failed";
    }

    if (resultEnvelope.status === "review_required") {
      return resultEnvelope.failureReason ?? "command transport requires review";
    }

    return resultEnvelope.reviewRequiredReason ?? "command accepted";
  }

  private buildHumanCommandResultEnvelope(input: {
    envelope: HumanCommandEnvelope;
    status: "success" | "failed" | "review_required";
    summary: string;
    failureReason?: string | null;
  }): NerveBusHandledResult<HumanCommandResultEnvelope> {
    const outputPayload = this.buildPayloadDocument({
      documentType: "human.command.result",
      documentRef: `${input.envelope.commandId}:result`,
      summary: input.summary,
      content: {
        commandType: input.envelope.commandType,
        missionId: input.envelope.missionId,
        failureReason: input.failureReason ?? null,
        status: input.status,
      },
    });
    return {
      envelope: {
      ...this.buildTransportEnvelopeBase({
        channelId: "orchestration-to-commander",
        envelopeId: `${input.envelope.envelopeId}:result`,
        missionId: input.envelope.missionId,
        mapId: input.envelope.mapId,
        stepId: input.envelope.stepId,
        inputRef: input.envelope.inputRef,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["commander-console", input.status],
      }),
      resultId: `${input.envelope.commandId}:result`,
      envelopeKind: "human_command_result" as const,
      from: "orchestration",
      to: "commander-console",
      status: input.status,
      outputRef: outputPayload.documentRef,
      diagnosticPayloadRef: null,
      failureReason: input.failureReason ?? null,
      reviewRequiredReason: input.status === "review_required" ? input.failureReason ?? "review required" : null,
      },
      outputPayload,
    };
  }

  private async handleHumanCommandEnvelope(envelope: HumanCommandEnvelope, inputPayload: NerveBusPayloadDocument): Promise<NerveBusHandledResult<HumanCommandResultEnvelope>> {
    try {
      const payload = this.payloadDocumentToObject(inputPayload);
      if (envelope.commandType === "start-mission") {
          const requestedPlatformId = this.payloadValueToString(payload.requestedPlatformId) as RequestedPlatformId | null;
          const humanGoal = this.payloadValueToString(payload.humanGoal);
          const taskTemplateId = this.payloadValueToString(payload.taskTemplateId);
          const activationId = this.payloadValueToString(payload.activationId);
          const parsedSelectedMapId = typeof payload.selectedMapId === "string"
            ? OperationalMapIdSchema.safeParse(payload.selectedMapId)
            : null;
          const selectedMapId = parsedSelectedMapId?.success ? parsedSelectedMapId.data : null;
          const maxRounds = this.payloadValueToInteger(payload.maxRounds);
          const maxMinutes = this.payloadValueToInteger(payload.maxMinutes);
          const operatorNote = this.payloadValueToString(payload.operatorNote);
          if (!requestedPlatformId) {
            return this.buildHumanCommandResultEnvelope({
              envelope,
              status: "failed",
              summary: "requestedPlatformId is required for start-mission.",
              failureReason: "requestedPlatformId is required for start-mission.",
            });
          }
          const missionState = await this.orchestrationAbilityGroup.startMission({
            missionId: envelope.missionId,
            humanGoal: humanGoal ?? "Discover evidence-backed product opportunities from the active social feed.",
            requestedPlatform: requestedPlatformId,
            preferredMapId: selectedMapId,
            taskTemplateId,
            activationId,
            maxRounds,
            maxMinutes,
            initialPayload: {
              requestedBy: "commander-console",
              selectedMapId,
              maxRounds,
              maxMinutes,
              operatorNote,
              targetUrl: null,
              targetTitle: null,
              sourceEvidenceRef: null,
              sourceTargetRef: null,
              promptInputRef: null,
              commandInputRef: null,
            },
          });
          return this.buildHumanCommandResultEnvelope({
            envelope,
            status: missionState.status === "review_required" ? "review_required" : "success",
            summary: `Mission ${missionState.missionId ?? envelope.missionId} is now ${missionState.status}.`,
          });
        }

        const currentMission = await this.orchestrationAbilityGroup.getMissionState();
        const missionId = envelope.missionId !== "human-command" ? envelope.missionId : currentMission.missionId;
        if (!missionId) {
          return this.buildHumanCommandResultEnvelope({
            envelope,
            status: "failed",
            summary: "No active mission is available.",
            failureReason: "No active mission is available.",
          });
        }

        const operatorNote = this.payloadValueToString(payload.operatorNote);
        if (envelope.commandType === "pause-mission") {
          const missionState = await this.orchestrationAbilityGroup.pauseMission(missionId);
          return this.buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
        }
        if (envelope.commandType === "resume-mission") {
          const missionState = await this.orchestrationAbilityGroup.resumeMission(missionId);
          return this.buildHumanCommandResultEnvelope({ envelope, status: missionState.status === "review_required" ? "review_required" : "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
        }
        if (envelope.commandType === "stop-mission") {
          const missionState = await this.orchestrationAbilityGroup.stopMission({ missionId, reason: operatorNote ?? "stop requested by commander console" });
          return this.buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
        }

        const missionState = await this.orchestrationAbilityGroup.emergencyStop({ missionId, reason: operatorNote ?? "emergency stop requested by commander console" });
        return this.buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Mission ${missionId} is now ${missionState.status}.` });

      const candidateId = this.payloadValueToString(payload.targetRecordId);
      if (candidateId === null) {
        return this.buildHumanCommandResultEnvelope({
          envelope,
          status: "failed",
          summary: "Candidate review commands require a target candidate id.",
          failureReason: "Candidate review commands require a target candidate id.",
        });
      }
      const governedCandidateId = candidateId!;
      const disposition = envelope.commandType === "approve-candidate"
        ? "approve"
        : envelope.commandType === "reject-candidate"
          ? "reject"
          : "hold";
      const candidateOperatorNote = this.payloadValueToString(payload.operatorNote) ?? undefined;
      const candidate = await this.evidenceStore.setCandidateDisposition(governedCandidateId, disposition, candidateOperatorNote);
      return this.buildHumanCommandResultEnvelope({
        envelope,
        status: "success",
        summary: `Candidate ${candidate.id} is now ${candidate.reviewStatus}.`,
      });
    } catch (error) {
      return this.buildHumanCommandResultEnvelope({
        envelope,
        status: "failed",
        summary: "Unknown human command transport failure",
        failureReason: error instanceof Error ? error.message : "Unknown human command transport failure",
      });
    }
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    await this.evidenceStore.deleteCandidate(candidateId);
  }

  async exportCandidateSummaries() {
    return this.evidenceStore.exportCandidateSummaries();
  }

  private async readMissionRuntimeSnapshot(afterCommand?: () => Promise<void>) {
    if (afterCommand) {
      await afterCommand();
    }

    const mission = await this.orchestrationAbilityGroup.getMissionState();
    return {
      task: mission.activeTaskRunId
        ? {
            taskRunId: mission.activeTaskRunId,
            status: mission.status,
            currentRoundIndex: mission.currentRoundIndex,
          }
        : null,
      reviewRequiredReason: mission.reviewRequiredReason,
      failureReason: mission.failureReason,
    };
  }

  private async readAuditSummary(): Promise<CommanderAuditSummary> {
    try {
      const [runnerSummaryText, phaseGateText] = await Promise.all([
        readFile(path.join(process.cwd(), "scripts", "audit", "generated", "runner-summary.json"), "utf8"),
        readFile(path.join(process.cwd(), "scripts", "audit", "phase-gates", "phase-02-local-workbench.json"), "utf8"),
      ]);
      const runnerSummary = JSON.parse(runnerSummaryText) as {
        generatedAt?: string;
        totals?: CommanderAuditSummary["totals"];
      };
      const phaseGate = JSON.parse(phaseGateText) as {
        phase: string;
        activeCapabilityDomains: string[];
      };
      return {
        phase: phaseGate.phase,
        activeCapabilityDomains: phaseGate.activeCapabilityDomains,
        lastGeneratedAt: phaseGate.phase ? runnerSummary.generatedAt ?? null : null,
        lastRunGeneratedAt: runnerSummary.generatedAt ?? null,
        totals: runnerSummary.totals ?? null,
      };
    } catch {
      return {
        phase: "phase-02-local-workbench",
        activeCapabilityDomains: [],
        lastGeneratedAt: null,
        lastRunGeneratedAt: null,
        totals: null,
      };
    }
  }

  getModeInfo(): {
    dataMode: "Real Platform";
    platformId: string;
    platformLabel: string;
    realPlatformConnection: string;
    browserMode: string;
    browserExecutable: string | null;
    browserProfileRef: string;
    browserProfileStatus: string;
    browserProfileDirectory: string;
    browserProfileProvisioning: string;
    browserProfileVerificationStatus: string;
    browserProfileVerificationReason: string | null;
    loginState: string;
    lastLoginCheckAt: string | null;
    loginRequiredReason: string | null;
    reviewRequiredReason: string | null;
    storeScope: string;
    executionMode: string;
    fallbackMode: string;
    geometryGuard: string;
    viewport: string;
    calibration: string;
    orientation: string;
  } {
    const session = this.browserController.getSessionState();
    const platformMode = PLATFORM_MODE_INFO[this.options.platformTarget];
    return {
      dataMode: "Real Platform",
      platformId: this.options.platformTarget,
      platformLabel: platformMode.platformLabel,
      realPlatformConnection: this.browserController.getHealth().detail,
      browserMode: session.browserMode,
      browserExecutable: session.browserExecutable,
      browserProfileRef: session.browserProfileRef,
      browserProfileStatus: session.profileStatus,
      browserProfileDirectory: session.profileDirectory,
      browserProfileProvisioning: session.profileProvisioning,
      browserProfileVerificationStatus: session.profileVerificationStatus,
      browserProfileVerificationReason: session.profileVerificationReason,
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
  }
}
