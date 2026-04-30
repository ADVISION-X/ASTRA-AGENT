import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { createId } from "../lib/local-runtime/ids.js";
import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { getDefaultMapPluginRegistry } from "../map-plugins/registry/map-plugin-registry.js";
import { parseJsonBody } from "./workbench-api-helpers.js";

function normalizeRequestedPlatformId(value?: string): "facebook-web" | "tiktok-web" | null {
  if (value === "tiktok-web" || value === "facebook-web") {
    return value;
  }

  return null;
}

function resolveMissionStartBinding(input: {
  taskTemplateId: string | null;
  requestedPlatformId: "facebook-web" | "tiktok-web" | null;
  selectedMapId: string | null;
}): {
  ok: true;
  taskTemplateId: string;
  activationId: string;
  requestedPlatformId: "facebook-web" | "tiktok-web";
  selectedMapId: string;
} | {
  ok: false;
  failureReason: string;
  actionableMessage: string;
  nextAction: string;
} {
  const activeRegistry = getDefaultMapPluginRegistry().active;

  if (input.taskTemplateId) {
    const binding = activeRegistry.getTaskTemplateDeveloperBinding(input.taskTemplateId);
    if (!binding || !binding.requestedPlatformId) {
      return {
        ok: false,
        failureReason: `taskTemplateId=${input.taskTemplateId} is not bound to an active approved launch record.`,
        actionableMessage: "任务模板未绑定到已激活批准地图，无法启动任务。",
        nextAction: "选择一个已激活批准的任务模板，或先完成该地图包的激活。",
      };
    }
    if (input.selectedMapId && input.selectedMapId !== binding.mapId) {
      return {
        ok: false,
        failureReason: `taskTemplateId=${input.taskTemplateId} conflicts with selectedMapId=${input.selectedMapId}.`,
        actionableMessage: "任务模板与显式地图绑定不一致，任务已被拦截。",
        nextAction: "移除显式 selectedMapId，或改用与任务模板一致的激活地图。",
      };
    }
    if (input.requestedPlatformId && input.requestedPlatformId !== binding.requestedPlatformId) {
      return {
        ok: false,
        failureReason: `taskTemplateId=${input.taskTemplateId} conflicts with requestedPlatformId=${input.requestedPlatformId}.`,
        actionableMessage: "任务模板与显式平台绑定不一致，任务已被拦截。",
        nextAction: "移除显式 requestedPlatformId，或改用与任务模板一致的平台任务模板。",
      };
    }
    return {
      ok: true,
      taskTemplateId: binding.taskTemplateId,
      activationId: binding.activationId,
      requestedPlatformId: binding.requestedPlatformId,
      selectedMapId: binding.mapId,
    };
  }

  if (!input.requestedPlatformId || !input.selectedMapId) {
    return {
      ok: false,
      failureReason: "requestedPlatformId and selectedMapId are both required before mission start.",
      actionableMessage: "任务无法启动，因为缺少 taskTemplateId 或显式地图绑定。",
      nextAction: "选择一个已激活批准的任务模板，或在开发者模式下提供有效的 selectedMapId 与 requestedPlatformId。",
    };
  }

  const record = activeRegistry.getActiveOperationalMapRecord(input.selectedMapId);
  if (!record) {
    return {
      ok: false,
      failureReason: `selectedMapId=${input.selectedMapId} is not an active approved map.`,
      actionableMessage: "显式地图绑定未对应到已激活批准地图，任务已被拦截。",
      nextAction: "改用已激活批准的地图，或改为通过任务模板启动。",
    };
  }
  if (record.requestedPlatformId !== input.requestedPlatformId) {
    return {
      ok: false,
      failureReason: `selectedMapId=${input.selectedMapId} is bound to requestedPlatformId=${record.requestedPlatformId}, not ${input.requestedPlatformId}.`,
      actionableMessage: "显式地图与平台绑定不一致，任务已被拦截。",
      nextAction: "选择与地图绑定一致的平台，或直接使用任务模板启动。",
    };
  }

  return {
    ok: true,
    taskTemplateId: record.taskTemplateId,
    activationId: record.activationId,
    requestedPlatformId: input.requestedPlatformId,
    selectedMapId: input.selectedMapId,
  };
}

function normalizePositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    return undefined;
  }

  return value;
}

export async function handleTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method === "POST" && url.pathname === "/api/tasks/start") {
    const body = await parseJsonBody(request) as {
      commandSource?: string;
      humanGoal?: string;
      taskTemplateId?: string;
      requestedPlatformId?: string;
      selectedMapId?: string;
      targetProfileRef?: string;
      maxRounds?: number;
      maxMinutes?: number;
    };
    const traceId = createId("trace");
    const attemptId = createId("attempt");
    const taskTemplateId = body.taskTemplateId?.trim() || null;
    const resolvedBinding = resolveMissionStartBinding({
      taskTemplateId,
      requestedPlatformId: normalizeRequestedPlatformId(body.requestedPlatformId),
      selectedMapId: body.selectedMapId?.trim() || null,
    });
    const requestedPlatformId = resolvedBinding.ok ? resolvedBinding.requestedPlatformId : null;
    const selectedMapId = resolvedBinding.ok ? resolvedBinding.selectedMapId : null;
    const resolvedTaskTemplateId = resolvedBinding.ok ? resolvedBinding.taskTemplateId : taskTemplateId;
    const commandSource = body.commandSource?.trim() || "task-api:http-post";
    const humanGoal = body.humanGoal?.trim() || null;
    const maxRounds = normalizePositiveInteger(body.maxRounds, 9);
    const maxMinutes = normalizePositiveInteger(body.maxMinutes, 180);
    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "HUMAN_COMMAND_DRAFTED",
      status: "started",
      traceId,
      spanId: "human-command-drafted",
      attemptId,
      mapId: selectedMapId,
      taskTemplateId: resolvedTaskTemplateId,
      reason: `Commander Console start-mission payload drafted from source=${commandSource}.`,
      actionableMessage: "Persist the governed human-command draft before validation.",
      ownerResponsible: "Commander Console / Local App Shell",
    });
    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "HUMAN_COMMAND_RECEIVED",
      status: "started",
      traceId,
      spanId: "human-command-received",
      attemptId,
      mapId: selectedMapId,
      taskTemplateId: resolvedTaskTemplateId,
      reason: `Commander Console received a start-mission request from source=${commandSource}.`,
      actionableMessage: "Validate the human command payload before dispatching it.",
      ownerResponsible: "Commander Console / Local App Shell",
    });
    if (!resolvedBinding.ok) {
      const failureReason = resolvedBinding.failureReason;
      await activeWorkbench.recordCommanderDebugEvent({
        eventType: "COMMAND_REJECTED",
        status: "failed",
        traceId,
        spanId: "command-rejected",
        attemptId,
        mapId: selectedMapId,
        taskTemplateId: resolvedTaskTemplateId,
        failureReason,
        actionableMessage: resolvedBinding.nextAction,
        ownerResponsible: "Commander Console / Orchestration",
      });
      response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        error: "mission_start_binding_invalid",
        actionableMessage: resolvedBinding.actionableMessage,
        failureReason,
        nextAction: resolvedBinding.nextAction,
        ownerResponsible: "Commander Console / Orchestration",
        commandSource,
        traceId,
        attemptId,
      }));
      return true;
    }

    const approvedRequestedPlatformId = resolvedBinding.requestedPlatformId;
    const approvedSelectedMapId = resolvedBinding.selectedMapId;
    const approvedTaskTemplateId = resolvedBinding.taskTemplateId;
    const approvedActivationId = resolvedBinding.activationId;

    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "HUMAN_COMMAND_VALIDATED",
      status: "success",
      traceId,
      spanId: "human-command-validated",
      attemptId,
      mapId: approvedSelectedMapId,
      taskTemplateId: approvedTaskTemplateId,
      reason: `requestedPlatformId=${approvedRequestedPlatformId}; selectedMapId=${approvedSelectedMapId}`,
      actionableMessage: "Run mission preflight before dispatching the governed human command.",
      ownerResponsible: "Commander Console",
    });
    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "MISSION_PREFLIGHT_STARTED",
      status: "started",
      traceId,
      spanId: "mission-preflight-started",
      attemptId,
      mapId: approvedSelectedMapId,
      taskTemplateId: approvedTaskTemplateId,
      reason: "Mission preflight is checking readiness before command dispatch.",
      actionableMessage: "Verify browser session, local AI, map binding, and Forensics storage before mission start.",
      ownerResponsible: "Commander Console / Orchestration",
    });

    const preflight = await activeWorkbench.getMissionStartPreflight({
      requestedPlatformId: approvedRequestedPlatformId,
      selectedMapId: approvedSelectedMapId,
    });
    const localAiComponent = preflight.components.find((component) => component.name === "localAi");
    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "LOCAL_AI_READINESS_STARTED",
      status: "started",
      traceId,
      spanId: "local-ai-readiness-started",
      attemptId,
      mapId: approvedSelectedMapId,
      taskTemplateId: approvedTaskTemplateId,
      reason: "Mission preflight is evaluating local AI readiness.",
      actionableMessage: "Confirm Ollama reachability and local model availability.",
      ownerResponsible: "AI Capability / Local AI Runtime",
    });
    if (localAiComponent && !localAiComponent.ok) {
      await activeWorkbench.recordCommanderDebugEvent({
        eventType: "LOCAL_AI_READINESS_DEGRADED",
        status: "failed",
        traceId,
        spanId: "local-ai-readiness-degraded",
        attemptId,
        mapId: approvedSelectedMapId,
        taskTemplateId: approvedTaskTemplateId,
        failureReason: localAiComponent.detail,
        actionableMessage: localAiComponent.actionableMessage,
        ownerResponsible: localAiComponent.ownerResponsible,
      });
      await activeWorkbench.recordCommanderDebugEvent({
        eventType: "LOCAL_AI_READINESS_BLOCKING_REASON",
        status: "failed",
        traceId,
        spanId: "local-ai-readiness-blocking-reason",
        attemptId,
        mapId: approvedSelectedMapId,
        taskTemplateId: approvedTaskTemplateId,
        failureReason: localAiComponent.detail,
        actionableMessage: localAiComponent.actionableMessage,
        ownerResponsible: localAiComponent.ownerResponsible,
      });
    }
    if (preflight.status === "blocked") {
      await activeWorkbench.recordCommanderDebugEvent({
        eventType: "MISSION_PREFLIGHT_FAILED",
        status: "failed",
        traceId,
        spanId: "mission-preflight-failed",
        attemptId,
        mapId: approvedSelectedMapId,
        taskTemplateId: approvedTaskTemplateId,
        failureReason: preflight.failureReason,
        actionableMessage: preflight.nextAction,
        ownerResponsible: preflight.ownerResponsible,
      });
      await activeWorkbench.recordCommanderDebugEvent({
        eventType: "COMMAND_REJECTED",
        status: "failed",
        traceId,
        spanId: "command-rejected",
        attemptId,
        mapId: approvedSelectedMapId,
        taskTemplateId: approvedTaskTemplateId,
        failureReason: preflight.failureReason,
        actionableMessage: preflight.nextAction,
        ownerResponsible: preflight.ownerResponsible,
      });
      response.writeHead(409, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        error: "mission_preflight_failed",
        actionableMessage: preflight.actionableMessage,
        failureReason: preflight.failureReason,
        nextAction: preflight.nextAction,
        ownerResponsible: preflight.ownerResponsible,
        readinessStatus: "degraded",
        primaryBlockingReason: preflight.components.find((component) => component.ok !== true) ?? null,
        blockingReasons: preflight.components.filter((component) => component.ok !== true),
        commandSource,
        traceId,
        attemptId,
        components: preflight.components,
      }, null, 2));
      return true;
    }
    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "MISSION_PREFLIGHT_PASSED",
      status: "success",
      traceId,
      spanId: "mission-preflight-passed",
      attemptId,
      mapId: approvedSelectedMapId,
      taskTemplateId: approvedTaskTemplateId,
      reason: preflight.actionableMessage,
      actionableMessage: "Dispatch the governed human command through Commander Console and Nerve Bus.",
      ownerResponsible: "Commander Console / Nerve Bus",
    });

    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "issue-human-command",
      operatorRef: "commander-console:http",
      input: {
        commandType: "start-mission",
        requestedPlatformId: approvedRequestedPlatformId,
        selectedMapId: approvedSelectedMapId,
        humanGoal,
        maxRounds,
        maxMinutes,
        initialPayload: {
          kind: "start-mission",
          requestedBy: "commander-console",
          requestedPlatformId: approvedRequestedPlatformId,
          selectedMapId: approvedSelectedMapId,
          taskTemplateId: approvedTaskTemplateId,
          activationId: approvedActivationId,
          ...(humanGoal ? { humanGoal } : {}),
          ...(maxRounds ? { maxRounds } : {}),
          ...(maxMinutes ? { maxMinutes } : {}),
        },
      },
    });
    const resultMessage = result.output !== null
      && typeof result.output === "object"
      && "message" in result.output
      && typeof result.output.message === "string"
      ? result.output.message
      : "Commander Console completed the governed human command dispatch.";
    const targetMissionId = result.output !== null
      && typeof result.output === "object"
      && "targetMissionId" in result.output
      && typeof result.output.targetMissionId === "string"
      ? result.output.targetMissionId
      : null;
    if (result.status === "success") {
      await activeWorkbench.recordCommanderDebugEvent({
        eventType: "COMMAND_ACCEPTED",
        status: "success",
        traceId,
        spanId: "command-accepted",
        attemptId,
        missionId: targetMissionId,
        mapId: approvedSelectedMapId,
        taskTemplateId: approvedTaskTemplateId,
        reason: resultMessage,
        actionableMessage: "Mission dispatch succeeded. Monitor the mission page and runtime proof timeline.",
        ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
      });
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(result, null, 2));
      return true;
    }

    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "COMMAND_REJECTED",
      status: result.status === "review_required" ? "review_required" : "failed",
      traceId,
      spanId: "command-rejected",
      attemptId,
      missionId: targetMissionId,
      mapId: approvedSelectedMapId,
      taskTemplateId: approvedTaskTemplateId,
      failureReason: result.failureReason ?? result.reviewRequiredReason ?? resultMessage,
      actionableMessage: result.reviewRequiredReason
        ? "Open the review queue and inspect the guarded command result before retrying."
        : "Inspect the latest debug bundle and fix the blocking dependency before retrying.",
      ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
    });
    response.writeHead(409, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      ...result,
      traceId,
      attemptId,
    }, null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/pause") {
    const body = await parseJsonBody(request) as { targetMissionId?: string; reason?: string };
    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "pause-mission",
      operatorRef: "commander-console:http",
      input: {
        targetMissionId: body.targetMissionId?.trim() || null,
        operatorNote: body.reason?.trim() || null,
      },
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/resume") {
    const body = await parseJsonBody(request) as { targetMissionId?: string; reason?: string };
    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "resume-mission",
      operatorRef: "commander-console:http",
      input: {
        targetMissionId: body.targetMissionId?.trim() || null,
        operatorNote: body.reason?.trim() || null,
      },
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/stop") {
    const body = await parseJsonBody(request) as { reason?: string };
    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "stop-mission",
      operatorRef: "commander-console:http",
      input: { operatorNote: body.reason?.trim() || null },
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/emergency-stop") {
    const body = await parseJsonBody(request) as { reason?: string; targetMissionId?: string };
    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "emergency-stop",
      operatorRef: "commander-console:http",
      input: {
        targetMissionId: body.targetMissionId?.trim() || null,
        operatorNote: body.reason?.trim() || null,
      },
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  return false;
}