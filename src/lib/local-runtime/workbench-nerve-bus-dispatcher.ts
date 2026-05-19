/**
 * workbench-nerve-bus-dispatcher.ts — NerveBusHandlerPort implementation.
 *
 * Routes ability commands to the correct capability group.
 * Routes AI requests directly to the AI ability group.
 * Routes human commands to orchestration.
 *
 * Does NOT contain map-chain, retired support routes, or PAV special routes.
 * AI special routes, Forensics finalization, or Commander read-model.
 */

import { randomUUID } from "node:crypto";

import { AiAbilityInputSchema } from "../../capabilities/ai/index.js";
import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
  AiRequestEnvelope,
  AiResponseEnvelope,
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
  NerveBusHandledResult,
  NerveBusHandlerPort,
  NerveBusPayloadDocument,
} from "../../capabilities/nerve-bus/index.js";
import type { OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";
import type { OrchestrationChildCapabilityId } from "../../capabilities/orchestration/contract.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export type WorkbenchNerveBusDispatcherDeps = WorkbenchAssembly & {
  getOrchestration: () => OrchestrationAbilityGroup;
};

// ─── Ability Group Registry ─────────────────────────────────────────────────

type GenericAbilityGroup = {
  execute(input: NerveBusPayloadDocument): Promise<NerveBusPayloadDocument & { status?: string; failureReason?: string | null }>;
};

type AbilityLikeResult = NerveBusPayloadDocument & { status?: string; failureReason?: string | null };

const toPayloadDocument = (value: unknown): NerveBusPayloadDocument | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as NerveBusPayloadDocument
    : null;

function wrapAbilityGroup<TInput extends Record<string, unknown>>(
  execute: (input: TInput) => Promise<Record<string, unknown>>,
): GenericAbilityGroup {
  return {
    async execute(input: NerveBusPayloadDocument): Promise<AbilityLikeResult> {
      const result = await execute(input as TInput);
      return toPayloadDocument(result) ?? { status: "failed", failureReason: "ability group returned non-object result" };
    },
  };
}

function buildAbilityGroupRegistry(deps: WorkbenchAssembly): Map<string, GenericAbilityGroup> {
  const registry = new Map<string, GenericAbilityGroup>();
  registry.set("ai", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["aiAbilityGroup"]["execute"]>[0]) => deps.aiAbilityGroup.execute(input)));
  registry.set("open", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["openAbilityGroup"]["execute"]>[0]) => deps.openAbilityGroup.execute(input)));
  registry.set("screenshot", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["screenshotAbilityGroup"]["execute"]>[0]) => deps.screenshotAbilityGroup.execute(input)));
  registry.set("geometry-guard", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["geometryGuardAbilityGroup"]["execute"]>[0]) => deps.geometryGuardAbilityGroup.execute(input)));
  registry.set("mouse-click", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["mouseClickAbilityGroup"]["execute"]>[0]) => deps.mouseClickAbilityGroup.execute(input)));
  registry.set("mouse-scroll", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["mouseScrollAbilityGroup"]["execute"]>[0]) => deps.mouseScrollAbilityGroup.execute(input)));
  registry.set("text-input", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["textInputAbilityGroup"]["execute"]>[0]) => deps.textInputAbilityGroup.execute(input)));
  registry.set("forensics-persistence", wrapAbilityGroup((input: Parameters<WorkbenchAssembly["forensicsPersistenceAbilityGroup"]["execute"]>[0]) => deps.forensicsPersistenceAbilityGroup.execute(input)));
  return registry;
}

// ─── Result Envelope Builders ───────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function buildAbilityResultEnvelope(
  base: AbilityCommandEnvelope,
  status: "success" | "failed" | "review_required",
  failureReason: string | null,
): AbilityResultEnvelope {
  return {
    envelopeId: randomUUID(),
    kind: "ability-result" as const,
    missionId: base.missionId,
    runId: base.runId,
    sessionId: base.sessionId,
    roundId: base.roundId,
    issuedAt: base.issuedAt,
    commandEnvelopeId: base.envelopeId,
    abilityGroupId: base.abilityGroupId,
    childCapabilityId: base.childCapabilityId,
    status,
    failureReason: failureReason ?? null,
    receivedAt: nowIso(),
  };
}

function buildAiResponseEnvelope(
  base: AiRequestEnvelope,
  status: "success" | "failed",
  failureReason: string | null,
): AiResponseEnvelope {
  return {
    envelopeId: randomUUID(),
    kind: "ai-response" as const,
    missionId: base.missionId,
    runId: base.runId,
    sessionId: base.sessionId,
    roundId: base.roundId,
    issuedAt: base.issuedAt,
    requestEnvelopeId: base.envelopeId,
    status,
    failureReason: failureReason ?? null,
    receivedAt: nowIso(),
  };
}

function buildHumanCommandResultEnvelope(
  base: HumanCommandEnvelope,
  status: "success" | "failed",
  failureReason: string | null,
): HumanCommandResultEnvelope {
  return {
    envelopeId: randomUUID(),
    kind: "human-command-result" as const,
    missionId: base.missionId,
    runId: base.runId,
    sessionId: base.sessionId,
    roundId: base.roundId,
    issuedAt: base.issuedAt,
    commandEnvelopeId: base.envelopeId,
    status,
    failureReason: failureReason ?? null,
    receivedAt: nowIso(),
  };
}

// ─── Handler Port Factory ───────────────────────────────────────────────────

export function createWorkbenchNerveBusHandlerPort(deps: WorkbenchNerveBusDispatcherDeps): NerveBusHandlerPort {
  const abilityGroups = buildAbilityGroupRegistry(deps);
  return {
    dispatchAbilityCommand: (input) => dispatchAbilityCommand(input, deps, abilityGroups),
    requestAi: (input) => requestAi(input, deps),
    dispatchHumanCommand: (input) => dispatchHumanCommand(input, deps),
  };
}

const dispatchAbilityCommand = async (
  input: { envelope: AbilityCommandEnvelope; inputPayload: NerveBusPayloadDocument; signal: AbortSignal },
  deps: WorkbenchNerveBusDispatcherDeps,
  abilityGroups: Map<string, GenericAbilityGroup>,
): Promise<NerveBusHandledResult<AbilityResultEnvelope> | null> => {
  if (input.envelope.abilityGroupId === "orchestration") return dispatchOrchestrationAbility(input, deps.getOrchestration());
  const group = abilityGroups.get(input.envelope.abilityGroupId);
  if (!group) return { envelope: buildAbilityResultEnvelope(input.envelope, "failed", `Unknown ability group: ${input.envelope.abilityGroupId}`), outputPayload: null };
  try {
    const result = await group.execute(input.inputPayload);
    const status = (result.status ?? "success") as "success" | "failed" | "review_required";
    return { envelope: buildAbilityResultEnvelope(input.envelope, status, result.failureReason ?? null), outputPayload: toPayloadDocument(result) };
  } catch (error) {
    return { envelope: buildAbilityResultEnvelope(input.envelope, "failed", errorMessage(error, "ability group execute failed")), outputPayload: null };
  }
};

const dispatchOrchestrationAbility = async (
  input: { envelope: AbilityCommandEnvelope; inputPayload: NerveBusPayloadDocument },
  orchestration: OrchestrationAbilityGroup,
): Promise<NerveBusHandledResult<AbilityResultEnvelope>> => {
  try {
    const result = await orchestration.execute({ childCapabilityId: input.envelope.childCapabilityId as OrchestrationChildCapabilityId, payload: input.inputPayload });
    const status = (result.status ?? "success") as "success" | "failed" | "review_required";
    return { envelope: buildAbilityResultEnvelope(input.envelope, status, result.failureReason ?? null), outputPayload: toPayloadDocument(result) };
  } catch (error) {
    return { envelope: buildAbilityResultEnvelope(input.envelope, "failed", errorMessage(error, "orchestration execute failed")), outputPayload: null };
  }
};

const requestAi = async (
  input: { envelope: AiRequestEnvelope; inputPayload: NerveBusPayloadDocument; signal: AbortSignal },
  deps: WorkbenchNerveBusDispatcherDeps,
): Promise<NerveBusHandledResult<AiResponseEnvelope> | null> => {
  try {
    const result = await deps.aiAbilityGroup.execute(AiAbilityInputSchema.parse(input.inputPayload));
    const status = result.status === "success" ? "success" : "failed";
    return { envelope: buildAiResponseEnvelope(input.envelope, status, result.failureReason ?? null), outputPayload: toPayloadDocument(result) };
  } catch (error) {
    return { envelope: buildAiResponseEnvelope(input.envelope, "failed", errorMessage(error, "AI execute failed")), outputPayload: null };
  }
};

const dispatchHumanCommand = async (
  input: { envelope: HumanCommandEnvelope; inputPayload: NerveBusPayloadDocument; signal: AbortSignal },
  deps: WorkbenchNerveBusDispatcherDeps,
): Promise<NerveBusHandledResult<HumanCommandResultEnvelope> | null> => {
  const orchestrationPayload = buildHumanCommandPayload(input.envelope, input.inputPayload);
  try {
    const result = await deps.getOrchestration().execute({ childCapabilityId: input.envelope.commandType as OrchestrationChildCapabilityId, payload: orchestrationPayload });
    const status = result.status === "success" ? "success" : "failed";
    return { envelope: buildHumanCommandResultEnvelope(input.envelope, status, result.failureReason ?? null), outputPayload: toPayloadDocument(result) };
  } catch (error) {
    return { envelope: buildHumanCommandResultEnvelope(input.envelope, "failed", errorMessage(error, "human command dispatch failed")), outputPayload: null };
  }
};

const buildHumanCommandPayload = (
  envelope: HumanCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Record<string, unknown> => {
  const payload = inputPayload as Record<string, unknown>;
  if (envelope.commandType === "start-mission") return buildStartMissionPayload(envelope, payload);
  return { ...payload, missionId: payload["missionId"] ?? envelope.missionId, runId: payload["runId"] ?? envelope.runId };
};

const buildStartMissionPayload = (
  envelope: HumanCommandEnvelope,
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const initialPayload = payload["initialPayload"] as Record<string, unknown> | null | undefined;
  return {
    missionId: envelope.missionId,
    runId: envelope.runId,
    humanGoal: (payload["humanGoal"] as string | undefined) ?? (initialPayload?.["humanGoal"] as string | undefined) ?? "",
    requestedPlatform: (payload["requestedPlatformId"] as string | undefined) ?? (initialPayload?.["requestedPlatformId"] as string | undefined) ?? (initialPayload?.["primaryPlatformId"] as string | undefined) ?? "facebook-web",
    selectedPlatforms: (payload["selectedPlatforms"] as string[] | undefined) ?? (initialPayload?.["selectedPlatforms"] as string[] | undefined) ?? [],
    maxRounds: (payload["maxRounds"] as number | null | undefined) ?? null,
    maxMinutes: (payload["maxMinutes"] as number | null | undefined) ?? null,
    initialPayload: initialPayload ?? { requestedBy: "commander-console" },
  };
};

const errorMessage = (error: unknown, defaultMessage: string): string =>
  error instanceof Error ? error.message : defaultMessage;
