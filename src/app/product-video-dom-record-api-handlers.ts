import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { getProductVideoStorePaths } from "../plugins/product-video-dom-runtime/index.js";
import { writeJsonResponse } from "./workbench-api-helpers.js";

const ROUTE_RECORDS = "/api/product-video-dom/records";

const parseLimit = (url: URL): number => {
  const raw = Number(url.searchParams.get("limit") ?? "50");
  if (!Number.isFinite(raw)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(raw), 200));
};

export const handleProductVideoDomRecordRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "GET" || url.pathname !== ROUTE_RECORDS) {
    return false;
  }
  const limit = parseLimit(url);
  const records = await activeWorkbench.listProductVideoEvidenceRecords(limit);
  const paths = getProductVideoStorePaths(activeWorkbench.getDataDir());
  writeJsonResponse(response, 200, {
    ok: true,
    limit,
    count: records.length,
    jsonlPath: paths.recordsJsonlPath,
    indexPath: paths.recordsIndexPath,
    records,
  });
  return true;
};