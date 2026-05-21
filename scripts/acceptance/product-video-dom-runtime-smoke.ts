import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import {
  getProductVideoDomTaskStatus,
  startProductVideoDomMiningTask,
} from "../../src/plugins/product-video-dom-runtime/index.js";
import { PlaywrightDomBrowserAdapter } from "./dom-smoke-browser.js";

const tmp = mkdtempSync(join(tmpdir(), "grasseye-product-video-dom-smoke-"));
const htmlPath = join(tmp, "product-video.html");

writeFileSync(htmlPath, `
<html><head><title>Seed Video Fixture</title></head>
<body>
  <main id="video-one">
    <h1>Title Product demo #cleanhome</h1>
    <p>Author @demo_creator</p>
    <p>Description This is a product seeding video with shop link and buying guide.</p>
    <a href="/shop/product-1">Shop product</a>
    <button id="like-button" aria-label="Like video">Like</button>
    <button id="comments-button" aria-label="Comments 12">Comments 12</button>
    <button id="next-button" aria-label="Next video">Next video</button>
    <section id="comments-panel" hidden>
      <p>Comment: Where can I buy this?</p>
      <p>Comment: Bought one yesterday, it works.</p>
      <p>Comment: Is the price still discounted?</p>
    </section>
    <p id="state">current video one</p>
  </main>
  <script>
    document.querySelector("#like-button").addEventListener("click", () => {
      document.querySelector("#like-button").textContent = "Liked";
    });
    document.querySelector("#comments-button").addEventListener("click", () => {
      document.querySelector("#comments-panel").hidden = false;
    });
    document.querySelector("#next-button").addEventListener("click", () => {
      document.querySelector("#state").textContent = "current video two";
      location.hash = "video-two";
    });
  </script>
</body></html>
`);

const launched = await chromium.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
const browser = new PlaywrightDomBrowserAdapter(page, tmp);
let productStartCount = 0;

const commanderConsole: GrassEyeWorkbenchHandle["commanderConsole"] = {
  abilityGroupId: "commander-console",
  listChildCapabilityIds() {
    return [];
  },
  async execute() {
    throw new Error("product video plugin route must not call commander console task start");
  },
};

const createUnusedAsync = <TValue>(message = "unused") => async (): Promise<TValue> => {
  throw new Error(message);
};

const createSmokeWorkbench = (): GrassEyeWorkbenchHandle => ({
  commanderConsole,
  init: async () => {},
  getHealthReport: createUnusedAsync(),
  getMissionReadinessReport: createUnusedAsync(),
  getMissionStartPreflight: createUnusedAsync(),
  getCommanderConsoleSnapshot: createUnusedAsync(),
  getAppRunLimitSettings: createUnusedAsync(),
  saveAppRunLimitSettings: createUnusedAsync(),
  getOnlineAiProviderSettings: createUnusedAsync(),
  saveOnlineAiProviderSettings: createUnusedAsync(),
  getDataDir() { return tmp; },
  getUserRequirementHistory: async () => [],
  upsertUserRequirementHistory: createUnusedAsync(),
  deleteUserRequirementHistory: createUnusedAsync(),
  reuseUserRequirementHistory: async () => null,
  openAdminInvoicePage: createUnusedAsync(),
  startAmazonInvoiceUploadMission: createUnusedAsync(),
  startAmazonInvoiceUploadTask: createUnusedAsync(),
  resumeAmazonInvoiceUploadTask: createUnusedAsync(),
  getAmazonInvoiceUploadTaskStatus: createUnusedAsync(),
  getLatestAmazonInvoiceUploadTaskForInvoice: async () => null,
  async startProductVideoDomMiningTask(input) {
    productStartCount += 1;
    return startProductVideoDomMiningTask({ browser, dataDir: tmp, mission: input.mission });
  },
  async getProductVideoDomTaskStatus(taskId: string) {
    return getProductVideoDomTaskStatus({ dataDir: tmp, taskId });
  },
  getModeInfo() { return {}; },
});

const server = createWorkbenchServer({ workbench: createSmokeWorkbench(), baseUrl: "http://127.0.0.1" });

async function listen(serverToStart: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => {
    serverToStart.listen(0, "127.0.0.1", () => resolve());
  });
  const address = serverToStart.address();
  if (!address || typeof address === "string") throw new Error("Unable to resolve smoke server port.");
  return address.port;
}

try {
  const port = await listen(server);
  const response = await fetch(`http://127.0.0.1:${port}/api/plugins/product-video-dom-runtime/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      missionType: "product_video_dom_mining",
      platformId: "fixture-video-platform",
      pageUrl: pathToFileURL(htmlPath).href,
      videoVisitId: "fixture-video-1",
      aiDecision: "product_seed",
      aiDecisionReason: "fixture contains a product and shop link",
      targetHints: {
        likeButton: ["like video", "like"],
        commentsButton: ["comments"],
        nextVideoButton: ["next video"],
      },
    }),
  });
  const payload = await response.json();
  const packetPath = String(payload.evidencePacketPath ?? "");
  const packet = packetPath ? JSON.parse(readFileSync(packetPath, "utf8")) as {
    liked?: boolean;
    comments?: Array<{ commentText?: string }>;
    commentCountText?: string;
  } : {};

  if (
    !response.ok
    || payload.status !== "advanced_to_next_video"
    || payload.ok !== true
    || productStartCount !== 1
    || !packetPath
    || !existsSync(packetPath)
    || packet.liked !== true
    || (packet.comments?.length ?? 0) < 3
    || !String(packet.commentCountText ?? "").includes("12")
    || !page.url().includes("video-two")
  ) {
    process.stdout.write(`[PRODUCT-VIDEO-DOM-SMOKE][FAIL] unexpected payload: ${JSON.stringify(payload)} packet=${JSON.stringify(packet)}\n`);
    process.exit(1);
  }

  const statusResponse = await fetch(`http://127.0.0.1:${port}/api/plugins/product-video-dom-runtime/status/${payload.taskId}`);
  const statusPayload = await statusResponse.json();
  if (!statusResponse.ok || statusPayload.status !== "advanced_to_next_video") {
    process.stdout.write(`[PRODUCT-VIDEO-DOM-SMOKE][FAIL] status route did not return completed record: ${JSON.stringify(statusPayload)}\n`);
    process.exit(1);
  }

  process.stdout.write("[PRODUCT-VIDEO-DOM-SMOKE][PASS] API task liked product video, recorded comments, persisted packet, and advanced to next video\n");
} finally {
  server.close();
  await launched.close();
}
