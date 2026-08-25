import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";

import {
  handleWorkbenchApiBoundary,
  WORKBENCH_API_ROUTE_RULES,
  type WorkbenchApiRouteRule,
} from "../../src/app/workbench-api-boundary.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

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

const assertPerSiteHmacBoundary = (): void => {
  const rule: WorkbenchApiRouteRule = {
    method: "POST",
    pathPattern: "exact",
    path: "/api/authorized-external-fixture",
    localUiAllowed: false,
    externalApiAllowed: true,
    requiresSiteHmac: true,
    purpose: "acceptance_external_fixture",
  };
  const sourceSystem = "website-alpha";
  const requestId = "request-001";
  const secret = "site-alpha-secret-material-32-bytes-minimum";
  const signature = createHmac("sha256", secret)
    .update([sourceSystem, requestId, rule.method, rule.path].join("\n"))
    .digest("hex");
  const previous = {
    enabled: process.env.GRASSEYE_EXTERNAL_API_ENABLED,
    origins: process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS,
    secrets: process.env.GRASSEYE_EXTERNAL_SITE_HMAC_SECRETS,
  };
  process.env.GRASSEYE_EXTERNAL_API_ENABLED = "true";
  process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS = externalOrigin;
  process.env.GRASSEYE_EXTERNAL_SITE_HMAC_SECRETS = JSON.stringify({ [sourceSystem]: secret });
  WORKBENCH_API_ROUTE_RULES.push(rule);
  try {
    const decide = (headers: Record<string, string>) => handleWorkbenchApiBoundary({
      method: rule.method,
      path: rule.path,
      origin: externalOrigin,
      headers,
      baseUrl: localBaseUrl,
    });
    assert.equal(decide({
      "x-grasseye-source-system": sourceSystem,
      "x-grasseye-request-id": requestId,
      "x-grasseye-signature": signature,
    }).kind, "allowed");
    for (const headers of [
      { "x-grasseye-source-system": sourceSystem, "x-grasseye-request-id": requestId },
      { "x-grasseye-source-system": "website-beta", "x-grasseye-request-id": requestId, "x-grasseye-signature": signature },
      { "x-grasseye-source-system": sourceSystem, "x-grasseye-request-id": requestId, "x-grasseye-signature": "0".repeat(64) },
    ]) {
      const decision = decide(headers);
      assert.equal(decision.kind, "blocked");
    }
  } finally {
    WORKBENCH_API_ROUTE_RULES.pop();
    for (const [key, value] of Object.entries({
      GRASSEYE_EXTERNAL_API_ENABLED: previous.enabled,
      GRASSEYE_EXTERNAL_ALLOWED_ORIGINS: previous.origins,
      GRASSEYE_EXTERNAL_SITE_HMAC_SECRETS: previous.secrets,
    })) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
};

await assertLocalShellRoutes();
await assertXuanxueLocalIntervention();
await assertXuanxueExternalIngressBlocked();
await assertRetiredRoutesAbsent();
assertPerSiteHmacBoundary();
emitQualityProofObservation({
  lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V4",
  evidenceMode: "exam.golden",
  locator: "acceptance:workbench-api-boundary:per-site-hmac",
  observedValue: "known external route accepts only its source-bound HMAC and rejects missing foreign or invalid signatures",
});
process.stdout.write("[ACCEPTANCE] workbench-api-boundary PASS\n");
