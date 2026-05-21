import { existsSync, mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import { PlaywrightDomBrowserAdapter } from "./dom-smoke-browser.js";
import {
  createProductVideoDomSmokeWorkbench,
  writeProductVideoDomFixture,
  type ProductVideoDomSmokeState,
} from "./product-video-dom-smoke-support.js";

const tmp = mkdtempSync(join(tmpdir(), "grasseye-product-video-dom-start-smoke-"));
const htmlPath = join(tmp, "product-video-dom-fixture.html");
writeProductVideoDomFixture(htmlPath);

const launched = await chromium.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 980, height: 760 } });
const browser = new PlaywrightDomBrowserAdapter(page, tmp);
const state: ProductVideoDomSmokeState = {
  capturedStartInput: null,
  roundsCompleted: 0,
  savedRecordCount: 0,
  sawNonProductContinue: false,
};

const server = createWorkbenchServer({
  workbench: createProductVideoDomSmokeWorkbench({ tmp, browser, state }),
  baseUrl: "http://127.0.0.1",
});

async function listen(serverToStart: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => {
    serverToStart.listen(0, "127.0.0.1", () => resolve());
  });
  const address = serverToStart.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve smoke server port.");
  }
  return address.port;
}

try {
  const port = await listen(server);
  const fixtureUrl = pathToFileURL(htmlPath).href;
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      commandSource: "acceptance:product-video-dom-smoke",
      missionMode: "dom_product_video",
      userRequirementText: "Find product-seeding videos and save evidence.",
      selectedPlatforms: ["facebook-web"],
      productVideoPageUrl: fixtureUrl,
      maxRounds: 5,
      maxMinutes: 5,
    }),
  });
  const startPayload = await response.json();
  const recordsResponse = await fetch(`http://127.0.0.1:${port}/api/product-video-dom/records?limit=50`);
  const recordsPayload = await recordsResponse.json() as {
    count: number;
    jsonlPath: string;
    indexPath: string;
    records: Array<{
      screenshotRef?: string | null;
      screenshotPath?: string | null;
      likesText?: string | null;
      commentsText?: string | null;
      commentsCount?: number | null;
      commentDetails?: Array<unknown>;
    }>;
  };
  const firstRecord = recordsPayload.records[0];

  const payloadHasDomFields = state.capturedStartInput?.initialPayload
    && (state.capturedStartInput.initialPayload as Record<string, unknown>).missionMode === "dom_product_video"
    && (state.capturedStartInput.initialPayload as Record<string, unknown>).productVideoPageUrl === fixtureUrl;

  if (
    !response.ok
    || startPayload.status !== "success"
    || !payloadHasDomFields
    || state.roundsCompleted < 5
    || state.savedRecordCount < 2
    || !state.sawNonProductContinue
    || !recordsResponse.ok
    || recordsPayload.count < 2
    || !existsSync(recordsPayload.jsonlPath)
    || !existsSync(recordsPayload.indexPath)
    || !firstRecord
    || (!firstRecord.screenshotPath && !firstRecord.screenshotRef)
    || !firstRecord.likesText
    || !firstRecord.commentsText
    || typeof firstRecord.commentsCount !== "number"
    || (firstRecord.commentDetails?.length ?? 0) === 0
    || !page.url().includes("video-6")
  ) {
    process.stdout.write(`[PRODUCT-VIDEO-DOM-SMOKE][FAIL] ${JSON.stringify({ startPayload, state, recordsPayload, pageUrl: page.url() })}\n`);
    process.exit(1);
  }

  process.stdout.write(`[PRODUCT-VIDEO-DOM-SMOKE][PASS] started DOM mission via task API, completed ${state.roundsCompleted} rounds, saved ${state.savedRecordCount} records, and records API returned ${recordsPayload.count} real records\n`);
} finally {
  server.close();
  await launched.close();
}