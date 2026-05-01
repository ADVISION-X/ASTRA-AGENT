import type { IncomingMessage, ServerResponse } from "node:http";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { executeTaskStartCommand, handleTaskStartOutcome } from "./task-start-command.js";
import { createTaskStartDraft } from "./task-start-request-draft.js";
import { handleBindingFailure, recordTaskStartDraftEvents, runTaskStartPreflight, sendBlockedPreflightResponse } from "./task-start-preflight.js";

export async function handleTaskStartRequest(request: IncomingMessage, response: ServerResponse, activeWorkbench: GrassEyeWorkbench): Promise<true> {
  const draft = await createTaskStartDraft(request);
  await recordTaskStartDraftEvents(activeWorkbench, draft);
  if (!draft.resolvedBinding.ok) {
    return handleBindingFailure(response, activeWorkbench, draft);
  }

  const preflight = await runTaskStartPreflight(activeWorkbench, draft, draft.resolvedBinding);
  if (preflight.status === "blocked") {
    return sendBlockedPreflightResponse(response, draft, preflight);
  }

  const execution = await executeTaskStartCommand(activeWorkbench, draft, draft.resolvedBinding);
  return handleTaskStartOutcome({ response, activeWorkbench, draft, binding: draft.resolvedBinding, execution });
}