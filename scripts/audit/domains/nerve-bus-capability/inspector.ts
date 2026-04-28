import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/nerve-bus";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ENVELOPE_PATH = `${ROOT}/shared/envelope.ts`;

const REQUIRED_FILES = [
  CONTRACT_PATH,
  ENVELOPE_PATH,
  `${ROOT}/ability-group.ts`,
  `${ROOT}/channels/orchestration-to-ability/implementation.ts`,
  `${ROOT}/channels/ability-to-orchestration/implementation.ts`,
  `${ROOT}/channels/orchestration-to-ai/implementation.ts`,
  `${ROOT}/channels/ai-to-orchestration/implementation.ts`,
] as const;

export default createPendingDomainInspector({
  inspector: "GrassEye Nerve Bus Capability Owner Inspector",
  inspectorId: "nerve-bus-capability-owner",
  capabilityDomain: "nerve-bus-capability",
  inspectorEntry: "scripts/audit/domains/nerve-bus-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "nerve-bus-capability law exists but canonical transport root is not fully established yet",
  implementedSummary: "nerve-bus-capability is implemented as the canonical governed transport owner with four channels and transfer proof",
  extraChecks: async () => {
    const findings: Finding[] = [];
    const requiredPresence = await Promise.all(
      REQUIRED_FILES.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })),
    );
    for (const check of requiredPresence) {
      if (!check.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: check.filePath, line: 1, severity: "fatal", message: "Required Nerve Bus owner file is missing." }));
      }
    }

    const [contractSource, envelopeSource] = await Promise.all([
      readTextFile(pathFromRepoRoot(CONTRACT_PATH)),
      readTextFile(pathFromRepoRoot(ENVELOPE_PATH)),
    ]);
    const rootFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const rootFileSources = await Promise.all(rootFiles.map(async (filePath) => ({ relativePath: toRepoRelativePath(filePath), source: await readTextFile(filePath) })));
    const localAiFiles = await listFilesRecursive(pathFromRepoRoot("src/lib/local-ai"), { extensions: [".ts"] });
    const localAiImports = await Promise.all(localAiFiles.map(async (filePath) => ({ relativePath: toRepoRelativePath(filePath), source: await readTextFile(filePath) })));

    const envelopePassed = envelopeSource.includes("CommandEnvelope")
      && envelopeSource.includes("ResultEnvelope")
      && envelopeSource.includes("AiRequestEnvelope")
      && envelopeSource.includes("AiResponseEnvelope")
      && contractSource.includes("dispatchAbilityCommand")
      && contractSource.includes("requestAi");
    if (!envelopePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: ENVELOPE_PATH, line: 1, severity: "error", message: "Nerve Bus root must expose governed envelopes and public dispatch methods." }));
    }

    const forbiddenImports = rootFileSources.flatMap((entry) => (
      entry.source.includes("lib/browser/")
      || entry.source.includes("capabilities/") && entry.source.includes("children/")
      || entry.source.includes("/implementation.ts") && !entry.relativePath.startsWith(`${ROOT}/channels/`)
    ) ? [entry.relativePath] : []);
    if (forbiddenImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: forbiddenImports[0]!, line: 1, severity: "fatal", message: "Nerve Bus root must not import browser primitives or other capability child implementations." }));
    }

    const noBranchLogic = rootFileSources.every((entry) => !entry.source.includes("product_yes") && !entry.source.includes("product_no") && !entry.source.includes("branch_product"));
    if (!noBranchLogic) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-002-V1", file: ROOT, line: 1, severity: "fatal", message: "Nerve Bus must not contain product_yes/product_no branch logic." }));
    }

    const localAiDoesNotImportAbilityGroups = localAiImports.every((entry) => !entry.source.includes("capabilities/"));
    if (!localAiDoesNotImportAbilityGroups) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: localAiImports.find((entry) => entry.source.includes("capabilities/"))?.relativePath ?? "src/lib/local-ai", line: 1, severity: "fatal", message: "Local AI boundary must not import ability groups directly." }));
    }

    return {
      findings,
      phases: [
        createPhase("nerve-bus-required-shape", requiredPresence.every((entry) => entry.exists) && envelopePassed ? "PASS" : "CODE VIOLATION", requiredPresence.every((entry) => entry.exists) && envelopePassed, requiredPresence.every((entry) => entry.exists) && envelopePassed ? "Nerve Bus root contains contract, envelope types, and four channels." : "Nerve Bus required shape is incomplete."),
        createPhase("nerve-bus-boundary-purity", forbiddenImports.length === 0 && localAiDoesNotImportAbilityGroups ? "PASS" : "CODE VIOLATION", forbiddenImports.length === 0 && localAiDoesNotImportAbilityGroups, forbiddenImports.length === 0 && localAiDoesNotImportAbilityGroups ? "Nerve Bus and Local AI boundaries avoid child-implementation coupling." : "Nerve Bus or Local AI still imports forbidden capability surfaces."),
        createPhase("nerve-bus-no-branch-logic", noBranchLogic ? "PASS" : "CODE VIOLATION", noBranchLogic, noBranchLogic ? "Nerve Bus contains transport only and no business branch logic." : "Nerve Bus still contains branch-decision markers."),
      ],
    };
  },
});