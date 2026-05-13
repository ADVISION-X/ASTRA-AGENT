/**
 * Nerve Bus — governed transport ability group implementation.
 * Pure transport: build envelope → call handlerPort → return result.
 * No directional channel children. No infra systems beyond direct port calls.
 */

import { randomUUID } from "crypto";
import {
  NERVE_BUS_CHILD_IDS,
  NERVE_BUS_DEFAULT_TIMEOUT_MS,
} from "./schema.js";
import type {
  NerveBusAbilityGroup,
  CreateNerveBusAbilityGroupInput,
  AbilityCommandDispatchInput,
  AbilityDispatchResult,
  AiRequestDispatchInput,
  AiRequestDispatchResult,
  HumanCommandDispatchInput,
  HumanCommandDispatchResult,
} from "./contract.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createNerveBusAbilityGroup(
  input: CreateNerveBusAbilityGroupInput,
): NerveBusAbilityGroup {
  const { handlerPort } = input;

  async function dispatchAbilityCommand(
    cmd: AbilityCommandDispatchInput,
  ): Promise<AbilityDispatchResult> {
    const envelope = {
      envelopeId: randomUUID(),
      kind: "ability-command" as const,
      missionId: cmd.missionId,
      runId: cmd.runId,
      sessionId: cmd.sessionId,
      roundId: cmd.roundId,
      issuedAt: nowIso(),
      abilityGroupId: cmd.abilityGroupId,
      childCapabilityId: cmd.childCapabilityId,
      inputPayload: cmd.inputPayload,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NERVE_BUS_DEFAULT_TIMEOUT_MS);

    try {
      const result = await handlerPort.dispatchAbilityCommand({
        envelope,
        inputPayload: cmd.inputPayload,
        signal: controller.signal,
      });

      if (result === null) {
        return { status: "failed", failureReason: "Handler port returned null" };
      }

      return {
        status: result.envelope.status,
        failureReason: result.envelope.failureReason,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "failed", failureReason: msg };
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestAi(cmd: AiRequestDispatchInput): Promise<AiRequestDispatchResult> {
    const envelope = {
      envelopeId: randomUUID(),
      kind: "ai-request" as const,
      missionId: cmd.missionId,
      runId: cmd.runId,
      sessionId: cmd.sessionId,
      roundId: cmd.roundId,
      issuedAt: nowIso(),
      requestType: cmd.requestType,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NERVE_BUS_DEFAULT_TIMEOUT_MS);

    try {
      const result = await handlerPort.requestAi({
        envelope,
        inputPayload: cmd.inputPayload,
        signal: controller.signal,
      });

      if (result === null) {
        return { status: "failed", failureReason: "Handler port returned null", outputPayload: null };
      }

      return {
        status: result.envelope.status,
        failureReason: result.envelope.failureReason,
        outputPayload: result.outputPayload,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "failed", failureReason: msg, outputPayload: null };
    } finally {
      clearTimeout(timer);
    }
  }

  async function dispatchHumanCommand(cmd: HumanCommandDispatchInput): Promise<HumanCommandDispatchResult> {
    const envelope = {
      envelopeId: randomUUID(),
      kind: "human-command" as const,
      missionId: cmd.missionId,
      runId: cmd.runId,
      sessionId: cmd.sessionId,
      roundId: cmd.roundId,
      issuedAt: nowIso(),
      commandType: cmd.commandType,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NERVE_BUS_DEFAULT_TIMEOUT_MS);

    try {
      const result = await handlerPort.dispatchHumanCommand({
        envelope,
        inputPayload: cmd.inputPayload,
        signal: controller.signal,
      });

      if (result === null) {
        return { status: "failed", failureReason: "Handler port returned null", outputPayload: null };
      }

      return {
        status: result.envelope.status,
        failureReason: result.envelope.failureReason,
        outputPayload: result.outputPayload,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "failed", failureReason: msg, outputPayload: null };
    } finally {
      clearTimeout(timer);
    }
  }

  void NERVE_BUS_CHILD_IDS; // referenced for governance proof

  return {
    dispatchAbilityCommand,
    requestAi,
    dispatchHumanCommand,
  };
}
