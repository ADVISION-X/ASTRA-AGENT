import { strict as assert } from "node:assert";

import {
  externalOrigin,
  localBaseUrl,
  readJson,
  withServer,
} from "./workbench-api-boundary-fixture.js";

const assertLocalShellRoutes = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    for (const route of ["/api/health", "/api/mode", "/api/browser-authority/pairing"]) {
      const response = await fetch(`${rootUrl}${route}`, {
        headers: { Origin: localBaseUrl },
      });
      assert.equal(response.status, 200, `${route} must remain local-only and available`);
      assert.equal(response.headers.get("access-control-allow-origin"), localBaseUrl);
    }
  });
};

const assertXuanxueLocalIntervention = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    const response = await fetch(`${rootUrl}/api/xuanxue-ai-production/pause`, {
      method: "POST",
      headers: {
        Origin: localBaseUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orderId: "order_acceptance",
        expectedRevision: 0,
        reason: "acceptance",
        requestId: "request_acceptance",
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(workbench.interventionCalls, ["pause"]);
  });
};

const assertXuanxueExternalIngressBlocked = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    const response = await fetch(`${rootUrl}/api/xuanxue-ai-production/pause`, {
      method: "POST",
      headers: {
        Origin: externalOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ orderId: "order_acceptance" }),
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "external_api_disabled");
    assert.deepEqual(workbench.interventionCalls, []);
  });
};

const assertRetiredRoutesAbsent = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    const retiredRoutes = [
      ["POST", "/api/plugins/amazon-invoice-upload/start"],
      ["POST", "/api/amazon-product-mining/mission"],
      ["GET", "/api/media-processing/presets"],
      ["POST", "/api/video-download/start"],
    ] as const;
    for (const [method, route] of retiredRoutes) {
      const response = await fetch(`${rootUrl}${route}`, {
        method,
        headers: { Origin: localBaseUrl },
      });
      assert.equal(response.status, 404, `${route} must be physically absent`);
    }
  });
};

await assertLocalShellRoutes();
await assertXuanxueLocalIntervention();
await assertXuanxueExternalIngressBlocked();
await assertRetiredRoutesAbsent();
process.stdout.write("[ACCEPTANCE] workbench-api-boundary PASS\n");
