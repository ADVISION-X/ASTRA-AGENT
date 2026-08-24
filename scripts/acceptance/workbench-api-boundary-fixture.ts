import type { AddressInfo } from "node:net";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

export const localBaseUrl = "http://127.0.0.1:4173";
export const externalOrigin = "https://external.example.com";

export type FakeWorkbench = GrassEyeWorkbenchHandle & {
  apiBoundaryEvents: unknown[];
  interventionCalls: string[];
};

const interventionRecord = (action: string) => ({
  orderId: "order_acceptance",
  revision: 1,
  state: action === "cancel" ? "cancelled" as const : "pause_requested" as const,
  reason: "acceptance",
  requestId: "request_acceptance",
  pendingRequest: action === "cancel" ? "cancel" as const : "pause" as const,
  lastControlEpoch: 0,
  lastSafeCheckpoint: null,
  requestedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createFakeWorkbench = (): FakeWorkbench => {
  const apiBoundaryEvents: unknown[] = [];
  const interventionCalls: string[] = [];
  const fake: Partial<GrassEyeWorkbenchHandle> = {
    recordWorkbenchApiBoundaryEvent(event) {
      apiBoundaryEvents.push(event);
    },
    async getHealthReport() {
      return {
        status: "healthy",
        components: [],
        checkedAt: new Date().toISOString(),
        sourceFingerprint: "acceptance",
      };
    },
    getModeInfo() {
      return { platformTarget: "agent-shell" };
    },
    readBrowserAuthorityPairingState() {
      return { authority: "absent", pairingSecret: null };
    },
    readXuanxueAiProductionQuarantine() {
      return null;
    },
    readXuanxueAiProductionStatus() {
      return null;
    },
    pauseXuanxueAiProduction() {
      interventionCalls.push("pause");
      return interventionRecord("pause");
    },
    cancelXuanxueAiProduction() {
      interventionCalls.push("cancel");
      return interventionRecord("cancel");
    },
    takeoverXuanxueAiProduction() {
      interventionCalls.push("takeover");
      return interventionRecord("takeover");
    },
    resumeXuanxueAiProduction() {
      interventionCalls.push("resume");
      return interventionRecord("resume");
    },
  };
  return Object.assign(fake, { apiBoundaryEvents, interventionCalls }) as FakeWorkbench;
};

export const withServer = async (
  run: (input: { rootUrl: string; workbench: FakeWorkbench }) => Promise<void>,
): Promise<void> => {
  const workbench = createFakeWorkbench();
  const server = createWorkbenchServer({ workbench, baseUrl: localBaseUrl });
  await new Promise<void>((resolvePromise) => {
    server.listen(0, "127.0.0.1", resolvePromise);
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

export const readJson = async (response: Response): Promise<Record<string, unknown>> =>
  await response.json() as Record<string, unknown>;
