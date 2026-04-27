import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL, URL } from "node:url";

import { mapReviewStatusToDisposition, renderOperatorConsole } from "../features/operator-control/console-view.js";
import { getLocaleFromRequestUrl } from "../lib/localization/locale.js";
import { getDefaultLocalDataDir } from "../lib/local-runtime/default-data-dir.js";
import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const configuredPlatformTarget = process.env.GRASSEYE_PLATFORM_TARGET;
if (configuredPlatformTarget !== "tiktok-web") {
  throw new Error("GrassEye startup requires GRASSEYE_PLATFORM_TARGET=tiktok-web. Fixture/demo fallback is forbidden in phase 3.");
}
const browserProfileRef = process.env.GRASSEYE_BROWSER_PROFILE_REF?.trim();
const browserUserDataDir = process.env.GRASSEYE_BROWSER_USER_DATA_DIR?.trim();
if (!browserProfileRef || !browserUserDataDir) {
  throw new Error("GrassEye real-platform startup requires explicit GRASSEYE_BROWSER_PROFILE_REF and GRASSEYE_BROWSER_USER_DATA_DIR. Silent default browser profiles are forbidden because they cannot prove authorized login reuse.");
}
const platformTarget = configuredPlatformTarget;
const realPlatformDataDir = path.join(getDefaultLocalDataDir(), "phase-03-real-platform");
const defaultDataDir = realPlatformDataDir;

function getArtifactContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "image/svg+xml; charset=utf-8";
  }
}

const workbench = new GrassEyeWorkbench({
  baseUrl,
  platformTarget,
  browserHeadless: process.env.GRASSEYE_BROWSER_HEADLESS === "true",
  ...(process.env.GRASSEYE_REAL_PLATFORM_URL ? { realPlatformUrl: process.env.GRASSEYE_REAL_PLATFORM_URL } : {}),
  browserProfileRef,
  browserUserDataDir,
  dataDir: process.env.GRASSEYE_DATA_DIR ?? defaultDataDir,
});

async function parseJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

async function waitForTaskToSettle(activeWorkbench: GrassEyeWorkbench, maxAttempts = 100): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await activeWorkbench.getOperatorSnapshot();
    const status = snapshot.agent.currentTask?.status;
    if (!status || ["completed", "paused", "stopped", "failed", "review_required"].includes(status)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
export function createWorkbenchServer(input?: {
  workbench?: GrassEyeWorkbench;
  baseUrl?: string;
}): ReturnType<typeof createServer> {
  const activeWorkbench = input?.workbench ?? workbench;
  const activeBaseUrl = input?.baseUrl ?? baseUrl;

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", activeBaseUrl);

    if (request.method === "GET" && url.pathname === "/api/runtime/health") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.getHealthReport(), null, 2));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/runtime/snapshot") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.getOperatorSnapshot(), null, 2));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tasks/start") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.startTask(), null, 2));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/runtime/reset-store") {
      await activeWorkbench.resetLocalStore();
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.getOperatorSnapshot(), null, 2));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tasks/pause") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.pauseTask(), null, 2));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tasks/stop") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.stopTask(), null, 2));
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/candidates/") && url.pathname.endsWith("/review")) {
      const candidateId = url.pathname.split("/")[3];
      const body = await parseJsonBody(request) as { reviewStatus?: "approved" | "rejected" | "archived" | "pending"; note?: string };
      if (!candidateId || !body.reviewStatus) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "invalid_candidate_review_request" }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.updateCandidateDisposition(candidateId, mapReviewStatusToDisposition(body.reviewStatus), body.note), null, 2));
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/candidates/") && url.pathname.endsWith("/disposition")) {
      const candidateId = url.pathname.split("/")[3];
      const body = await parseJsonBody(request) as { disposition?: "approve" | "reject" | "hold" | "pending"; note?: string };
      if (!candidateId || !body.disposition) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "invalid_candidate_disposition_request" }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.updateCandidateDisposition(candidateId, body.disposition, body.note), null, 2));
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/candidates/")) {
      const candidateId = url.pathname.split("/")[3];
      if (!candidateId) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "invalid_candidate_id" }));
        return;
      }

      await activeWorkbench.deleteCandidate(candidateId);
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/candidates/export") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await activeWorkbench.exportCandidateSummaries(), null, 2));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/artifacts/")) {
      const artifactName = path.basename(url.pathname);
      const filePath = path.join(activeWorkbench.evidenceStore.getDataDir(), "artifacts", artifactName);
      response.writeHead(200, { "content-type": getArtifactContentType(filePath) });
      createReadStream(filePath).pipe(response);
      return;
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const locale = getLocaleFromRequestUrl(url);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderOperatorConsole(await activeWorkbench.getOperatorSnapshot(), { locale, requestUrl: url }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not_found" }));
  });
}

export function startServer(): ReturnType<typeof createServer> {
  const server = createWorkbenchServer();
  server.listen(port, host);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await workbench.init();
  const server = startServer();
  process.stdout.write(`GrassEye local workbench listening on ${baseUrl}\n`);
  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
