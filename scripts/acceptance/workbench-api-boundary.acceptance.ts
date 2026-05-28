import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import type { AmazonInvoiceUploadTaskRecord } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.types.js";
import type { AmazonInvoiceUploadTaskStartInput } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.types.js";
import type { AmazonInvoiceUploadMissionInput } from "../../src/plugins/amazon-invoice-upload/mission.schema.js";

const localBaseUrl = "http://127.0.0.1:4173";
const externalOrigin = "https://ontheway.example.com";
const apiKey = "test-secret";

type FakeWorkbench = GrassEyeWorkbenchHandle & {
  apiBoundaryEvents: unknown[];
  startCalls: number;
};

const createInvoiceMission = (): AmazonInvoiceUploadMissionInput => ({
  missionType: "amazon_invoice_upload",
  marketplace: "AE",
  amazonOrderId: "000-0000000-0000000",
  invoiceNo: "INV-TEST-1",
  invoicePdfPath: "/tmp/invoice.pdf",
  sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000",
  adminOrderUrl: `${externalOrigin}/admin/orders/123`,
  requireHumanFinalSubmit: true,
});

const createInvoiceRecord = (input: { mission?: AmazonInvoiceUploadMissionInput; taskId?: string } = {}): AmazonInvoiceUploadTaskRecord => {
  const mission = input.mission ?? createInvoiceMission();
  return {
    taskId: input.taskId ?? "task_test",
    mission,
    ok: false,
    status: "review_required",
    reason: "acceptance_fixture_review_required",
    reachedStep: "acceptance_fixture",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const createFakeWorkbench = (): FakeWorkbench => {
  const fake: Partial<GrassEyeWorkbenchHandle> & Pick<FakeWorkbench, "apiBoundaryEvents" | "startCalls"> = {
    apiBoundaryEvents: [] as unknown[],
    startCalls: 0,
    recordWorkbenchApiBoundaryEvent(event: unknown) {
      fake.apiBoundaryEvents.push(event);
    },
    async getHealthReport() {
      return {
        status: "healthy" as const,
        components: [],
        checkedAt: new Date().toISOString(),
        sourceFingerprint: "acceptance",
      };
    },
    async startAmazonInvoiceUploadTask(input: AmazonInvoiceUploadTaskStartInput) {
      fake.startCalls += 1;
      return createInvoiceRecord({ mission: input.mission });
    },
    async getAmazonInvoiceUploadTaskStatus(taskId: string) {
      return createInvoiceRecord({ taskId });
    },
    async getLatestAmazonInvoiceUploadTaskForInvoice() {
      return createInvoiceRecord({ taskId: "task_latest" });
    },
  };
  return fake as FakeWorkbench;
};

const withExternalEnv = (enabled: boolean): void => {
  process.env.GRASSEYE_EXTERNAL_API_ENABLED = enabled ? "true" : "false";
  process.env.GRASSEYE_EXTERNAL_API_KEY = apiKey;
  process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS = externalOrigin;
  process.env.GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS = `${externalOrigin}/api/grasseye`;
};

const withServer = async (
  run: (input: { rootUrl: string; workbench: FakeWorkbench }) => Promise<void>,
): Promise<void> => {
  const workbench = createFakeWorkbench();
  const server = createWorkbenchServer({ workbench, baseUrl: localBaseUrl });
  await new Promise<void>((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });
  const address = server.address() as AddressInfo;
  try {
    await run({ rootUrl: `http://127.0.0.1:${address.port}`, workbench });
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => error ? rejectPromise(error) : resolvePromise());
    });
  }
};

const buildInvoiceForm = (missionPatch: Record<string, unknown> = {}): FormData => {
  const form = new FormData();
  form.set("mission", JSON.stringify({
    sourceSystem: "ontheway",
    requestId: "ontheway-invoice-test-1",
    missionType: "amazon_invoice_upload",
    marketplace: "AE",
    amazonOrderId: "000-0000000-0000000",
    invoiceNo: "INV-TEST-1",
    sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000",
    adminOrderUrl: `${externalOrigin}/admin/orders/123`,
    requireHumanFinalSubmit: true,
    ...missionPatch,
  }));
  form.set("invoicePdf", new Blob(["%PDF-1.4\n"], { type: "application/pdf" }), "invoice.pdf");
  return form;
};

const postExternalStart = (
  rootUrl: string,
  input: {
    key?: string;
    missionPatch?: Record<string, unknown>;
    origin?: string;
  } = {},
): Promise<Response> => {
  const headers: Record<string, string> = {
    Origin: input.origin ?? externalOrigin,
    "X-GrassEye-Source-System": "ontheway",
    "X-GrassEye-Request-Id": "request-test-1",
  };
  if (input.key !== undefined) {
    headers["X-GrassEye-Agent-Key"] = input.key;
  }
  return fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/start`, {
    method: "POST",
    headers,
    body: buildInvoiceForm(input.missionPatch),
  });
};

const readJson = async (response: Response): Promise<Record<string, unknown>> =>
  await response.json() as Record<string, unknown>;

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
    const response = await postExternalStart(rootUrl, { key: apiKey });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), externalOrigin);
    assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(workbench.startCalls, 1);
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
  for (const key of ["selector", "actionPlan", "abilityGroupId", "browserProfileDirectory"]) {
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

const run = async (): Promise<void> => {
  await assertLocalHealthAllowed();
  await assertExternalAuthBoundaries();
  await assertExternalRouteBoundary();
  await assertForbiddenMissionKeys();
  await assertExternalCallbackAndOriginBoundaries();
};

await run();
process.stdout.write("[ACCEPTANCE] workbench-api-boundary PASS\n");
