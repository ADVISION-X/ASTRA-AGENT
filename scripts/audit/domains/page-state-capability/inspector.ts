import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getZodObjectPropertyNames,
  hasInterfaceMethod,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/page-state";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const AUDIT_ROOT = "scripts/audit/domains/page-state-capability";
const VERIFY_PATH = "scripts/verify/verify-page-state-capabilities.ts";
const PLATFORM_ACTION_ROOT = "src/features/platform-action/adapters";

const CHILDREN = [
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "lib/local-ai",
  "capabilities/mouse-click/children",
  "capabilities/mouse-scroll/children",
  "capabilities/open/",
  "capabilities/post-action-verification/",
  "capabilities/screenshot/children",
  "features/platform-action/adapters",
] as const;

export default createPendingDomainInspector({
  inspector: "GrassEye Page State Capability Owner Inspector",
  inspectorId: "page-state-capability-owner",
  capabilityDomain: "page-state-capability",
  inspectorEntry: "scripts/audit/domains/page-state-capability/inspector.ts",
  ownedPaths: [ROOT, AUDIT_ROOT],
  pendingSummary: "page-state-capability law exists but independent page-state ownership is not fully established yet",
  implementedSummary: "page-state-capability is implemented as the canonical current-page state owner with boundary enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const pageStateFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const platformActionFiles = await listFilesRecursive(pathFromRepoRoot(PLATFORM_ACTION_ROOT), { extensions: [".ts"] });
    const findings: Finding[] = [];

    const inputFields = getZodObjectPropertyNames(contractSource, "PageStateAbilityInputSchema");
    const resultFields = getZodObjectPropertyNames(contractSource, "PageStateAbilityResultSchema");
    const contractPassed = ["currentUrl", "confidencePolicy", "statePolicy"].every((field) => inputFields.has(field))
      && ["pageStateType", "stateSummary", "failureReason", "debugLogRef"].every((field) => resultFields.has(field))
      && hasInterfaceMethod(contractSource, "PageStateAbilityGroup", "execute");
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: CONTRACT_PATH, line: 1, severity: "error", message: "Page State contract must expose one unified input, one unified result, and one group execute interface." }));
    }

    const childFilesPresent = await Promise.all(
      CHILDREN.map((child) => fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/implementation.ts`))),
    );
    const childStructurePassed = childFilesPresent.every(Boolean)
      && CHILDREN.every((child) => registrySource.getFullText().includes(`"${child}"`));
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: REGISTRY_PATH, line: 1, severity: "error", message: "Page State registry must contain all child folders and internal registration only." }));
    }

    const externalChildImportFound = project.getSourceFiles().some((sourceFile) => {
      const relative = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().some((declaration) => {
        const specifier = declaration.getModuleSpecifierValue();
        return specifier.includes("capabilities/page-state/children/") && !relative.startsWith(`${ROOT}/`);
      });
    });
    if (externalChildImportFound) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: ROOT, line: 1, severity: "fatal", message: "Page State child capabilities must not be imported outside the canonical root." }));
    }

    const forbiddenRootImports = pageStateFiles.flatMap((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return FORBIDDEN_IMPORT_MARKERS.some((marker) => specifier.includes(marker)) ? [toRepoRelativePath(filePath)] : [];
      });
    });
    if (forbiddenRootImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: forbiddenRootImports[0]!, line: 1, severity: "fatal", message: "Page State root must not import local-ai runtime, action children, open children, screenshot children, post-action verification, or platform adapters." }));
    }

    const verifyPathExists = await fileExists(pathFromRepoRoot(VERIFY_PATH));
    const verifyLikeFiles = pageStateFiles.filter((filePath) => {
      const relative = toRepoRelativePath(filePath);
      return relative.endsWith("capability-check.ts") || relative.includes("verify-");
    });
    if (verifyPathExists || verifyLikeFiles.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V1", file: verifyPathExists ? VERIFY_PATH : verifyLikeFiles[0]!, line: 1, severity: "fatal", message: "Page State must not add dedicated verify scripts or capability-check files." }));
    }

    const platformActionOwnsPageState = platformActionFiles.some((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return false;
      }

      const text = sourceFile.getFullText();
      return /\bgetPageAccessStatus\(/.test(text)
        || /\brequiresOperatorReview\(/.test(text)
        || /\bbuildReviewRequiredSummary\(/.test(text);
    });
    if (platformActionOwnsPageState) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: PLATFORM_ACTION_ROOT, line: 1, severity: "fatal", message: "Platform adapter must not own login, safety, or feed-ready page-state truth helpers." }));
    }

    return {
      findings,
      phases: [
        createPhase("page-state-contract", contractPassed ? "PASS" : "CODE VIOLATION", contractPassed, contractPassed ? "Page State contract exposes one unified input, result, and group interface." : "Page State contract is missing required unified fields or interface."),
        createPhase("page-state-child-structure", childStructurePassed && !externalChildImportFound ? "PASS" : "CODE VIOLATION", childStructurePassed && !externalChildImportFound, childStructurePassed && !externalChildImportFound ? "Page State canonical root contains all child capabilities with internal registration and no child leakage." : "Page State child structure or anti-leak boundary is incomplete."),
        createPhase("page-state-boundary-purity", forbiddenRootImports.length === 0 ? "PASS" : "CODE VIOLATION", forbiddenRootImports.length === 0, forbiddenRootImports.length === 0 ? "Page State root stays pure and does not import forbidden execution owners." : "Page State root still imports forbidden execution owners."),
        createPhase("page-state-owner-cutover", !platformActionOwnsPageState ? "PASS" : "CODE VIOLATION", !platformActionOwnsPageState, !platformActionOwnsPageState ? "Page-state truth is cut away from platform-action helpers." : "Legacy page-state ownership still survives inside platform-action."),
        createPhase("page-state-verify-ban", !verifyPathExists && verifyLikeFiles.length === 0 ? "PASS" : "CODE VIOLATION", !verifyPathExists && verifyLikeFiles.length === 0, !verifyPathExists && verifyLikeFiles.length === 0 ? "Page State enforcement stays inspector-only with no dedicated verify script." : "Page State verify ban is violated by a dedicated verify-like file."),
      ],
    };
  },
});