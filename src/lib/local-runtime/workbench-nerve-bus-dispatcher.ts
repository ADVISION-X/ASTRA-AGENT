/**
 * workbench-nerve-bus-dispatcher.ts — NerveBusHandlerPort implementation.
 *
 * Routes ability commands to the correct capability group.
 * Routes AI requests directly to the AI ability group.
 * Routes human commands to orchestration.
 *
 * Does NOT contain: map-chain, page-state/visual-target/PAV special routes,
 * AI special routes, Forensics finalization, or Commander read-model.
 */

import { randomUUID } from "node:crypto";

import type { AiAbilityInput } from "../../capabilities/ai/index.js";
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
  execute(input: unknown): Promise<{ status: string; failureReason?: string | null }>;
};

function buildAbilityGroupRegistry(deps: WorkbenchAssembly): Map<string, GenericAbilityGroup> {
  const registry = new Map<string, GenericAbilityGroup>();
  registry.set("ai", deps.aiAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("open", deps.openAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("screenshot", deps.screenshotAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("visual-target", deps.visualTargetAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("geometry-guard", deps.geometryGuardAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("mouse-click", deps.mouseClickAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("mouse-scroll", deps.mouseScrollAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("text-input", deps.textInputAbilityGroup as unknown as GenericAbilityGroup);
  registry.set("forensics-persistence", deps.forensicsPersistenceAbilityGroup as unknown as GenericAbilityGroup);
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
    async dispatchAbilityCommand(input: {
      envelope: AbilityCommandEnvelope;
      inputPayload: NerveBusPayloadDocument;
      signal: AbortSignal;
    }): Promise<NerveBusHandledResult<AbilityResultEnvelope> | null> {
      const { envelope, inputPayload } = input;

      // Special case: orchestration dispatches to itself (nested execute)
      if (envelope.abilityGroupId === "orchestration") {
        const orchestration = deps.getOrchestration();
        try {
          const result = await orchestration.execute({
            childCapabilityId: envelope.childCapabilityId as OrchestrationChildCapabilityId,
            payload: inputPayload,
          });
          const status = (result.status ?? "success") as "success" | "failed" | "review_required";
          const resultEnvelope = buildAbilityResultEnvelope(envelope, status, result.failureReason ?? null);
          return { envelope: resultEnvelope, outputPayload: result as unknown as NerveBusPayloadDocument };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "orchestration execute failed";
          return { envelope: buildAbilityResultEnvelope(envelope, "failed", msg), outputPayload: null };
        }
      }

      const group = abilityGroups.get(envelope.abilityGroupId);
      if (!group) {
        return {
          envelope: buildAbilityResultEnvelope(envelope, "failed", `Unknown ability group: ${envelope.abilityGroupId}`),
          outputPayload: null,
        };
      }

      try {
        // Enrich the input with envelope identity and generate missing tracking fields
        // so ability-group schemas (missionId, runId, sessionId, stepId, etc.) validate.
        const ip = inputPayload as Record<string, unknown>;

        // Open group uses a .strict() schema that forbids abilityGroupId, purpose, sourceRef,
        // videoVisitId. Build a clean input with only schema-allowed fields.
        const enrichedAbilityInput: Record<string, unknown> = envelope.abilityGroupId === "open"
          ? {
              ...ip,
              childCapabilityId: envelope.childCapabilityId,
              missionId: ip["missionId"] ?? envelope.missionId,
              runId: ip["runId"] ?? envelope.runId,
              ...(ip["sessionId"] != null ? { sessionId: ip["sessionId"] } : envelope.sessionId ? { sessionId: envelope.sessionId } : {}),
              roundId: ip["roundId"] ?? envelope.roundId ?? null,
              nerveBusEnvelopeId: ip["nerveBusEnvelopeId"] ?? envelope.envelopeId,
              stepId: ip["stepId"] ?? randomUUID(),
              capabilityCallId: ip["capabilityCallId"] ?? randomUUID(),
              inputRef: ip["inputRef"] ?? randomUUID(),
              requestedBy: ip["requestedBy"] ?? "orchestration:dispatch-sequence",
              idempotencyKey: ip["idempotencyKey"] ?? `dispatch:${envelope.missionId}:${envelope.runId}:${envelope.roundId ?? "noround"}:${envelope.envelopeId}`,
            }
          : {
              ...ip,
              abilityGroupId: envelope.abilityGroupId,
              childCapabilityId: envelope.childCapabilityId,
              missionId: ip["missionId"] ?? envelope.missionId,
              runId: ip["runId"] ?? envelope.runId,
              sessionId: ip["sessionId"] ?? envelope.sessionId ?? "local",
              roundId: ip["roundId"] ?? envelope.roundId ?? null,
              nerveBusEnvelopeId: ip["nerveBusEnvelopeId"] ?? envelope.envelopeId,
              stepId: ip["stepId"] ?? randomUUID(),
              capabilityCallId: ip["capabilityCallId"] ?? randomUUID(),
              inputRef: ip["inputRef"] ?? randomUUID(),
              requestedBy: ip["requestedBy"] ?? "orchestration:dispatch-sequence",
              purpose: ip["purpose"] ?? "execute-ai-action",
              sourceRef: ip["sourceRef"] ?? (ip["gridSpecRef"] as string | undefined) ?? envelope.envelopeId,
              idempotencyKey: ip["idempotencyKey"] ?? `dispatch:${envelope.missionId}:${envelope.runId}:${envelope.roundId ?? "noround"}:${envelope.envelopeId}`,
              videoVisitId: ip["videoVisitId"] ?? null,
            };
        const result = await group.execute(enrichedAbilityInput);
        const status = (result.status ?? "success") as "success" | "failed" | "review_required";
        const resultEnvelope = buildAbilityResultEnvelope(envelope, status, result.failureReason ?? null);
        return { envelope: resultEnvelope, outputPayload: result as unknown as NerveBusPayloadDocument };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ability group execute failed";
        return { envelope: buildAbilityResultEnvelope(envelope, "failed", msg), outputPayload: null };
      }
    },

    async requestAi(input: {
      envelope: AiRequestEnvelope;
      inputPayload: NerveBusPayloadDocument;
      signal: AbortSignal;
    }): Promise<NerveBusHandledResult<AiResponseEnvelope> | null> {
      const { envelope, inputPayload } = input;
      try {
        const result = await deps.aiAbilityGroup.execute(inputPayload as unknown as AiAbilityInput);
        const status = result.status === "success" ? "success" : "failed";
        const resultEnvelope = buildAiResponseEnvelope(envelope, status, result.failureReason ?? null);
        return { envelope: resultEnvelope, outputPayload: result as unknown as NerveBusPayloadDocument };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI execute failed";
        return { envelope: buildAiResponseEnvelope(envelope, "failed", msg), outputPayload: null };
      }
    },

    async dispatchHumanCommand(input: {
      envelope: HumanCommandEnvelope;
      inputPayload: NerveBusPayloadDocument;
      signal: AbortSignal;
    }): Promise<NerveBusHandledResult<HumanCommandResultEnvelope> | null> {
      const { envelope, inputPayload } = input;
      const orchestration = deps.getOrchestration();

      // Build a MissionCommandSchema-compatible payload from the transport payload.
      // The transport payload (StartMissionTransportPayload) uses different field names
      // and has extra fields not in MissionCommandSchema.strict().
      const tp = inputPayload as Record<string, unknown>;
      const initialPayload = tp["initialPayload"] as Record<string, unknown> | null | undefined;

      let orchestrationPayload: Record<string, unknown>;
      if (envelope.commandType === "start-mission") {
        orchestrationPayload = {
          missionId: envelope.missionId,
          runId: envelope.runId,
          humanGoal:
            (tp["humanGoal"] as string | undefined) ??
            (initialPayload?.["humanGoal"] as string | undefined) ??
            "",
          requestedPlatform:
            (tp["requestedPlatformId"] as string | undefined) ??
            (initialPayload?.["requestedPlatformId"] as string | undefined) ??
            (initialPayload?.["primaryPlatformId"] as string | undefined) ??
            "facebook-web",
          selectedPlatforms:
            (tp["selectedPlatforms"] as string[] | undefined) ??
            (initialPayload?.["selectedPlatforms"] as string[] | undefined) ??
            [],
          maxRounds: (tp["maxRounds"] as number | null | undefined) ?? null,
          maxMinutes: (tp["maxMinutes"] as number | null | undefined) ?? null,
          initialPayload: initialPayload ?? { requestedBy: "commander-console" },
        };
      } else {
        // For other command types, inject identity fields into the existing payload.
        orchestrationPayload = { ...tp };
        if (orchestrationPayload["missionId"] == null) {
          orchestrationPayload["missionId"] = envelope.missionId;
        }
        if (orchestrationPayload["runId"] == null) {
          orchestrationPayload["runId"] = envelope.runId;
        }
      }

      try {
        const result = await orchestration.execute({
          childCapabilityId: envelope.commandType as OrchestrationChildCapabilityId,
          payload: orchestrationPayload,
        });
        const status = result.status === "success" ? "success" : "failed";
        const resultEnvelope = buildHumanCommandResultEnvelope(envelope, status, result.failureReason ?? null);
        return { envelope: resultEnvelope, outputPayload: result as unknown as NerveBusPayloadDocument };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "human command dispatch failed";
        return { envelope: buildHumanCommandResultEnvelope(envelope, "failed", msg), outputPayload: null };
      }
    },
  };
}
