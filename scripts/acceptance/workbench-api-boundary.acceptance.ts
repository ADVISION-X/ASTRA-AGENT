import { strict as assert } from "node:assert";

import {
  apiKey,
  externalOrigin,
  localBaseUrl,
  postExternalDownloadStart,
  postExternalStart,
  readJson,
  withExternalEnv,
  withServer,
} from "./workbench-api-boundary-fixture.js";

const assertLocalHealthAllowed = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    const response = await fetch(`${rootUrl}/api/health`, {
      headers: { Origin: localBaseUrl },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), localBaseUrl);
  });
};

const assertExternalDisabledBoundary = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(false);
    const response = await postExternalStart(rootUrl, { key: apiKey });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "external_api_disabled");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertMissingApiKeyBoundary = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalStart(rootUrl);
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "missing_api_key");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertInvalidApiKeyBoundary = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalStart(rootUrl, { key: "wrong-secret" });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "invalid_api_key");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertExternalStartAllowed = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalStart(rootUrl, { key: apiKey, missionPatch: { requireHumanFinalSubmit: true, stopOnManualRequired: true } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), externalOrigin);
    assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(workbench.startCalls, 1);
    assert.equal(workbench.lastUploadMission?.invoicePdfPath, "approved-by-workbench");
    for (const key of ["requireHumanFinalSubmit", "stopOnManualRequired", "sourceSystem", "requestId"]) assert.equal(key in (workbench.lastUploadMission ?? {}), false);
  });
};

const assertExternalDownloadStartAllowed = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalDownloadStart(rootUrl, { key: apiKey });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), externalOrigin);
    assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(workbench.startCalls, 1);
  });
};

const assertExternalUploadLedgerAllowed = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/ledger`, {
      headers: {
        Origin: externalOrigin,
        "X-GrassEye-Agent-Key": apiKey,
        "X-GrassEye-Source-System": "ontheway",
        "X-GrassEye-Request-Id": "ledger-request-test-1",
      },
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), externalOrigin);
    assert.equal(Array.isArray(body.records), true);
    assert.equal(workbench.startCalls, 0);
  });
};

const assertObsoleteBatchRoutesUnavailable = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    for (const path of [
      "/api/plugins/amazon-invoice-upload/batch/start",
      "/api/plugins/amazon-invoice-upload/batch/status/batch_acceptance",
      "/api/plugins/amazon-invoice-upload/batch/latest",
      "/api/plugins/amazon-invoice-upload/batch/history",
    ]) {
      const response = await fetch(`${rootUrl}${path}`, { method: path.endsWith("/start") ? "POST" : "GET", headers: { Origin: localBaseUrl } });
      assert.notEqual(response.status, 200, `${path} must not remain an active backend batch route.`);
    }
    assert.equal(workbench.startCalls, 0);
  });
};

const assertExternalBatchRoutesBlocked = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/batch/start`, {
      method: "POST",
      headers: {
        Origin: externalOrigin,
        "X-GrassEye-Agent-Key": apiKey,
      },
    });
    assert([403, 404].includes(response.status), "obsolete external batch route must be blocked or absent");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertExternalDownloadCallbackAllowed = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalDownloadStart(rootUrl, {
      key: apiKey,
      missionPatch: { callbackUrl: `${externalOrigin}/api/grasseye/download-callback` },
    });
    assert.equal(response.status, 200);
    assert.equal(workbench.startCalls, 1);
  });
};

const assertExternalDownloadCallbackBlocked = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalDownloadStart(rootUrl, {
      key: apiKey,
      missionPatch: { callbackUrl: "https://evil.example/callback" },
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "callback_url_not_allowed");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertNestedJsonCallbackBlocked = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/download/start`, {
      method: "POST",
      headers: {
        Origin: externalOrigin,
        "content-type": "application/json",
        "X-GrassEye-Agent-Key": apiKey,
        "X-GrassEye-Source-System": "ontheway",
        "X-GrassEye-Request-Id": "nested-callback-request-test-1",
      },
      body: JSON.stringify({ mission: { callbackUrl: "https://evil.example/callback" } }),
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "callback_url_not_allowed");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertDownloadArtifactUnknownRejected = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    withExternalEnv(true);
    const response = await fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/download/artifact/unknown-task`, {
      headers: {
        Origin: externalOrigin,
        "X-GrassEye-Agent-Key": apiKey,
        "X-GrassEye-Source-System": "ontheway",
        "X-GrassEye-Request-Id": "artifact-request-test-1",
      },
    });
    const body = await readJson(response);
    assert.equal(response.status, 404);
    assert.equal(body.error, "download_artifact_not_found");
  });
};

const assertExternalAuthBoundaries = async (): Promise<void> => {
  await assertExternalDisabledBoundary();
  await assertMissingApiKeyBoundary();
  await assertInvalidApiKeyBoundary();
  await assertExternalStartAllowed();
};

const assertExternalRouteBoundary = async (): Promise<void> => {
  await withServer(async ({ rootUrl }) => {
    withExternalEnv(true);
    const response = await fetch(`${rootUrl}/api/health`, {
      headers: {
        Origin: externalOrigin,
        "X-GrassEye-Agent-Key": apiKey,
      },
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "route_not_external_allowed");
  });
};

const assertForbiddenMissionKeys = async (): Promise<void> => {
  for (const key of ["selector", "actionPlan", "abilityGroupId", "browserProfileDirectory", "documentId", "downloadUrl"]) {
    await withServer(async ({ rootUrl, workbench }) => {
      withExternalEnv(true);
      const response = await postExternalStart(rootUrl, {
        key: apiKey,
        missionPatch: { [key]: key === "actionPlan" ? [] : "blocked" },
      });
      const body = await readJson(response);
      assert.equal(response.status, 403);
      assert.equal(body.error, "forbidden_external_request_key");
      assert.equal(body.reason, key);
      assert.equal(workbench.startCalls, 0);
    });
  }
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalDownloadStart(rootUrl, {
      key: apiKey,
      missionPatch: { documentId: "blocked-document-id" },
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "forbidden_external_request_key");
    assert.equal(body.reason, "documentId");
    assert.equal(workbench.startCalls, 0);
  });
};

const assertExternalCallbackAndOriginBoundaries = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv(true);
    const response = await postExternalStart(rootUrl, {
      key: apiKey,
      missionPatch: { callbackUrl: "https://example.invalid/callback" },
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "callback_url_not_allowed");
    assert.equal(workbench.startCalls, 0);
  });

  await withServer(async ({ rootUrl }) => {
    withExternalEnv(true);
    const response = await postExternalStart(rootUrl, {
      key: apiKey,
      origin: "https://not-allowed.example.com",
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "origin_not_allowed");
    assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
  });
};

const runCoreBoundaryAssertions = async (): Promise<void> => {
  await assertLocalHealthAllowed();
  await assertExternalAuthBoundaries();
  await assertExternalDownloadStartAllowed();
  await assertExternalUploadLedgerAllowed();
  await assertObsoleteBatchRoutesUnavailable();
  await assertExternalDownloadCallbackAllowed();
  await assertExternalDownloadCallbackBlocked();
};

const runSafetyBoundaryAssertions = async (): Promise<void> => {
  await assertNestedJsonCallbackBlocked();
  await assertDownloadArtifactUnknownRejected();
  await assertExternalRouteBoundary();
  await assertForbiddenMissionKeys();
  await assertExternalCallbackAndOriginBoundaries();
  await assertExternalBatchRoutesBlocked();
};

await runCoreBoundaryAssertions(); await runSafetyBoundaryAssertions();
process.stdout.write("[ACCEPTANCE] workbench-api-boundary PASS\n");
