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

const ROOT = "src/capabilities/post-action-verification";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const PLATFORM_ACTION_ROOT = "src/features/platform-action/adapters";
const OPEN_ROOT = "src/capabilities/open";
const MOUSE_CLICK_ROOT = "src/capabilities/mouse-click";
const MOUSE_SCROLL_ROOT = "src/capabilities/mouse-scroll";

const CHILDREN = [
  "verify-page-opened",
  "verify-comments-panel-opened",
  "verify-comments-panel-closed",
  "verify-video-changed-after-scroll",
  "verify-not-interested-result",
  "verify-target-state-changed",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "lib/local-ai",
  "capabilities/mouse-click/children",
  "capabilities/mouse-scroll/children",
  "capabilities/open/",
  "capabilities/screenshot/children",
  "features/platform-action/adapters",
] as const;

export default createPendingDomainInspector({
  inspector: "GrassEye Post-action Verification Capability Owner Inspector",
  inspectorId: "post-action-verification-capability-owner",
  capabilityDomain: "post-action-verification-capability",
  inspectorEntry: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "post-action-verification-capability law exists but independent verification ownership is not fully established yet",
  implementedSummary: "post-action-verification-capability is implemented as the canonical action-result verification owner with boundary enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const postActionFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const platformActionFiles = await listFilesRecursive(pathFromRepoRoot(PLATFORM_ACTION_ROOT), { extensions: [".ts"] });
    const openFiles = await listFilesRecursive(pathFromRepoRoot(OPEN_ROOT), { extensions: [".ts"] });
    const mouseClickFiles = await listFilesRecursive(pathFromRepoRoot(MOUSE_CLICK_ROOT), { extensions: [".ts"] });
    const mouseScrollFiles = await listFilesRecursive(pathFromRepoRoot(MOUSE_SCROLL_ROOT), { extensions: [".ts"] });
    const findings: Finding[] = [];

    const inputFields = getZodObjectPropertyNames(contractSource, "PostActionVerificationAbilityInputSchema");
    const resultFields = getZodObjectPropertyNames(contractSource, "PostActionVerificationAbilityResultSchema");
    const contractPassed = [
      "actionLogRef",
      "expectedOutcome",
      "verificationPolicy",
      "observationRefs",
    ].every((field) => inputFields.has(field))
      && [
        "verificationDecision",
        "failureReason",
        "reviewRequiredReason",
        "debugLogRef",
      ].every((field) => resultFields.has(field))
      && hasInterfaceMethod(contractSource, "PostActionVerificationAbilityGroup", "execute");
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: CONTRACT_PATH, line: 1, severity: "error", message: "Post-action Verification contract must expose one unified input, one unified result, and one group execute interface." }));
    }

    const childFilesPresent = await Promise.all(
      CHILDREN.flatMap((child) => [
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/implementation.ts`)),
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/capability-check.ts`)),
      ]),
    );
    const childStructurePassed = childFilesPresent.every(Boolean)
      && CHILDREN.every((child) => registrySource.getFullText().includes(`"${child}"`));
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: REGISTRY_PATH, line: 1, severity: "error", message: "Post-action Verification registry must contain all child folders, capability checks, and internal registration only." }));
    }

    const externalChildImportFound = project.getSourceFiles().some((sourceFile) => {
      const relative = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().some((declaration) => {
        const specifier = declaration.getModuleSpecifierValue();
        return specifier.includes("capabilities/post-action-verification/children/") && !relative.startsWith(`${ROOT}/`);
      });
    });
    if (externalChildImportFound) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: ROOT, line: 1, severity: "fatal", message: "Post-action Verification child capabilities must not be imported outside the canonical root." }));
    }

    const forbiddenRootImports = postActionFiles.flatMap((filePath) => {
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
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V1", file: forbiddenRootImports[0]!, line: 1, severity: "fatal", message: "Post-action Verification root must not import local-ai runtime, action children, open children, screenshot children, or platform adapters." }));
    }

    const platformActionOwnsVerification = platformActionFiles.some((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return false;
      }

      const text = sourceFile.getFullText();
      return text.includes("verifyAfterAction") || text.includes("buildUnableToVerifyResult(") || text.includes("comments_panel not detected after coordinate action");
    });
    if (platformActionOwnsVerification) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: PLATFORM_ACTION_ROOT, line: 1, severity: "fatal", message: "Platform adapter must not own post-action verification truth or inline verification helpers." }));
    }

    const openOwnsVerification = openFiles.some((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return false;
      }

      const text = sourceFile.getFullText();
      return /\bverifyOpen\s*:/.test(text)
        || /\bbuildGovernedSessionAccessResult\(/.test(text)
        || /\bbuildLocalWorkbenchAccessResult\(/.test(text);
    });
    if (openOwnsVerification) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: OPEN_ROOT, line: 1, severity: "fatal", message: "Open capability must not verify page-opened outcome by itself." }));
    }

    const mouseClickOwnsVerification = mouseClickFiles.some((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      return sourceFile ? sourceFile.getFullText().includes("verificationResult") || sourceFile.getFullText().includes("post-action") : false;
    });
    if (mouseClickOwnsVerification) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: MOUSE_CLICK_ROOT, line: 1, severity: "fatal", message: "Mouse Click must not verify final business outcome by itself." }));
    }

    const mouseScrollOwnsVerification = mouseScrollFiles.some((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      return sourceFile ? sourceFile.getFullText().includes("verificationResult") || sourceFile.getFullText().includes("post-action") : false;
    });
    if (mouseScrollOwnsVerification) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: MOUSE_SCROLL_ROOT, line: 1, severity: "fatal", message: "Mouse Scroll must not verify downstream video-changed outcome by itself." }));
    }

    return {
      findings,
      phases: [
        createPhase("post-action-verification-contract", contractPassed ? "PASS" : "CODE VIOLATION", contractPassed, contractPassed ? "Post-action Verification contract exposes one unified input, result, and group interface." : "Post-action Verification contract is missing required unified fields or interface."),
        createPhase("post-action-verification-child-structure", childStructurePassed && !externalChildImportFound ? "PASS" : "CODE VIOLATION", childStructurePassed && !externalChildImportFound, childStructurePassed && !externalChildImportFound ? "Post-action Verification canonical root contains all child capabilities with internal registration and no child leakage." : "Post-action Verification child structure or anti-leak boundary is incomplete."),
        createPhase("post-action-verification-boundary-purity", forbiddenRootImports.length === 0 ? "PASS" : "CODE VIOLATION", forbiddenRootImports.length === 0, forbiddenRootImports.length === 0 ? "Post-action Verification root stays pure and does not import forbidden execution owners." : "Post-action Verification root still imports forbidden execution owners."),
        createPhase("post-action-verification-owner-cutover", !platformActionOwnsVerification && !openOwnsVerification && !mouseClickOwnsVerification && !mouseScrollOwnsVerification ? "PASS" : "CODE VIOLATION", !platformActionOwnsVerification && !openOwnsVerification && !mouseClickOwnsVerification && !mouseScrollOwnsVerification, !platformActionOwnsVerification && !openOwnsVerification && !mouseClickOwnsVerification && !mouseScrollOwnsVerification ? "Verification truth is cut away from platform-action, open, mouse-click, and mouse-scroll owners." : "Legacy verification ownership still survives outside the Post-action Verification group."),
      ],
    };
  },
});