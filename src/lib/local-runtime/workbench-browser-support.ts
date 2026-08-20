import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AuthenticatedBrowserAuthorityLease,
  BrowserAuthorityBroker,
  BrowserExecutionBinding,
  BrowserTargetLease,
} from "../browser/browser-authority-api.js";
import {
  BrowserInfrastructureSupervisorImpl,
  createUnavailableBrowserAuthorityBroker,
} from "../browser/infrastructure/browser-infrastructure-supervisor.js";
import { resolveProductionBrowserProfileEnrollment } from "../browser/profile/browser-profile-config.js";
import { readVerifiedBrowserReleaseBinding } from "../browser/release/browser-release-binding-loader.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";

export type WorkbenchBrowserAuthority = Readonly<{
  broker: BrowserAuthorityBroker;
  acquireTargetLease(ownerId: string): Promise<BrowserTargetLease>;
  tryAcquireTargetLease(ownerId: string): Promise<BrowserTargetLease | null>;
  shutdown(): Promise<void>;
}>;

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const createLocalExecutionBinding = (): BrowserExecutionBinding => {
  const executionRef = `workbench:${randomUUID()}`;
  return Object.freeze({
    kind: "local" as const,
    executionRef,
    jobRefHash: hash(`${executionRef}:job`),
    executionRefHash: hash(executionRef),
    writerLeaseEpoch: 1,
    writerFenceHash: hash(`${executionRef}:writer`),
    candidateHash: hash(process.env.GRASSEYE_SOURCE_FINGERPRINT ?? "unknown"),
  });
};

const unavailable = (reasonCode: string): WorkbenchBrowserAuthority => {
  const broker = createUnavailableBrowserAuthorityBroker(reasonCode);
  const acquireTargetLease = async (): Promise<BrowserTargetLease> => {
    throw new Error(`BROWSER_INFRASTRUCTURE_UNAVAILABLE:${reasonCode}`);
  };
  return {
    broker,
    acquireTargetLease,
    tryAcquireTargetLease: async () => null,
    shutdown: async () => undefined,
  };
};

export async function createWorkbenchBrowserAuthority(
  _options: GrassEyeWorkbenchOptions,
  dataDir: string,
  runtimeLogger: RuntimeLogger,
): Promise<WorkbenchBrowserAuthority> {
  const publicKeyPem = process.env.GRASSEYE_BROWSER_RELEASE_PUBLIC_KEY_PEM?.trim();
  if (!publicKeyPem) return unavailable("BROWSER_RELEASE_PUBLIC_KEY_REQUIRED");
  try {
    const artifactRoot = path.join(
      process.cwd(),
      "artifacts",
      "browser-runtime",
      `${process.platform}-${process.arch}`,
    );
    const profileEnrollment = resolveProductionBrowserProfileEnrollment({
      platform: process.platform,
    });
    const release = readVerifiedBrowserReleaseBinding({ artifactRoot, publicKeyPem });
    const executionBinding = createLocalExecutionBinding();
    const supervisor = new BrowserInfrastructureSupervisorImpl({
      dataDir,
      profileEnrollment,
      release,
      ownerLockHelperPath: path.join(artifactRoot, "bin", "grasseye-browserctl"),
      approvedArtifactRoots: [dataDir],
      fenceValidator: {
        assertCurrent: (candidate) => {
          if (candidate.executionRefHash !== executionBinding.executionRefHash
            || candidate.writerFenceHash !== executionBinding.writerFenceHash) {
            throw new Error("BROWSER_WORKER_FENCE_STALE:local workbench execution fence changed");
          }
        },
      },
      runtimeLogger,
    });
    const broker = await supervisor.bootstrap();
    let authorityLease: AuthenticatedBrowserAuthorityLease | null = null;
    const acquireTargetLease = async (ownerId: string): Promise<BrowserTargetLease> => {
      authorityLease ??= await broker.acquireForExecution(executionBinding);
      return authorityLease.acquireTargetLease(ownerId);
    };
    return {
      broker,
      acquireTargetLease,
      tryAcquireTargetLease: async (ownerId) => {
        try {
          return await acquireTargetLease(ownerId);
        } catch {
          return null;
        }
      },
      shutdown: async () => {
        await authorityLease?.release().catch(() => undefined);
        await supervisor.stop();
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return unavailable(reason.split(":", 1)[0] || "BROWSER_INFRASTRUCTURE_UNAVAILABLE");
  }
}
