import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

const localBaseUrl = "http://127.0.0.1:4173";
const externalOrigin = "https://ontheway.example.com";
const apiKey = "test-secret";

type FakeWorkbench = Partial<GrassEyeWorkbenchHandle> & {
  apiBoundaryEvents: unknown[];
  lastProductSyncInput?: unknown;
  startCalls: number;
};

const withExternalEnv = (): void => {
  process.env.GRASSEYE_EXTERNAL_API_ENABLED = "true";
  process.env.GRASSEYE_EXTERNAL_API_KEY = apiKey;
  process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS = externalOrigin;
  process.env.GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS = `${externalOrigin}/api/grasseye`;
};

const createProductSyncRecord = () => ({
  taskId: "product_sync_task_test",
  site: "ontheway-amazon-manage",
  requestId: "product-sync-request-test-1",
  marketplace: "amazon.ae" as const,
  ok: false,
  status: "running" as const,
  reason: null,
  reachedStep: "acceptance_fixture",
  items: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createFakeWorkbench = (): FakeWorkbench => ({
  apiBoundaryEvents: [],
  startCalls: 0,
  recordWorkbenchApiBoundaryEvent(event: unknown) {
    this.apiBoundaryEvents.push(event);
  },
  async startAmazonProductSyncTask(input: unknown) {
    this.startCalls += 1;
    this.lastProductSyncInput = input;
    return createProductSyncRecord();
  },
  async getAmazonProductSyncTaskStatus() {
    return null;
  },
  async getLatestAmazonProductSyncTask() {
    return null;
  },
});

const withServer = async (
  run: (input: { rootUrl: string; workbench: FakeWorkbench }) => Promise<void>,
): Promise<void> => {
  const workbench = createFakeWorkbench();
  const server = createWorkbenchServer({ workbench: workbench as GrassEyeWorkbenchHandle, baseUrl: localBaseUrl });
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

const productSyncBody = () => ({
  site: "ontheway-amazon-manage",
  requestId: "product-sync-request-test-1",
  marketplace: "amazon.ae",
  scope: "selected-skus",
  items: [{
    sourceKeyType: "sku",
    sourceKey: "DL-UG6I-2OWL",
    sellerSku: "DL-UG6I-2OWL",
    requiredFields: ["mainImage", "asin", "availableInventory", "actualInventory"],
  }],
});

const postExternalProductSyncStart = (
  rootUrl: string,
  input: { headers?: Record<string, string>; key?: string } = {},
): Promise<Response> => {
  const headers: Record<string, string> = {
    Origin: externalOrigin,
    "content-type": "application/json",
    "X-GrassEye-Source-System": "ontheway",
    "X-GrassEye-Request-Id": "product-sync-request-test-1",
    ...input.headers,
  };
  if (input.key !== undefined) {
    headers["X-GrassEye-Agent-Key"] = input.key;
  }
  return fetch(`${rootUrl}/api/plugins/amazon-product-sync/start`, {
    method: "POST",
    headers,
    body: JSON.stringify(productSyncBody()),
  });
};

const readJson = async (response: Response): Promise<Record<string, unknown>> =>
  await response.json() as Record<string, unknown>;

const assertExternalProductSyncStartAllowed = async (): Promise<void> => {
  await withServer(async ({ rootUrl, workbench }) => {
    withExternalEnv();
    const response = await postExternalProductSyncStart(rootUrl, { key: apiKey });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), externalOrigin);
    assert.equal(workbench.startCalls, 1);
    assert.deepEqual(workbench.lastProductSyncInput, productSyncBody());
  });
};

const assertExternalIdentityHeadersRequired = async (): Promise<void> => {
  for (const [header, error] of [
    ["X-GrassEye-Source-System", "missing_source_system"],
    ["X-GrassEye-Request-Id", "missing_request_id"],
  ] as const) {
    await withServer(async ({ rootUrl, workbench }) => {
      withExternalEnv();
      const response = await postExternalProductSyncStart(rootUrl, {
        key: apiKey,
        headers: { [header]: "" },
      });
      const body = await readJson(response);
      assert.equal(response.status, 403);
      assert.equal(body.error, error);
      assert.equal(workbench.startCalls, 0);
    });
  }
};

await assertExternalProductSyncStartAllowed();
await assertExternalIdentityHeadersRequired();
process.stdout.write("[ACCEPTANCE] workbench-api-boundary product-sync PASS\n");
