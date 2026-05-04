import type { Project, SourceFile } from "ts-morph";

import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, toRootRelative, type AttackOutcome } from "./inspection-helpers.js";

const TARGET_OWNER_ROOTS = ["src/lib/local-runtime/", "src/lib/browser/"] as const;
const CLICK_LAYER_ROOTS = ["src/capabilities/mouse-click/", "src/capabilities/mouse-scroll/"] as const;
const MOUSE_CLICK_ROOT = "src/capabilities/mouse-click/";
const AI_PROOF_MARKERS = ["sourceAiResultRef", "sourceAiProofRef", "aiResultRef", "aiProofRef"] as const;
const OWNER_VERBS = ["compute", "resolve", "build", "select", "normalize"] as const;

function collectDeclaredNames(sourceFile: SourceFile): string[] {
  return [
    ...sourceFile.getFunctions().map((declaration) => declaration.getName()),
    ...sourceFile.getVariableDeclarations().map((declaration) => declaration.getName()),
    ...sourceFile.getClasses().map((declaration) => declaration.getName()),
    ...sourceFile.getInterfaces().map((declaration) => declaration.getName()),
    ...sourceFile.getTypeAliases().map((declaration) => declaration.getName()),
  ].filter((name): name is string => Boolean(name));
}

function normalizeToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hasOwnerVerb(normalizedName: string): boolean {
  return OWNER_VERBS.some((verb) => normalizedName.startsWith(verb));
}

function isTargetCoordinateOwnerName(name: string): boolean {
  const normalizedName = normalizeToken(name);
  return hasOwnerVerb(normalizedName) && normalizedName.includes("targetcoordinates");
}

function isClickLayerTruthName(name: string): boolean {
  const normalizedName = normalizeToken(name);
  const hasShape = normalizedName.includes("bbox") || normalizedName.includes("boundingbox") || normalizedName.includes("clickpoint");
  return hasOwnerVerb(normalizedName) && normalizedName.includes("target") && hasShape;
}

function collectTargetOwnerFindings(project: Project): import("./inspection-core.js").Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const relativePath = toRootRelative(sourceFile);
    const declaredNames = collectDeclaredNames(sourceFile);
    const matchedName = TARGET_OWNER_ROOTS.some((root) => relativePath.startsWith(root))
      ? declaredNames.find(isTargetCoordinateOwnerName)
      : CLICK_LAYER_ROOTS.some((root) => relativePath.startsWith(root))
        ? declaredNames.find(isClickLayerTruthName)
        : undefined;

    return matchedName
      ? [createViolation({ lawId: config.ACTIVE_LAW_IDS[0], file: relativePath, severity: "fatal", message: "External code must not declare visual target truth helpers outside Visual Target.", detail: `symbol=${matchedName}` })]
      : [];
  });
}

function collectMouseClickAiProofFindings(project: Project): import("./inspection-core.js").Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const relativePath = toRootRelative(sourceFile);
    if (!relativePath.startsWith(MOUSE_CLICK_ROOT)) {
      return [];
    }

    const sourceText = sourceFile.getFullText();
    return AI_PROOF_MARKERS.some((marker) => sourceText.includes(marker))
      ? [createViolation({ lawId: config.ACTIVE_LAW_IDS[0], file: relativePath, severity: "fatal", message: "Mouse Click must not consume AI target proof directly; it must consume Visual Target output." })]
      : [];
  });
}

export async function runTruthOwnershipAttack(project: Project): Promise<AttackOutcome> {
  const findings = [
    ...collectTargetOwnerFindings(project),
    ...collectMouseClickAiProofFindings(project),
  ];

  return {
    findings,
    phase: createAttackPhase(
      "truth-ownership-attack",
      findings,
      "Visual Target remains the only owner of governed target normalization and target-truth helper declarations.",
      "Visual Target truth drifted into external coordinate helpers or direct AI-to-click target consumption.",
    ),
  };
}