import { access, readFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_SCAN_ORDER = [
  "stdout.log",
  "stderr.log",
  "runtime.jsonl",
  "audit-build.stdout.log",
  "audit-build.stderr.log",
  "ci-full.stdout.log",
  "ci-full.stderr.log",
  "runtime-recheck.stdout.log",
  "runtime-recheck.stderr.log",
  "law-registry.generated.json",
  "enforcement-matrix.generated.json",
  "audit-plan.generated.json",
  "ci-full-summary.generated.json",
];

const CHAIN_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "abilityGroupId",
  "childCapabilityId",
  "inputRef",
  "outputRef",
  "runtimeProof",
];

const CATEGORY_PATTERNS = {
  authSignals: [/AUTH_REQUIRED/i, /login_required/i, /session[_ ]expired/i, /cookie expired/i, /profile invalid/i, /two-factor/i, /2fa/i, /checkpoint/i, /permission denied/i],
  externalPlatformSignals: [/captcha/i, /security[_ ]check/i, /security_wall/i, /verify you are human/i, /unusual activity/i, /challenge/i],
  envSignals: [/ENV_MISSING/i, /profile_missing/i, /chrome executable/i, /ENOENT/i, /missing env/i],
  dependencySignals: [/DEPENDENCY/i, /Cannot find package/i, /module not found/i, /npm ERR!/i],
  startupSignals: [/startup/i, /bootstrap/i, /app shell/i, /service/i, /health/i],
  runtimeSignals: [/mission/i, /runtime/i, /step/i, /review_required/i, /failed/i],
  lawSignals: [/law/i, /registry/i, /matrix/i, /enforcement/i, /audit-plan/i],
  inspectorSignals: [/inspector/i, /owner inspector/i, /audit-system/i],
  realCodeInspectionSignals: [/real-code-inspection/i, /ci-full/i],
  ciSignals: [/ci:full/i, /ci full/i, /typecheck/i, /build/i],
  mapSignals: [/map/i, /selectedMapId/i, /activationSnapshotRef/i, /taskTemplateId/i],
  promptSignals: [/prompt/i, /promptContractId/i, /outputSchemaRef/i],
  nerveBusSignals: [/nerve[- ]bus/i, /envelope/i],
  forensicsSignals: [/forensics/i, /evidence packet/i, /browseLedger/i, /ledger/i],
  artifactLifecycleSignals: [/artifact/i, /lifecycle/i],
  codePuritySignals: [/code-purity/i, /god file/i, /function limits/i, /import\/export/i],
  ownerSignals: [/commander-console/i, /orchestration/i, /nerve-bus/i, /open/i, /page-state/i, /screenshot/i, /ai/i, /visual-target/i, /geometry-guard/i, /mouse-click/i, /mouse-scroll/i, /text-input/i, /post-action-verification/i, /forensics-persistence/i, /map-plugin-package/i, /audit-system/i, /debug-loop-controller/i],
  p0Violations: [/P0/i, /machine-blocking/i],
  successSignals: [/PASS/i, /passed/i, /ready/i, /completed/i, /AUTH_OK/i, /platform_ready/i],
};

const BLOCKING_PATTERNS = [/BLOCKED/i, /AUTH_REQUIRED/i, /EXTERNAL_PLATFORM_SECURITY/i, /NO_ACTIVE_MAP/i, /NO_PROMPT_CONTRACT/i, /MAP_NOT_ACTIVATED/i, /COMMANDER_ENTRY_MISSING/i];
const FATAL_PATTERNS = [/\bfatal\b/i, /\bfailed\b/i, /\berror\b/i, /\bexception\b/i, /\bviolation\b/i, /uncaught/i];
const IGNORE_PATTERNS = [
  /No errors found/i,
  /"failed"\s*:\s*\d+/i,
  /"blocking"\s*:\s*\d+/i,
  /"passed"\s*:\s*\d+/i,
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readSourceLines(iterationDir, sourceName) {
  const sourcePath = path.join(iterationDir, sourceName);
  if (!(await fileExists(sourcePath))) {
    return null;
  }

  const content = await readFile(sourcePath, "utf8");
  return content.length === 0 ? [] : content.split(/\r?\n/);
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function createSignal(source, line, text) {
  return { source, line, text };
}

function maybePushSignal(bucket, signal, patterns) {
  if (!matchesAny(signal.text, patterns)) {
    return;
  }

  bucket.push(signal);
}

function collectMissingChainFields(text, source, line, missingChainFields) {
  for (const fieldName of CHAIN_FIELDS) {
    const fieldPattern = new RegExp(`${fieldName}[^\\n]*(missing|null|undefined)`, "i");
    if (fieldPattern.test(text)) {
      missingChainFields.push(createSignal(source, line, `${fieldName} missing`));
    }
  }
}

function createEmptyIndex(missingLogSources) {
  return {
    totalLinesScanned: 0,
    sourcesScanned: [],
    missingLogSources: [...new Set(missingLogSources)],
    firstFatal: null,
    firstBlocking: null,
    fatalLines: [],
    blockingLines: [],
    authSignals: [],
    externalPlatformSignals: [],
    envSignals: [],
    dependencySignals: [],
    startupSignals: [],
    runtimeSignals: [],
    lawSignals: [],
    inspectorSignals: [],
    realCodeInspectionSignals: [],
    ciSignals: [],
    mapSignals: [],
    promptSignals: [],
    nerveBusSignals: [],
    forensicsSignals: [],
    artifactLifecycleSignals: [],
    codePuritySignals: [],
    ownerSignals: [],
    missingChainFields: [],
    p0Violations: [],
    successSignals: [],
  };
}

function updateFirstSignals(index, signal) {
  if (index.firstFatal === null && matchesAny(signal.text, FATAL_PATTERNS)) {
    index.firstFatal = signal;
  }

  if (index.firstBlocking === null && matchesAny(signal.text, BLOCKING_PATTERNS)) {
    index.firstBlocking = signal;
  }
}

function scanLine(index, sourceName, lineNumber, text) {
  if (!text || matchesAny(text, IGNORE_PATTERNS)) {
    return;
  }

  index.totalLinesScanned += 1;
  const signal = createSignal(sourceName, lineNumber, text);
  maybePushSignal(index.fatalLines, signal, FATAL_PATTERNS);
  maybePushSignal(index.blockingLines, signal, BLOCKING_PATTERNS);
  for (const [bucketName, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    maybePushSignal(index[bucketName], signal, patterns);
  }
  collectMissingChainFields(text, sourceName, lineNumber, index.missingChainFields);
  updateFirstSignals(index, signal);
}

async function scanSource(index, iterationDir, sourceName) {
  const lines = await readSourceLines(iterationDir, sourceName);
  if (lines === null) {
    index.missingLogSources.push(sourceName);
    return;
  }

  index.sourcesScanned.push(sourceName);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    scanLine(index, sourceName, lineIndex + 1, lines[lineIndex]);
  }
}

function finalizeIndex(index) {
  index.missingLogSources = [...new Set(index.missingLogSources)];
  return index;
}

export async function buildLogIndex(input) {
  const index = createEmptyIndex(input.missingLogSources ?? []);

  for (const sourceName of SOURCE_SCAN_ORDER) {
    await scanSource(index, input.iterationDir, sourceName);
  }

  return finalizeIndex(index);
}
