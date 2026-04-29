import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  createCommanderConsoleAbilityGroup,
} from "../../capabilities/commander-console/index.js";
import type {
  CommanderAuditSummary,
  CommanderConsoleAbilityGroup,
  CommanderHumanCommandInput,
  CommanderMissionDashboardView,
} from "../../capabilities/commander-console/index.js";
import { createAbilityRoster, createOrchestrationAbilityGroup, MissionRuntimeExecutor, type OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";
import type { OpenDrawer } from "../../capabilities/open/contract.js";
import { createOpenDrawer } from "../../capabilities/open/index.js";
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
import { createVisualTargetAbilityGroup, type VisualTargetAbilityGroup } from "../../capabilities/visual-target/index.js";
import { createNerveBusAbilityGroup, type NerveBusAbilityGroup } from "../../capabilities/nerve-bus/index.js";
import {
  createEvidenceStoreForensicsArtifactStoragePort,
  createEvidenceStoreForensicsRecordStoragePort,
} from "../storage/evidence-store/forensics-storage-adapter.js";
import { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";
import type { HumanCommandEnvelope, HumanCommandResultEnvelope, HumanCommandTargetId } from "../../capabilities/nerve-bus/index.js";
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

export class GrassEyeWorkbench {
  readonly structuredLogBus: StructuredLogBus;
  readonly evidenceStore: EvidenceStoreService;
  readonly browserController: BrowserController;
  readonly aiAbilityGroup: AiAbilityGroup;
  readonly forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  readonly platformAdapter: PlatformAdapter;
  readonly openDrawer: OpenDrawer;
  readonly mouseClickAbilityGroup: MouseClickAbilityGroup;
  readonly mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  readonly pageStateAbilityGroup: PageStateAbilityGroup;
  readonly postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup;
  readonly screenshotAbilityGroup: ScreenshotAbilityGroup;
  readonly visualTargetAbilityGroup: VisualTargetAbilityGroup;
  readonly missionRuntimeExecutor: MissionRuntimeExecutor;
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
          abilityHandlers: {},
          humanCommandHandler: async (envelope) => this.handleHumanCommandEnvelope(envelope),
          aiHandler: async (envelope) => {
            const taskType = "product_presence_judgment" as const;
            const input = VisionProductPresenceRequestInputSchema.parse(envelope.payload);
            const aiResult = await this.aiAbilityGroup.execute({
              abilityGroupId: AI_ABILITY_GROUP_ID,
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
            const status = aiResult.status === "failed" ? "failed" : "success";

            return {
              envelopeId: `${envelope.envelopeId}:response`,
              responseId: `${envelope.requestId}:response`,
              missionId: envelope.missionId,
              mapId: envelope.mapId,
              stepId: envelope.stepId,
              from: "local-ai-decision",
              to: "orchestration",
              status,
              decision: aiResult.taskType,
              confidence: aiResult.confidence,
              payloadRef: Object.keys(envelope.payload),
              payload: { aiTaskId: aiResult.runtimeProof.outputRefs[0] ?? null },
              failureReason: status === "failed" ? aiResult.failureReason : null,
              createdAt: new Date().toISOString(),
            };
          },
        });
        this.orchestrationAbilityGroup = createOrchestrationAbilityGroup({
          nerveBus: this.nerveBusAbilityGroup,
          runtimeController: {
            startMission: async () => this.readMissionRuntimeSnapshot(async () => {
              await this.missionRuntimeExecutor.beginMissionRuntime();
            }),
            pauseMission: async () => this.readMissionRuntimeSnapshot(async () => {
              await this.missionRuntimeExecutor.pauseMissionRuntime();
            }),
            resumeMission: async () => this.readMissionRuntimeSnapshot(async () => {
              await this.missionRuntimeExecutor.resumeMissionRuntime();
            }),
            stopMission: async ({ reason }) => this.readMissionRuntimeSnapshot(async () => {
              await this.missionRuntimeExecutor.stopMissionRuntime(reason);
            }),
            emergencyStop: async ({ reason }) => this.readMissionRuntimeSnapshot(async () => {
              await this.missionRuntimeExecutor.emergencyStopMissionRuntime(reason);
            }),
            submitReviewDecision: async (reviewDecision) => this.readMissionRuntimeSnapshot(async () => {
              await this.missionRuntimeExecutor.submitRuntimeReviewDecision(reviewDecision);
            }),
            getRuntimeSnapshot: async () => this.readMissionRuntimeSnapshot(),
          },
        });
        this.commanderConsole = createCommanderConsoleAbilityGroup({
          defaultOperatorRef: "commander-console:operator",
          commandTransport: {
            emitHumanCommand: async (command) => {
              const envelope = this.buildHumanCommandEnvelope(command);
              const transport = await this.nerveBusAbilityGroup.dispatchHumanCommand(envelope);
              const status = transport.resultEnvelope.status === "success"
                ? "accepted"
                : transport.resultEnvelope.status;
              return {
                commandId: command.commandId,
                envelopeRef: envelope.envelopeId,
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
              return {
                missionId: mission.missionId,
                humanGoal: mission.humanGoal ?? "",
                status: mission.status,
                missionRunRef: mission.activeTaskRunId,
                currentRoundIndex: mission.currentRoundIndex,
                requestedPlatform: mission.requestedPlatform,
                selectedMapId: mission.mapId,
                lastHumanCommand: mission.lastHumanCommand,
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
              const agentSnapshot = await this.missionRuntimeExecutor.getSnapshot();
              const state = await this.evidenceStore.getOperatorSnapshot();
              return {
                runtimeStatus: agentSnapshot.currentTask?.status ?? "idle",
                currentStep: agentSnapshot.deliveryState.currentRoundStep,
                reviewReason: agentSnapshot.deliveryState.reviewRequiredReason,
                totalSeenCount: state.roundStructuralLogs.length,
                evidencePacketCount: state.evidencePackets.length,
                browseLedgerCount: state.browseLedgerEntries.length,
                candidateCount: state.candidates.length,
                lastAiFailureReason: agentSnapshot.deliveryState.lastAiFailureReason,
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
              const roster = createAbilityRoster();
              return this.orchestrationAbilityGroup.getAbilityRoster().flatMap((abilityGroupId) => {
                const entry = roster.get(abilityGroupId);
                return entry ? [{
                  abilityGroupId: entry.abilityGroupId,
                  displayName: entry.displayName,
                  currentStrength: entry.currentStrength,
                  purpose: entry.purpose,
                }] : [];
              });
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
      browserController: this.browserController,
      outputRootDir: path.join(dataDir, "artifacts", "screenshot"),
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
    this.openDrawer = createOpenDrawer({
      browserController: this.browserController,
      localWorkbenchUrl: this.options.baseUrl,
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

    this.missionRuntimeExecutor = new MissionRuntimeExecutor(this.platformAdapter, this.openDrawer, this.postActionVerificationAbilityGroup, this.screenshotAbilityGroup, this.evidenceStore, this.forensicsPersistenceAbilityGroup, this.aiAbilityGroup);
  }

  async init(): Promise<void> {
    await this.evidenceStore.init();
  }

  async getHealthReport(): Promise<RuntimeHealthReport> {
    const dataStoreHealth = await this.evidenceStore.getHealth();
    const agentSnapshot = await this.missionRuntimeExecutor.getSnapshot();
    const localAiHealth = await this.aiAbilityGroup.getHealth();
    const localAiRuntimeHealth = await this.aiAbilityGroup.getRuntimeHealth();
    return {
      generatedAt: new Date().toISOString(),
      components: [
        { name: "console", ok: true, detail: "Commander Console route ready" },
        { name: "agent", ok: true, detail: this.missionRuntimeExecutor.getHealth().detail },
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

  private buildHumanCommandEnvelope(command: CommanderHumanCommandInput): HumanCommandEnvelope {
    const commandId = createId("commander_command");
    const payload = command.initialPayload ?? {};
    return {
      envelopeId: `commander-console:${commandId}`,
      commandId,
      missionId: command.targetMissionId ?? "human-command",
      mapId: command.selectedMapId ?? "human-command",
      stepId: command.commandType,
      from: "commander-console",
      to: command.commandType === "approve-candidate" || command.commandType === "reject-candidate" || command.commandType === "mark-review-required"
        ? "forensics-persistence"
        : "orchestration",
      commandType: command.commandType,
      payloadRef: Object.keys(payload),
      payload,
      createdAt: new Date().toISOString(),
    };
  }

  private describeHumanCommandTransportMessage(resultEnvelope: HumanCommandResultEnvelope): string {
    if (resultEnvelope.status === "failed") {
      return resultEnvelope.failureReason ?? "command transport failed";
    }

    if (resultEnvelope.status === "review_required") {
      return resultEnvelope.failureReason ?? "command transport requires review";
    }

    const payload = resultEnvelope.payload as { missionStatus?: string; reviewStatus?: string };
    return payload.missionStatus ?? payload.reviewStatus ?? "command accepted";
  }

  private buildHumanCommandResultEnvelope(input: {
    envelope: HumanCommandEnvelope;
    status: "success" | "failed" | "review_required";
    payload: Record<string, unknown>;
    failureReason?: string | null;
  }): HumanCommandResultEnvelope {
    return {
      envelopeId: `${input.envelope.envelopeId}:result`,
      resultId: `${input.envelope.commandId}:result`,
      missionId: input.envelope.missionId,
      mapId: input.envelope.mapId,
      stepId: input.envelope.stepId,
      from: input.envelope.to,
      to: "commander-console",
      status: input.status,
      payloadRef: Object.keys(input.payload),
      payload: input.payload,
      failureReason: input.failureReason ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  private async handleHumanCommandEnvelope(envelope: HumanCommandEnvelope): Promise<HumanCommandResultEnvelope> {
    try {
      if (envelope.to === "orchestration") {
        if (envelope.commandType === "start-mission") {
          const payload = envelope.payload as {
            humanGoal?: string | null;
            requestedPlatformId?: GrassEyePlatformTarget | null;
            selectedMapId?: string | null;
            operatorNote?: string | null;
          };
          if (!payload.requestedPlatformId) {
            return this.buildHumanCommandResultEnvelope({
              envelope,
              status: "failed",
              payload: {},
              failureReason: "requestedPlatformId is required for start-mission.",
            });
          }
          const missionState = await this.orchestrationAbilityGroup.startMission({
            missionId: envelope.missionId,
            humanGoal: payload.humanGoal ?? "Discover evidence-backed product opportunities from the active social feed.",
            requestedPlatform: payload.requestedPlatformId,
            initialPayload: {
              requestedBy: "commander-console",
              ...(payload.selectedMapId ? { selectedMapId: payload.selectedMapId } : {}),
              ...(payload.operatorNote ? { operatorNote: payload.operatorNote } : {}),
            },
          });
          return this.buildHumanCommandResultEnvelope({
            envelope,
            status: missionState.status === "review_required" ? "review_required" : "success",
            payload: { missionId: missionState.missionId, missionStatus: missionState.status },
          });
        }

        const currentMission = await this.orchestrationAbilityGroup.getMissionState();
        const missionId = envelope.missionId !== "human-command" ? envelope.missionId : currentMission.missionId;
        if (!missionId) {
          return this.buildHumanCommandResultEnvelope({
            envelope,
            status: "failed",
            payload: {},
            failureReason: "No active mission is available.",
          });
        }

        const operatorNote = typeof envelope.payload.operatorNote === "string" ? envelope.payload.operatorNote : null;
        if (envelope.commandType === "pause-mission") {
          const missionState = await this.orchestrationAbilityGroup.pauseMission(missionId);
          return this.buildHumanCommandResultEnvelope({ envelope, status: "success", payload: { missionId, missionStatus: missionState.status } });
        }
        if (envelope.commandType === "resume-mission") {
          const missionState = await this.orchestrationAbilityGroup.resumeMission(missionId);
          return this.buildHumanCommandResultEnvelope({ envelope, status: missionState.status === "review_required" ? "review_required" : "success", payload: { missionId, missionStatus: missionState.status } });
        }
        if (envelope.commandType === "stop-mission") {
          const missionState = await this.orchestrationAbilityGroup.stopMission({ missionId, reason: operatorNote ?? "stop requested by commander console" });
          return this.buildHumanCommandResultEnvelope({ envelope, status: "success", payload: { missionId, missionStatus: missionState.status } });
        }

        const missionState = await this.orchestrationAbilityGroup.emergencyStop({ missionId, reason: operatorNote ?? "emergency stop requested by commander console" });
        return this.buildHumanCommandResultEnvelope({ envelope, status: "success", payload: { missionId, missionStatus: missionState.status } });
      }

      const targetRecordRef = envelope.payload.targetRecordRef as { recordId?: string } | undefined;
      const candidateId = targetRecordRef?.recordId;
      if (!candidateId) {
        return this.buildHumanCommandResultEnvelope({
          envelope,
          status: "failed",
          payload: {},
          failureReason: "Candidate review commands require a target candidate id.",
        });
      }

      const disposition = envelope.commandType === "approve-candidate"
        ? "approve"
        : envelope.commandType === "reject-candidate"
          ? "reject"
          : "hold";
      const operatorNote = typeof envelope.payload.operatorNote === "string" ? envelope.payload.operatorNote : undefined;
      const candidate = await this.evidenceStore.setCandidateDisposition(candidateId, disposition, operatorNote);
      return this.buildHumanCommandResultEnvelope({
        envelope,
        status: "success",
        payload: { candidateId: candidate.id, reviewStatus: candidate.reviewStatus },
      });
    } catch (error) {
      return this.buildHumanCommandResultEnvelope({
        envelope,
        status: "failed",
        payload: {},
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

    const snapshot = await this.missionRuntimeExecutor.getSnapshot();
    return {
      task: snapshot.currentTask
        ? {
            taskRunId: snapshot.currentTask.id,
            status: snapshot.currentTask.status,
            currentRoundIndex: snapshot.currentTask.currentRoundIndex,
          }
        : null,
      reviewRequiredReason: snapshot.deliveryState.reviewRequiredReason,
      failureReason: snapshot.deliveryState.lastError,
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
