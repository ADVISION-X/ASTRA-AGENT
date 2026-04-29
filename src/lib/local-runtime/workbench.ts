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
import { createOrchestrationAbilityGroup, OperationalMapIdSchema, type OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";
import type { OpenAbilityGroup } from "../../capabilities/open/contract.js";
import { createOpenAbilityGroup } from "../../capabilities/open/index.js";
import { AI_ABILITY_GROUP_ID, createAiAbilityGroup, type AiAbilityGroup } from "../../capabilities/ai/index.js";
import {
  createForensicsPersistenceAbilityGroup,
  type ForensicsPersistenceAbilityGroup,
} from "../../capabilities/forensics-persistence/index.js";
import { createMouseClickAbilityGroup, type MouseClickAbilityGroup } from "../../capabilities/mouse-click/index.js";
import { createMouseScrollAbilityGroup, type MouseScrollAbilityGroup } from "../../capabilities/mouse-scroll/index.js";
import { createPageStateAbilityGroup, type PageStateAbilityGroup } from "../../capabilities/page-state/index.js";
import { createPostActionVerificationAbilityGroup, type PostActionVerificationAbilityGroup } from "../../capabilities/post-action-verification/index.js";
import { createScreenshotAbilityGroup, type ScreenshotAbilityGroup } from "../../capabilities/screenshot/index.js";
import { createFilesystemScreenshotArtifactPort } from "../../capabilities/screenshot/ports/screenshot-artifact-port.js";
import { createBrowserControllerScreenshotCapturePort } from "../../capabilities/screenshot/ports/screenshot-capture-port.js";
import { createSharpScreenshotImageProcessingPort } from "../../capabilities/screenshot/ports/screenshot-image-processing-port.js";
import { createSystemScreenshotClockPort } from "../../capabilities/screenshot/ports/screenshot-clock-port.js";
import { createVisualTargetAbilityGroup, type VisualTargetAbilityGroup } from "../../capabilities/visual-target/index.js";
import {
  type AiResponseEnvelope,
  createNerveBusAbilityGroup,
  type HumanCommandDispatchInput,
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
import { TikTokPlatformAdapter } from "./tiktok-platform/runtime.js";
import type { PlatformAdapter } from "./platform-runtime-contract.js";
import type { BrowserController } from "../browser/browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";
import { getDefaultLocalDataDir } from "./default-data-dir.js";
import { createId } from "./ids.js";
import type { RuntimeHealthReport } from "../../types/runtime.js";
import { VisionProductPresenceRequestInputSchema } from "../../types/vision-product-presence.js";
import {
  createStructuredTerminalLogListener,
  isStructuredLogStdoutEnabled,
  resolveStructuredLogLevel,
  StructuredLogBus,
} from "./structured-log-bus.js";
export type GrassEyePlatformTarget = "tiktok-web";

type GrassEyeWorkbenchOptions = {
  dataDir?: string;
  baseUrl: string;
  platformTarget: GrassEyePlatformTarget;
  realPlatformUrl?: string;
  browserHeadless?: boolean;
  browserProfileDirectory?: string;
};

type CommanderBrowserSessionSnapshot = ReturnType<BrowserController["getSessionState"]>;

const CAPABILITY_ROSTER = [
  { abilityGroupId: "commander-console", displayName: "Commander Console", currentStrength: "governed", purpose: "Mission command and read-only operator console" },
  { abilityGroupId: "orchestration", displayName: "Orchestration", currentStrength: "governed", purpose: "Mission command, map execution, and controlled transitions" },
  { abilityGroupId: "nerve-bus", displayName: "Nerve Bus", currentStrength: "governed", purpose: "Governed transport between orchestration, abilities, AI, and commander" },
  { abilityGroupId: "ai", displayName: "AI", currentStrength: "specialized", purpose: "Local model execution under governed contracts" },
  { abilityGroupId: "open", displayName: "Open", currentStrength: "governed", purpose: "Governed target-page opening and session-safe navigation" },
  { abilityGroupId: "screenshot", displayName: "Screenshot", currentStrength: "governed", purpose: "Governed capture and image preparation" },
  { abilityGroupId: "visual-target", displayName: "Visual Target", currentStrength: "governed", purpose: "Visual target detection and coordinate truth" },
  { abilityGroupId: "mouse-click", displayName: "Mouse Click", currentStrength: "governed", purpose: "Governed click execution" },
  { abilityGroupId: "mouse-scroll", displayName: "Mouse Scroll", currentStrength: "governed", purpose: "Governed scroll execution" },
  { abilityGroupId: "post-action-verification", displayName: "Post-action Verification", currentStrength: "governed", purpose: "Action-result verification after platform operations" },
  { abilityGroupId: "forensics-persistence", displayName: "Forensics Persistence", currentStrength: "governed", purpose: "Evidence, ledger, and runtime proof persistence" },
  { abilityGroupId: "page-state", displayName: "Page State", currentStrength: "governed", purpose: "Page readiness and safety-state truth" },
] as const;

export class GrassEyeWorkbench {
  readonly structuredLogBus: StructuredLogBus;
  readonly evidenceStore: EvidenceStoreService;
  readonly browserController: BrowserController;
  readonly aiAbilityGroup: AiAbilityGroup;
  readonly forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  readonly platformAdapter: PlatformAdapter;
  readonly openAbilityGroup: OpenAbilityGroup;
  readonly mouseClickAbilityGroup: MouseClickAbilityGroup;
  readonly mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  readonly pageStateAbilityGroup: PageStateAbilityGroup;
  readonly postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup;
  readonly screenshotAbilityGroup: ScreenshotAbilityGroup;
  readonly visualTargetAbilityGroup: VisualTargetAbilityGroup;
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
            dispatchAbilityCommand: async () => null,
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
              const health = await this.getHealthReport();
              return health.components.map((component) => ({
                id: component.name,
                label: component.name,
                tone: component.ok ? "good" : "danger",
                detail: component.detail,
              }));
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
    this.aiAbilityGroup = createAiAbilityGroup();
    this.forensicsPersistenceAbilityGroup = createForensicsPersistenceAbilityGroup({
      recordStorage: createEvidenceStoreForensicsRecordStoragePort(this.evidenceStore),
      artifactStorage: createEvidenceStoreForensicsArtifactStoragePort(),
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
      primitivePort: createBrowserControllerMouseClickPrimitivePort({
        browserController: this.browserController,
      }),
    });
    this.mouseScrollAbilityGroup = createMouseScrollAbilityGroup({
      primitivePort: createBrowserControllerMouseScrollPrimitivePort({
        browserController: this.browserController,
      }),
    });
    this.pageStateAbilityGroup = createPageStateAbilityGroup();
    this.postActionVerificationAbilityGroup = createPostActionVerificationAbilityGroup();
    this.visualTargetAbilityGroup = createVisualTargetAbilityGroup();
    this.openAbilityGroup = createOpenAbilityGroup({
      browser: {
        getSessionSnapshot: async () => this.browserController.getSessionState(),
        open: async (openInput) => this.browserController.open({
          url: openInput.url,
          title: openInput.title ?? "",
        }),
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
    this.platformAdapter = new TikTokPlatformAdapter(
      this.browserController,
      this.screenshotAbilityGroup,
      this.visualTargetAbilityGroup,
      this.mouseClickAbilityGroup,
      this.mouseScrollAbilityGroup,
      this.pageStateAbilityGroup,
      this.postActionVerificationAbilityGroup,
      options.realPlatformUrl ?? "https://www.tiktok.com/foryou"
    );
  }

  async init(): Promise<void> {
    await this.evidenceStore.init();
  }

  async getHealthReport(): Promise<RuntimeHealthReport> {
    const dataStoreHealth = await this.evidenceStore.getHealth();
    const mission = await this.orchestrationAbilityGroup.getMissionState();
    const localAiHealth = await this.aiAbilityGroup.getHealth();
    const localAiRuntimeHealth = await this.aiAbilityGroup.getRuntimeHealth();
    return {
      generatedAt: new Date().toISOString(),
      components: [
        { name: "console", ok: true, detail: "Commander Console route ready" },
        { name: "agent", ok: true, detail: `mission_status=${mission.status}; map=${mission.mapId ?? "none"}; round=${mission.currentRoundIndex}` },
        { name: "browserController", ok: true, detail: this.browserController.getHealth().detail },
        { name: "localAi", ok: localAiHealth.ok, detail: `${localAiHealth.detail}; lastTask=${localAiRuntimeHealth.lastTaskType ?? "none"}; lastStatus=${localAiRuntimeHealth.lastInvocationStatus ?? "none"}; lastFailure=${localAiRuntimeHealth.lastFailureReason ?? "none"}` },
        { name: "dataStore", ok: dataStoreHealth.ok, detail: dataStoreHealth.detail }
      ]
    };
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
          const requestedPlatformId = this.payloadValueToString(payload.requestedPlatformId) as GrassEyePlatformTarget | null;
          const humanGoal = this.payloadValueToString(payload.humanGoal);
          const parsedSelectedMapId = typeof payload.selectedMapId === "string"
            ? OperationalMapIdSchema.safeParse(payload.selectedMapId)
            : null;
          const selectedMapId = parsedSelectedMapId?.success ? parsedSelectedMapId.data : null;
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
            initialPayload: {
              requestedBy: "commander-console",
              selectedMapId,
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
    const operatorMode = this.platformAdapter.getOperatorModeInfo();
    const session = this.browserController.getSessionState();
    return {
      dataMode: "Real Platform",
      platformId: this.platformAdapter.platformId,
      platformLabel: "TikTok web adapter",
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
      executionMode: operatorMode.executionMode,
      fallbackMode: operatorMode.fallbackMode,
      geometryGuard: operatorMode.geometryGuard,
      viewport: operatorMode.viewport,
      calibration: operatorMode.calibration,
      orientation: operatorMode.orientation,
    };
  }
}
