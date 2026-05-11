import type { ParsedOpenRequest, OpenTargetProfile } from "../contract.js";
import type { OpenLocalProgramLaunchResult, OpenLocalProgramSnapshot } from "../ports/open-local-program-port.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { runWithTimeout } from "./navigation-runner-support.js";
import { deriveLocalProgramFailureCode, type LocalProgramFailureCode } from "./local-program-failure.js";

type LocalProgramProfile = Extract<OpenTargetProfile, { targetKind: "local-program" }>;

const buildLaunchInput = (input: {
  context: OpenChildExecutionContext;
  request: ParsedOpenRequest;
  profile: LocalProgramProfile;
  idempotencyKey: string;
  timeoutMs: number;
  abortSignal: AbortSignal;
}) => ({
  openAttemptRef: `${input.idempotencyKey}:local-program-open-attempt`,
  missionId: input.request.missionId,
  runId: input.request.runId,
  sessionId: input.request.sessionId,
  roundId: input.request.roundId,
  videoVisitId: input.request.videoVisitId,
  childCapabilityId: "open-local-program" as const,
  platformId: "macos-local" as const,
  targetKind: "local-program" as const,
  targetProfileRef: input.profile.targetProfileRef,
  appName: input.profile.appName,
  bundleId: input.profile.bundleId,
  appPath: input.profile.appPath,
  allowedLaunchMethod: input.profile.allowedLaunchMethod,
  timeoutMs: input.timeoutMs,
  abortSignal: input.abortSignal,
  idempotencyKey: input.idempotencyKey,
  sourceRef: input.request.sourceRef,
});

export async function runLocalProgramLaunch(input: {
  context: OpenChildExecutionContext;
  request: ParsedOpenRequest;
  profile: LocalProgramProfile;
  idempotencyKey: string;
  timeoutMs: number;
}) {
  if (!input.context.localProgram) {
    return {
      launchResult: null,
      timedOut: false,
      reason: "LOCAL_PROGRAM_PORT_NOT_CONFIGURED: OpenLocalProgramPort is not configured",
      failureCode: "LOCAL_PROGRAM_PORT_NOT_CONFIGURED",
    };
  }

  const abortController = new AbortController();
  const launchResult = await runWithTimeout({
    operation: input.context.localProgram.openLocalProgram(buildLaunchInput({ ...input, abortSignal: abortController.signal })),
    abortController,
    timeoutMs: input.timeoutMs,
  }).catch((error: unknown): OpenLocalProgramLaunchResult | null => {
    if (error instanceof Error) return null;
    return null;
  });

  return launchResult
    ? { launchResult, timedOut: false, reason: launchResult.ok ? null : launchResult.message, failureCode: launchResult.ok ? null : deriveLocalProgramFailureCode(launchResult.message) }
    : { launchResult: null, timedOut: true, reason: "LOCAL_PROGRAM_LAUNCH_FAILED: local program open timed out", failureCode: "LOCAL_PROGRAM_LAUNCH_FAILED" };
}

export async function readLocalProgramSnapshot(input: {
  context: OpenChildExecutionContext;
  profile: LocalProgramProfile;
  launchResult: OpenLocalProgramLaunchResult | null;
}): Promise<OpenLocalProgramSnapshot | null> {
  if (!input.context.localProgram || !input.launchResult?.ok) {
    return null;
  }

  return input.context.localProgram.getLocalProgramSnapshot({
    targetProfileRef: input.profile.targetProfileRef,
    appName: input.profile.appName,
    bundleId: input.profile.bundleId,
  });
}
