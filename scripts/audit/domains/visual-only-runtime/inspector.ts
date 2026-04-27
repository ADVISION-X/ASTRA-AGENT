import { createPhase } from "../../core/result.js";
import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const LAW_PATH = ".github/instructions/cursor-rules/modules/module-visual-only-runtime.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 视觉唯一运行模式施工图.md";
const TYPE_PATH = "src/types/visual-only-runtime.ts";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default createPendingDomainInspector({
  inspector: "GrassEye Visual Only Runtime Owner Inspector",
  inspectorId: "visual-only-runtime-owner",
  capabilityDomain: "visual-only-runtime",
  inspectorEntry: "scripts/audit/domains/visual-only-runtime/inspector.ts",
  ownedPaths: ["src/types/visual-only-runtime.ts", "src/features/platform-action", "src/lib/browser"],
  pendingSummary: "visual-only runtime is not fully wired into law, verify, and runtime surfaces",
  implementedSummary: "visual-only runtime law, type, verify, and owner boundary are wired",
  extraChecks: async () => {
    const [law, blueprint, typeFile, repoFiles, governedFiles] = await Promise.all([
      readTextFile(pathFromRepoRoot(LAW_PATH)),
      readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
      readTextFile(pathFromRepoRoot(TYPE_PATH)),
      listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-local", ".grasseye-data", ".grasseye-demo-data"] }),
      listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts", ".tsx"] }),
    ]);

    const findings: Finding[] = [];
    const governedSourceFiles = governedFiles.filter((file) => {
      const relative = toRepoRelativePath(file);
      return /^(src\/(features\/(agent|platform-action|comments|vision)|lib\/(browser|local-ai))\/).+\.(ts|tsx)$/.test(relative);
    });
    const governedSources = await Promise.all(governedSourceFiles.map(async (file) => ({
      file: toRepoRelativePath(file),
      content: await readTextFile(file),
    })));
    const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
    const forbiddenFolders = repoFiles.filter((file) => /(^|\/)(crawler|scraper|dom-reader|page-parser)(\/|$)/i.test(file));
    const forbiddenSource = governedSources.find(({ content }) => /readVisibleTexts|innerText|textContent|querySelector|querySelectorAll|getByText|getByRole|\.locator\(|\$eval|\$\$eval/.test(content));

    if (!includesAll(law, [
      "Screenshot evidence is the source of page understanding.",
      "Browser infrastructure must not become a DOM-reading or selector-action owner.",
      "DOM selector clicks as real-platform action acceptance.",
    ])) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1",
        file: LAW_PATH,
        line: 1,
        severity: "error",
        message: "Visual-only runtime law is missing required screenshot-source or forbidden DOM markers.",
      }));
    }

    if (!includesAll(blueprint, [
      "截图 -> 本地视觉 AI -> 视觉目标识别 -> 坐标动作 -> 动作后截图验证 -> 结构化日志证明",
      "不 DOM fallback",
      "scroll next -> visual action and screenshotHash/videoVisitId verification",
    ])) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1",
        file: BLUEPRINT_PATH,
        line: 1,
        severity: "error",
        message: "Visual-only runtime blueprint is missing required runtime chain or failure-policy markers.",
      }));
    }

    if (!includesAll(typeFile, [
      "ForbiddenPageUnderstandingSourceSchema",
      "domFallbackAllowed: z.literal(false)",
      "selectorActionAllowed: z.literal(false)",
      "commentDomExtractionAllowed: z.literal(false)",
      "metricDomExtractionAllowed: z.literal(false)",
    ])) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1",
        file: TYPE_PATH,
        line: 1,
        severity: "error",
        message: "Visual-only runtime type contract is missing required false DOM flags or forbidden-source schema.",
      }));
    }

    if (forbiddenSource) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1",
        file: forbiddenSource.file,
        line: 1,
        severity: "fatal",
        message: "Governed real-platform source still contains forbidden DOM-reading or selector-action tokens.",
      }));
    }

    if (forbiddenFolders.length > 0) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1",
        file: forbiddenFolders[0] ?? ".",
        line: 1,
        severity: "fatal",
        message: "Repository contains forbidden crawler / scraper / dom-reader / page-parser paths.",
      }));
    }

    if (forbiddenTests.length > 0) {
      findings.push(createFinding({
        lawId: "GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1",
        file: forbiddenTests[0] ?? "tests",
        line: 1,
        severity: "fatal",
        message: "Visual-only runtime governance forbids repository test artifacts as quality truth.",
      }));
    }

    return {
      findings,
      phases: [
        createPhase("visual-only-law", findings.some((finding) => finding.file === LAW_PATH) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.file === LAW_PATH), !findings.some((finding) => finding.file === LAW_PATH) ? "Visual-only runtime law declares screenshot-first page understanding and bans DOM/BOM action sources." : "Visual-only runtime law is incomplete."),
        createPhase("visual-only-blueprint", findings.some((finding) => finding.file === BLUEPRINT_PATH) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.file === BLUEPRINT_PATH), !findings.some((finding) => finding.file === BLUEPRINT_PATH) ? "Visual-only runtime blueprint defines the governed screenshot, OCR/AI, visual target, coordinate, and verification chain." : "Visual-only runtime blueprint is incomplete."),
        createPhase("visual-only-types", findings.some((finding) => finding.file === TYPE_PATH) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.file === TYPE_PATH), !findings.some((finding) => finding.file === TYPE_PATH) ? "Visual-only runtime type contract fixes all DOM fallback flags to false." : "Visual-only runtime type contract is incomplete."),
        createPhase("visual-only-production-path", forbiddenSource ? "CODE VIOLATION" : "PASS", !forbiddenSource, forbiddenSource ? "Governed real-platform source still contains DOM-reading or selector-action tokens." : "Governed real-platform source stays off DOM-reading and selector-action tokens."),
        createPhase("visual-only-repo-boundary", forbiddenFolders.length === 0 && forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenFolders.length === 0 && forbiddenTests.length === 0, forbiddenFolders.length === 0 && forbiddenTests.length === 0 ? "Repository contains no forbidden crawler paths or tests-as-truth artifacts." : "Repository still contains forbidden crawler paths or tests-as-truth artifacts."),
      ],
    };
  },
});