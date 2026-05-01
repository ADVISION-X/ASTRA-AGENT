import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { parseJsonBody } from "./workbench-api-helpers.js";

const getCandidateIdFromPath = (url: URL): string | undefined => url.pathname.split("/")[3];

function mapReviewStatusToChildId(reviewStatus: "approved" | "rejected" | "archived" | "pending") {
  switch (reviewStatus) {
    case "approved":
      return "approve-candidate" as const;
    case "rejected":
      return "reject-candidate" as const;
    default:
      return "mark-review-required" as const;
  }
}

function mapDispositionToChildId(disposition: "approve" | "reject" | "hold" | "pending") {
  switch (disposition) {
    case "approve":
      return "approve-candidate" as const;
    case "reject":
      return "reject-candidate" as const;
    default:
      return "mark-review-required" as const;
  }
}

function mapReviewDecisionToChildId(disposition: "approve" | "reject" | "pending") {
  switch (disposition) {
    case "approve":
      return "approve-candidate" as const;
    case "reject":
      return "reject-candidate" as const;
    default:
      return "mark-review-required" as const;
  }
}

export async function handleCandidateReview(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  candidateId: string | undefined,
): Promise<void> {
  const body = await parseJsonBody(request) as { reviewStatus?: "approved" | "rejected" | "archived" | "pending"; note?: string };
  if (!candidateId || !body.reviewStatus) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid_candidate_review_request" }));
    return;
  }

  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: mapReviewStatusToChildId(body.reviewStatus),
    operatorRef: "commander-console:http",
    input: {
      candidateId,
      operatorNote: body.note?.trim() || null,
    },
  });
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result, null, 2));
}

export async function handleCandidateDisposition(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  candidateId: string | undefined,
): Promise<void> {
  const body = await parseJsonBody(request) as { disposition?: "approve" | "reject" | "hold" | "pending"; note?: string };
  if (!candidateId || !body.disposition) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid_candidate_disposition_request" }));
    return;
  }

  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: mapDispositionToChildId(body.disposition),
    operatorRef: "commander-console:http",
    input: {
      candidateId,
      operatorNote: body.note?.trim() || null,
    },
  });
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result, null, 2));
}

async function handleCandidateMutationRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
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
  _activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "DELETE" || !url.pathname.startsWith("/api/candidates/")) {
    return false;
  }

  response.writeHead(410, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "candidate_delete_removed_from_commander_console_ui" }));
  return true;
}

async function handleCandidateExportRequest(
  request: IncomingMessage,
  response: ServerResponse,
  _activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "GET" || url.pathname !== "/api/candidates/export") {
    return false;
  }

  response.writeHead(410, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "candidate_export_removed_from_commander_console_ui" }));
  return true;
}

async function handleCandidateReviewDecisionRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/candidates/review-decision") {
    return false;
  }

  const body = await parseJsonBody(request) as {
    candidateId?: string;
    disposition?: "approve" | "reject" | "pending";
    note?: string;
  };
  const candidateId = body.candidateId?.trim();
  if (!candidateId || !body.disposition) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid_candidate_review_decision_request" }));
    return true;
  }

  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: mapReviewDecisionToChildId(body.disposition),
    operatorRef: "commander-console:http",
    input: {
      candidateId,
      operatorNote: body.note?.trim() || null,
    },
  });
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result, null, 2));
  return true;
}

async function handleCandidateExportRequestCommand(
  request: IncomingMessage,
  response: ServerResponse,
  _activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/candidates/request-export") {
    return false;
  }

  response.writeHead(501, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "governed_export_request_not_implemented" }));
  return true;
}

export async function handleCandidateRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (await handleCandidateReviewDecisionRequest(request, response, activeWorkbench, url)) {
    return true;
  }

  if (await handleCandidateExportRequestCommand(request, response, activeWorkbench, url)) {
    return true;
  }

  if (await handleCandidateMutationRequest(request, response, activeWorkbench, url)) {
    return true;
  }

  if (await handleCandidateDeleteRequest(request, response, activeWorkbench, url)) {
    return true;
  }

  return handleCandidateExportRequest(request, response, activeWorkbench, url);
}