import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFileSync } from "node:fs";

import {
  GRASSEYE_BROWSER_EXTENSION_ORIGIN,
  GRASSEYE_TOOL_EXTENSION_ID_HEADER,
} from "../../src/app/workbench-api-boundary.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

import {
  externalOrigin,
  localBaseUrl,
  readJson,
  withServer,
} from "./workbench-api-boundary-fixture.js";

const assertLocalShellRoutes = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    for (const route of ["/api/health"]) {
      const response = await fetch(`${rootUrl}${route}`, {
        headers: { Origin: localBaseUrl },
      });
      assert.equal(response.status, 200, `${route} must remain local-only and available`);
      assert.equal(response.headers.get("access-control-allow-origin"), localBaseUrl);
    }
  });
};

const assertProductionObservationBoundary = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    const response = await fetch(`${rootUrl}/api/production-runtime/operations-snapshot`, {
      headers: { Origin: localBaseUrl },
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.schema_version, "agent-production-operations-snapshot.v1");
  });
  await withServer(async ({ rootUrl }) => {
    const response = await fetch(`${rootUrl}/api/production-runtime/operations-snapshot`, {
      headers: { Origin: externalOrigin },
    });
    assert.equal(response.status, 403);
  });
};

const assertFixedExtensionPairingBoundary = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    const response = await fetch(`${rootUrl}/api/browser-authority/pairing`, {
      headers: { [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: GRASSEYE_UNPACKED_EXTENSION_ID },
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.authority, "absent");
    assert.match(String(body.pairingSecret), /^[a-f0-9]{64}$/u);
    assert.match(String(body.releaseBuildId), /^build-[a-f0-9-]{36}$/u);
    assert.equal(response.headers.get("access-control-allow-origin"), GRASSEYE_BROWSER_EXTENSION_ORIGIN);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });

  for (const origin of [localBaseUrl, "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "https://example.com", "null", "file://"]) {
    await withServer(async ({ rootUrl }) => {
      const response = await fetch(`${rootUrl}/api/browser-authority/pairing`, {
        headers: { Origin: origin, [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: GRASSEYE_UNPACKED_EXTENSION_ID },
      });
      assert.equal(response.status, 403, `pairing route must reject ${origin}`);
      assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
    });
  }
  for (const headers of [
    {},
    { [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { Origin: GRASSEYE_BROWSER_EXTENSION_ORIGIN },
  ]) {
    await withServer(async ({ rootUrl }) => {
      const response = await fetch(`${rootUrl}/api/browser-authority/pairing`, { headers });
      assert.equal(response.status, 403);
    });
  }
  await withServer(async ({ rootUrl }) => {
    const response = await fetch(`${rootUrl}/api/health`, {
      headers: {
        Origin: GRASSEYE_BROWSER_EXTENSION_ORIGIN,
        [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: GRASSEYE_UNPACKED_EXTENSION_ID,
      },
    });
    assert.equal(response.status, 403, "the fixed extension may not use any other Workbench API");
  });
};

const assertXuanxueLocalInterventionRetired = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
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
    assert.equal(response.status, 404);
  });
};

const assertXuanxueExternalIngressBlocked = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    const response = await fetch(`${rootUrl}/api/xuanxue-ai-production/pause`, {
      method: "POST",
      headers: {
        Origin: externalOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ orderId: "order_acceptance" }),
    });
    const body = await readJson(response);
    assert.equal(response.status, 404);
    assert.equal(body.error, "api_route_not_allowed");
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
await assertProductionObservationBoundary();
await assertFixedExtensionPairingBoundary();
await assertXuanxueLocalInterventionRetired();
await assertXuanxueExternalIngressBlocked();
await assertRetiredRoutesAbsent();
const activeLaw = readFileSync(resolveFromRepo(".github/instructions/agent-rules/功能法案.md"), "utf8");
assert.match(activeLaw, /TOMBSTONE-WORKBENCH-EXTERNAL-INGRESS-001/u);
assert.match(activeLaw, /不存在 external website business ingress/u);
assert.match(activeLaw, /解冻 TOMBSTONE-WORKBENCH-EXTERNAL-INGRESS-001/u);
emitQualityProofObservation({
  lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V7", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"],
  locator: "acceptance:workbench-api-boundary:no-external-ingress",
  observedValue: "all Workbench routes are local-only, external origins cannot reach a business ingress, and the external-ingress tombstone remained exact",
});
process.stdout.write("[ACCEPTANCE] workbench-api-boundary PASS\n");
