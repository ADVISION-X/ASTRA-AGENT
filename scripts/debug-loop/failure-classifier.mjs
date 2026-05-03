import {
  buildClassification,
  classifyBySignalPriority,
  classifyVerificationFailure,
  collectEvidenceRefs,
} from "./failure-classifier-rules.mjs";
import { readJsonFile } from "./json-utils.mjs";

function classifyAuth(input) {
  if (!input.authResult?.matched) {
    return null;
  }

  return buildClassification({
    failureCategory: input.authResult.classification,
    owner: "debug-loop-controller",
    severity: "P0",
    rootCause: input.authResult.signals[0] ?? "authentication gate blocked runtime execution",
    firstFatal: input.logIndex.firstBlocking?.text ?? null,
    evidenceRefs: collectEvidenceRefs([...input.logIndex.authSignals, ...input.logIndex.externalPlatformSignals]),
    requiredFixType: "MANUAL_AUTH_REQUIRED",
    secondaryFindings: [],
  });
}

function classifyMapBlock(input) {
  const decision = input.mapResolution?.decision ?? null;
  if (!decision) {
    return null;
  }

  const category = decision.replace(/^BLOCKED_/, "BLOCKED_");
  return buildClassification({
    failureCategory: category,
    owner: decision === "BLOCKED_COMMANDER_ENTRY_MISSING" ? "commander-console" : "map-plugin-package",
    severity: "P0",
    rootCause: input.mapResolution.rootCause ?? decision,
    firstFatal: input.logIndex.firstBlocking?.text ?? null,
    evidenceRefs: collectEvidenceRefs(input.logIndex.mapSignals),
    requiredFixType: decision === "BLOCKED_COMMANDER_ENTRY_MISSING" ? "ENTRY_CONTRACT_FIX" : "MAP_FIX",
    secondaryFindings: [],
  });
}

export async function classifyFailure(input = {}) {
  const authClassification = classifyAuth(input);
  if (authClassification) {
    return authClassification;
  }

  const mapClassification = classifyMapBlock(input);
  if (mapClassification) {
    return mapClassification;
  }

  const verificationClassification = classifyVerificationFailure(input);
  if (verificationClassification) {
    return verificationClassification;
  }

  return classifyBySignalPriority(input);
}

function parseCliArgs(argv) {
  const logIndexPathIndex = argv.indexOf("--logIndex");
  return logIndexPathIndex === -1 ? null : argv[logIndexPathIndex + 1] ?? null;
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const logIndexPath = parseCliArgs(process.argv.slice(2));
  if (!logIndexPath) {
    process.stderr.write("Usage: node scripts/debug-loop/failure-classifier.mjs --logIndex <path>\n");
    process.exitCode = 1;
  } else {
    const logIndex = await readJsonFile(logIndexPath);
    process.stdout.write(`${JSON.stringify(await classifyFailure({ logIndex }), null, 2)}\n`);
  }
}