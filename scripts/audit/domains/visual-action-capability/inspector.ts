import { createPhase } from "../../core/result.js";
import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const LAW_PATH = ".github/instructions/cursor-rules/modules/module-visual-action-capability.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 视觉目标与坐标动作能力施工图.md";
const TYPES_PATH = "src/types/visual-action.ts";
const VISUAL_TARGET_PATH = "src/features/platform-action/visual-target.ts";
const POLICY_PATH = "src/features/platform-action/coordinate-action-policy.ts";
const GEOMETRY_PATH = "src/features/platform-action/screen-geometry-guard.ts";
const ADAPTER_PATH = "src/features/platform-action/adapters/tiktok-platform-adapter.ts";
const RUNTIME_PATH = "src/features/agent/agent-service.ts";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default createPendingDomainInspector({
  inspector: "GrassEye Visual Action Capability Owner Inspector",
  inspectorId: "visual-action-capability-owner",
  capabilityDomain: "visual-action-capability",
  inspectorEntry: "scripts/audit/domains/visual-action-capability/inspector.ts",
  ownedPaths: ["src/types/visual-action.ts", "src/features/platform-action", "src/lib/browser"],
  pendingSummary: "visual-action-capability implementation is partial; production-grade per-action visual execution is still incomplete",
  implementedSummary: "visual-action-capability is implemented as a governed visual-target and coordinate-action surface",
  extraChecks: async () => {
    const [law, blueprint, typesFile, visualTargetFile, policyFile, geometryFile, adapterFile, runtimeFile, repoFiles] = await Promise.all([
      readTextFile(pathFromRepoRoot(LAW_PATH)),
      readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
      readTextFile(pathFromRepoRoot(TYPES_PATH)),
      readTextFile(pathFromRepoRoot(VISUAL_TARGET_PATH)),
      readTextFile(pathFromRepoRoot(POLICY_PATH)),
      readTextFile(pathFromRepoRoot(GEOMETRY_PATH)),
      readTextFile(pathFromRepoRoot(ADAPTER_PATH)),
      readTextFile(pathFromRepoRoot(RUNTIME_PATH)),
      listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-demo-data", ".grasseye-local"] }),
    ]);

    const findings: Finding[] = [];
    const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));

    const lawPassed = includesAll(law, [
      "visual target detection and coordinate execution as the primary action path",
      "DOM / Playwright semantic execution may exist only as operator-approved bounded fallback",
      "Coordinate clicks without boundingBox.",
      "Coordinate clicks without geometry guard.",
    ]);
    if (!lawPassed) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: LAW_PATH,
        line: 1,
        severity: "error",
        message: "Visual-action-capability law is missing a required coordinate-guard or fallback boundary.",
      }));
    }

    const blueprintPassed = includesAll(blueprint, [
      "Visual Target Catalog",
      "comments_button",
      "not_interested_button",
      "Coordinate Action Guard",
      "Post-action Verification",
    ]);
    if (!blueprintPassed) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: BLUEPRINT_PATH,
        line: 1,
        severity: "error",
        message: "Visual-action blueprint is missing a required target catalog, guard, or verification section.",
      }));
    }

    const typesPassed = includesAll(typesFile, [
      "VisualTargetTypeSchema",
      "VisualTargetSchema",
      "VisualActionResultSchema",
      "VisualActionVerificationResultSchema",
      "boundingBox",
      "clickPoint",
      "confidence",
      "sourceScreenshotEvidenceId",
    ]);
    if (!typesPassed) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: TYPES_PATH,
        line: 1,
        severity: "error",
        message: "Visual-action type contract is missing target or verification fields.",
      }));
    }

    const contractPassed = includesAll(visualTargetFile, ["sourceScreenshotEvidenceId", "clickPoint", "boundingBox"])
      && includesAll(policyFile, ["isBoundingBoxInsideScreenshot", "isPointInsideBoundingBox", "minimumConfidence"])
      && includesAll(geometryFile, ["screenshotWidth", "screenshotHeight", "status: \"calibrated\" | \"mismatch\""]);
    if (!contractPassed) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: VISUAL_TARGET_PATH,
        line: 1,
        severity: "error",
        message: "Visual-action contract is missing bounding-box, click-point, or geometry-guard markers.",
      }));
    }

    const adapterPassed = includesAll(adapterFile, [
      "verificationExpectation",
      "visualActionResult",
      "visual-only runtime forbids DOM fallback",
      "unable_to_verify",
      "comments_panel not detected after coordinate action",
    ]);
    if (!adapterPassed) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: ADAPTER_PATH,
        line: 1,
        severity: "error",
        message: "Real-platform adapter is missing explicit verification or explicit fallback markers.",
      }));
    }

    if (runtimeFile.includes("screenX") || runtimeFile.includes("screenY") || runtimeFile.includes("selector")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: RUNTIME_PATH,
        line: 1,
        severity: "error",
        message: "AgentRuntime must not own raw coordinates or selectors.",
      }));
    }

    if (forbiddenTests.length > 0) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1",
        file: forbiddenTests[0] ?? "tests",
        line: 1,
        severity: "fatal",
        message: "Visual-action-capability governance forbids repository test artifacts as quality truth.",
      }));
    }

    return {
      findings,
      phases: [
        createPhase("visual-action-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Visual-action law defines guarded coordinate execution and bans DOM fallback after visual failure." : "Visual-action law is missing required guarded-execution boundaries."),
        createPhase("visual-action-blueprint", blueprintPassed ? "PASS" : "CODE VIOLATION", blueprintPassed, blueprintPassed ? "Visual-action blueprint defines target catalog, guard, and verification contracts." : "Visual-action blueprint is incomplete."),
        createPhase("visual-action-types", typesPassed && contractPassed ? "PASS" : "CODE VIOLATION", typesPassed && contractPassed, typesPassed && contractPassed ? "Visual-action type contract defines targets, bounding boxes, click points, and verification results." : "Visual-action type or policy contract is incomplete."),
        createPhase("visual-action-adapter-boundary", adapterPassed ? "PASS" : "CODE VIOLATION", adapterPassed, adapterPassed ? "Real-platform adapter exposes explicit visual verification and no DOM fallback markers." : "Real-platform adapter is missing explicit visual verification or still exposes DOM fallback markers."),
        createPhase("visual-action-runtime-boundary", !(runtimeFile.includes("screenX") || runtimeFile.includes("screenY") || runtimeFile.includes("selector")) ? "PASS" : "CODE VIOLATION", !(runtimeFile.includes("screenX") || runtimeFile.includes("screenY") || runtimeFile.includes("selector")), !(runtimeFile.includes("screenX") || runtimeFile.includes("screenY") || runtimeFile.includes("selector")) ? "AgentRuntime remains off raw coordinates and selectors." : "AgentRuntime owns forbidden coordinate or selector details."),
        createPhase("visual-action-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
      ],
    };
  },
});