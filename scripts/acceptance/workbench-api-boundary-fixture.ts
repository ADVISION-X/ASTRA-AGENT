import type { AddressInfo } from "node:net";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

export const localBaseUrl = "http://127.0.0.1:4173";
export const externalOrigin = "https://external.example.com";

export type FakeWorkbench = GrassEyeWorkbenchHandle & {
  apiBoundaryEvents: unknown[];
};

const createFakeWorkbench = (): FakeWorkbench => {
  const apiBoundaryEvents: unknown[] = [];
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
    readBrowserExtensionBootstrapState() {
      return {
        authority: "absent",
        pairingSecret: "a".repeat(64),
        releaseBuildId: "build-00000000-0000-4000-8000-000000000000",
      };
    },
    async readProductionOperationsSnapshot() {
      return {
        schema_version: "agent-production-operations-snapshot.v1",
        observed_at: new Date().toISOString(),
        scope: { status: "NO_ACTIVE_SCOPE", selected_job_id: null, candidates: [] },
        rows: [], diagnosis: null,
      };
    },
  };
  return Object.assign(fake, { apiBoundaryEvents }) as FakeWorkbench;
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
