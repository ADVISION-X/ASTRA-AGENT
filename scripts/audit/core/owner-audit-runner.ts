import { execFile } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

import { buildAuditArtifacts } from "../build-audit-artifacts.js";
import { fileExists } from "./filesystem.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { hasBlockingFindings } from "./result.js";
import type { GeneratedArtifacts } from "./schema-generated-artifacts.js";
import type { InspectorResult } from "./schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, runWithStandaloneHeartbeat } from "./runtime.js";

type OwnerRunnerInput = {
  capabilityDomain: string;
  inspectorEntry: string;
  negativeProofScript?: string;
  skipNegativeProofEnv?: string;
};

type ResourceSnapshot = {
  rssMB: number;
  heapUsedMB: number;
  durationMs: number;
};

type OwnerAuditRunResult = {
  artifacts: GeneratedArtifacts;
  result: InspectorResult;
};

const execFileAsync = promisify(execFile);
const BUILD_ARTIFACTS_ENV = "GRASSEYE_OWNER_BUILD_ARTIFACTS";
const MAX_RSS_ENV = "GRASSEYE_OWNER_AUDIT_MAX_RSS_MB";
const DEFAULT_MAX_RSS_MB = 6_000;
const RESOURCE_SAMPLE_INTERVAL_MS = 1_000;

const readPositiveIntegerEnv = (name: string): number | undefined => {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
};

const getMaxRssMB = (): number => readPositiveIntegerEnv(MAX_RSS_ENV) ?? DEFAULT_MAX_RSS_MB;

const captureResourceSnapshot = async (startedAtMs: number): Promise<ResourceSnapshot> => {
  const [rssMB, usage] = await Promise.all([
    readProcessTreeRssMB(process.pid),
    Promise.resolve(process.memoryUsage()),
  ]);
  return {
    rssMB: Math.round(rssMB * 10) / 10,
    heapUsedMB: Math.round((usage.heapUsed / 1024 / 1024) * 10) / 10,
    durationMs: Date.now() - startedAtMs,
  };
};

const formatSnapshot = (snapshot: ResourceSnapshot): string =>
  `rssMB=${snapshot.rssMB} heapUsedMB=${snapshot.heapUsedMB} durationMs=${snapshot.durationMs}`;

const logResourceSnapshot = async (owner: string, label: string, startedAtMs: number): Promise<void> => {
  process.stdout.write(`[OWNER AUDIT] ${owner} ${label} ${formatSnapshot(await captureResourceSnapshot(startedAtMs))}\n`);
};

const startResourceGuard = (owner: string, startedAtMs: number): () => void => {
  const maxRssMB = getMaxRssMB();
  let sampleInFlight = false;
  const handle = setInterval(() => {
    if (sampleInFlight) {
      return;
    }

    sampleInFlight = true;
    void captureResourceSnapshot(startedAtMs)
      .then((snapshot) => {
        if (snapshot.rssMB > maxRssMB) {
          process.stderr.write(`AUDIT_RESOURCE_LIMIT_EXCEEDED owner=${owner} ${formatSnapshot(snapshot)} maxRssMB=${maxRssMB}\n`);
          process.exit(1);
        }
      })
      .finally(() => {
        sampleInFlight = false;
      });
  }, RESOURCE_SAMPLE_INTERVAL_MS);
  return () => clearInterval(handle);
};

const assertGeneratedArtifactsExist = async (): Promise<void> => {
  const required = [
    generatedArtifactPaths.lawRegistry,
    generatedArtifactPaths.enforcementMatrixJson,
    generatedArtifactPaths.auditPlan,
    generatedArtifactPaths.auditConflicts,
  ];
  for (const artifactPath of required) {
    if (!(await fileExists(artifactPath))) {
      throw new Error("Owner audit requires generated artifacts. Run `npm run audit:build` first, or set GRASSEYE_OWNER_BUILD_ARTIFACTS=1 for an explicit standalone rebuild.");
    }
  }
};

const maybeBuildArtifacts = async (): Promise<void> => {
  if (process.env[BUILD_ARTIFACTS_ENV] !== "1") {
    await assertGeneratedArtifactsExist();
    return;
  }
  process.stdout.write("[OWNER AUDIT] GRASSEYE_OWNER_BUILD_ARTIFACTS=1 set; building audit artifacts explicitly.\n");
  await runWithStandaloneHeartbeat("build-audit-artifacts", buildAuditArtifacts());
};

const runNegativeProofProcess = async (input: OwnerRunnerInput, startedAtMs: number): Promise<void> => {
  if (process.env.GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF !== "1" || !input.negativeProofScript) {
    return;
  }
  const script = input.negativeProofScript;
  await logResourceSnapshot(input.capabilityDomain, "negative-proof:start", startedAtMs);
  await new Promise<void>((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF: "1" };
    const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", script], { stdio: "inherit", env });
    const finish = (error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(new Error(`${input.capabilityDomain} negative proof failed${signal ? ` by ${signal}` : ""} with exit code ${code ?? 1}.`));
    });
  });
  await logResourceSnapshot(input.capabilityDomain, "negative-proof:done", startedAtMs);
};

export const runOwnerInspector = async (input: OwnerRunnerInput): Promise<OwnerAuditRunResult> => {
  const startedAtMs = Date.now();
  const stopGuard = startResourceGuard(input.capabilityDomain, startedAtMs);
  let artifacts: GeneratedArtifacts | undefined;
  let result: InspectorResult | undefined;
  try {
    await maybeBuildArtifacts();
    await logResourceSnapshot(input.capabilityDomain, "inspector:start", startedAtMs);
    artifacts = await loadGeneratedArtifacts();
    const context = await createInspectorContext(artifacts);
    const inspector = await loadInspector(input.inspectorEntry);
    const previousSkip = input.skipNegativeProofEnv ? process.env[input.skipNegativeProofEnv] : undefined;
    try {
      if (input.skipNegativeProofEnv) {
        process.env[input.skipNegativeProofEnv] = "1";
      }
      result = await runWithStandaloneHeartbeat(input.capabilityDomain, inspector(context));
    } finally {
      if (input.skipNegativeProofEnv && previousSkip === undefined) {
        delete process.env[input.skipNegativeProofEnv];
      } else if (input.skipNegativeProofEnv && previousSkip !== undefined) {
        process.env[input.skipNegativeProofEnv] = previousSkip;
      }
    }

    await logResourceSnapshot(input.capabilityDomain, "inspector:done", startedAtMs);
    process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
    for (const finding of result.findings) {
      process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
    }
    await runNegativeProofProcess(input, startedAtMs);
    await logResourceSnapshot(input.capabilityDomain, "done", startedAtMs);

    if (!result.passed || hasBlockingFindings(result.findings)) {
      process.exitCode = 1;
    }

    if (!artifacts || !result) {
      throw new Error(`Owner audit runner for ${input.capabilityDomain} did not produce artifacts or result.`);
    }

    return { artifacts, result };
  } finally {
    stopGuard();
  }
};

export const readProcessTreeRssMB = async (rootPid: number): Promise<number> => {
  const descendants = new Set<number>([rootPid]);
  let frontier = [rootPid];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const pid of frontier) {
      const { stdout } = await execFileAsync("pgrep", ["-P", String(pid)]).catch(() => ({ stdout: "" }));
      for (const child of stdout.split("\n").map((line) => Number(line.trim())).filter(Number.isInteger)) {
        if (!descendants.has(child)) {
          descendants.add(child);
          next.push(child);
        }
      }
    }
    frontier = next;
  }
  const rssValues = await Promise.all([...descendants].map(async (pid) => {
    const { stdout } = await execFileAsync("ps", ["-o", "rss=", "-p", String(pid)]).catch(() => ({ stdout: "" }));
    const rssKb = Number(stdout.trim());
    return Number.isFinite(rssKb) ? rssKb / 1024 : 0;
  }));
  return Math.round(rssValues.reduce((sum, value) => sum + value, 0) * 10) / 10;
};
