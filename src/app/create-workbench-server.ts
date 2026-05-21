import { createServer } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";

const writeJson = (
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

const readJsonBody = async (request: import("node:http").IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};

const renderHome = (): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GrassEye Amazon Invoice Upload</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f7f4; color: #1f2933; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    section { margin-top: 24px; padding: 18px; border: 1px solid #d7d7cf; background: #fff; border-radius: 8px; }
    pre { overflow: auto; padding: 12px; background: #f1f1ec; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>GrassEye Amazon Invoice Upload</h1>
    <p>Local workbench for the Amazon invoice upload flow.</p>
    <section>
      <h2>Endpoints</h2>
      <pre>GET  /api/health
GET  /api/mode
POST /api/amazon-invoice-upload/mission
POST /api/amazon-invoice-upload/task
POST /api/amazon-invoice-upload/task/resume
GET  /api/amazon-invoice-upload/task?taskId=...</pre>
    </section>
  </main>
</body>
</html>`;

async function handleAmazonRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (url.pathname === "/api/amazon-invoice-upload/mission" && request.method === "POST") {
    const input = await readJsonBody(request);
    const result = await workbench.startAmazonInvoiceUploadMission(input as Parameters<typeof workbench.startAmazonInvoiceUploadMission>[0]);
    writeJson(response, 200, result);
    return true;
  }

  if (url.pathname === "/api/amazon-invoice-upload/task" && request.method === "POST") {
    const input = await readJsonBody(request);
    const result = await workbench.startAmazonInvoiceUploadTask(input as Parameters<typeof workbench.startAmazonInvoiceUploadTask>[0]);
    writeJson(response, 200, result);
    return true;
  }

  if (url.pathname === "/api/amazon-invoice-upload/task/resume" && request.method === "POST") {
    const input = await readJsonBody(request);
    const result = await workbench.resumeAmazonInvoiceUploadTask(input as Parameters<typeof workbench.resumeAmazonInvoiceUploadTask>[0]);
    writeJson(response, 200, result);
    return true;
  }

  if (url.pathname === "/api/amazon-invoice-upload/task" && request.method === "GET") {
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      writeJson(response, 400, { error: "missing_task_id" });
      return true;
    }
    const result = await workbench.getAmazonInvoiceUploadTaskStatus(taskId);
    writeJson(response, 200, result);
    return true;
  }

  if (url.pathname === "/api/amazon-invoice-upload/latest" && request.method === "GET") {
    const amazonOrderId = url.searchParams.get("amazonOrderId");
    if (!amazonOrderId) {
      writeJson(response, 400, { error: "missing_amazon_order_id" });
      return true;
    }
    const invoiceNo = url.searchParams.get("invoiceNo") ?? undefined;
    const result = await workbench.getLatestAmazonInvoiceUploadTaskForInvoice({
      amazonOrderId,
      ...(invoiceNo ? { invoiceNo } : {}),
    });
    writeJson(response, 200, { task: result });
    return true;
  }

  return false;
}

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  baseUrl: string,
): Promise<void> {
  const url = new URL(request.url ?? "/", baseUrl);

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderHome());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    writeJson(response, 200, await workbench.getHealthReport());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mode") {
    writeJson(response, 200, { mode: workbench.getModeInfo() });
    return;
  }

  if (await handleAmazonRequest(request, response, workbench, url)) {
    return;
  }

  writeJson(response, 404, { error: "not_found" });
}

export function createWorkbenchServer(input: {
  workbench: GrassEyeWorkbenchHandle;
  baseUrl: string;
}): ReturnType<typeof createServer> {
  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, input.workbench, input.baseUrl);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      }
      response.end(JSON.stringify({ error: "workbench_request_failed", failureReason }));
    }
  });
}
