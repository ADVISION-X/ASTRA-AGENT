import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { mapDispositionToCommandType, mapReviewStatusToCommandType } from "../capabilities/commander-console/shared/review-decision.js";
import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { parseJsonBody } from "./workbench-api-helpers.js";

const getCandidateIdFromPath = (url: URL): string | undefined => url.pathname.split("/")[3];

export async function handleCandidateReview(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  candidateId: string | undefined,
): Promise<void> {
  const body = await parseJsonBody(request) as { reviewStatus?: "approved" | "rejected" | "archived" | "pending"; note?: string };
  if (!candidateId || !body.reviewStatus) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid_candidate_review_request" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  const commandType = mapReviewStatusToCommandType(body.reviewStatus);
  const result = commandType === "approve-candidate"
    ? await activeWorkbench.commanderConsole.approveCandidate(candidateId, body.note)
    : commandType === "reject-candidate"
      ? await activeWorkbench.commanderConsole.rejectCandidate(candidateId, body.note)
      : await activeWorkbench.commanderConsole.markReviewRequired(candidateId, body.note);
  response.end(JSON.stringify(result, null, 2));
}

export async function handleCandidateDisposition(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  candidateId: string | undefined,
): Promise<void> {
  const body = await parseJsonBody(request) as { disposition?: "approve" | "reject" | "hold" | "pending"; note?: string };
  if (!candidateId || !body.disposition) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid_candidate_disposition_request" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  const commandType = mapDispositionToCommandType(body.disposition);
  const result = commandType === "approve-candidate"
    ? await activeWorkbench.commanderConsole.approveCandidate(candidateId, body.note)
    : commandType === "reject-candidate"
      ? await activeWorkbench.commanderConsole.rejectCandidate(candidateId, body.note)
      : await activeWorkbench.commanderConsole.markReviewRequired(candidateId, body.note);
  response.end(JSON.stringify(result, null, 2));
}

async function handleCandidateMutationRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  const candidateId = getCandidateIdFromPath(url);
  if (request.method === "POST" && url.pathname.startsWith("/api/candidates/") && url.pathname.endsWith("/review")) {
    await handleCandidateReview(request, response, activeWorkbench, candidateId);
    return true;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/candidates/") && url.pathname.endsWith("/disposition")) {
    await handleCandidateDisposition(request, response, activeWorkbench, candidateId);
    return true;
  }

  return false;
}

async function handleCandidateDeleteRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method !== "DELETE" || !url.pathname.startsWith("/api/candidates/")) {
    return false;
  }

  const candidateId = getCandidateIdFromPath(url);
  if (!candidateId) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid_candidate_id" }));
    return true;
  }

  await activeWorkbench.deleteCandidate(candidateId);
  response.writeHead(204);
  response.end();
  return true;
}

async function handleCandidateExportRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method !== "GET" || url.pathname !== "/api/candidates/export") {
    return false;
  }

  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(await activeWorkbench.exportCandidateSummaries(), null, 2));
  return true;
}

export async function handleCandidateRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (await handleCandidateMutationRequest(request, response, activeWorkbench, url)) {
    return true;
  }

  if (await handleCandidateDeleteRequest(request, response, activeWorkbench, url)) {
    return true;
  }

  return handleCandidateExportRequest(request, response, activeWorkbench, url);
}