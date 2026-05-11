import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { InspectorContext, InspectorResult, Finding } from "../../core/schema.js";
import { createFinding, finalizeInspectorResult } from "../../core/result.js";
import {
  NERVE_BUS_SOURCE_DIR,
  NERVE_BUS_AUDIT_DIR,
  NERVE_BUS_MAX_SOURCE_FILES,
  NERVE_BUS_MAX_AUDIT_FILES,
  NERVE_BUS_ALLOWED_CHILDREN,
  NERVE_BUS_FORBIDDEN_CHILDREN,
  NERVE_BUS_FORBIDDEN_INFRA_PATTERNS,
  NERVE_BUS_FORBIDDEN_IMPORTS,
  NERVE_BUS_FORBIDDEN_PROMPT_PATTERNS,
  NERVE_BUS_FORBIDDEN_ENVELOPE_FIELDS,
} from "./config.js";

const LAW_ID = "NB";
const INSPECTOR_ID = "nerve-bus-capability-owner";
const CAPABILITY_DOMAIN = "nerve-bus-capability";
const INSPECTOR_ENTRY = "scripts/audit/domains/nerve-bus-capability/inspector.ts";

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) result.push(full);
    }
  }
  walk(dir);
  return result;
}

function readAll(files: string[]): string {
  return files.map((f) => {
    try { return readFileSync(f, "utf-8"); } catch { return ""; }
  }).join("\n");
}

function getDirectChildren(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export async function nerveBusCapabilityInspector(context: InspectorContext): Promise<InspectorResult> {
  void context; // context available for future enforcement matrix checks
  const findings: Finding[] = [];

  const sourceFiles = collectFiles(NERVE_BUS_SOURCE_DIR);
  const auditFiles = collectFiles(NERVE_BUS_AUDIT_DIR);
  const sourceContent = readAll(sourceFiles);
  const children = getDirectChildren(NERVE_BUS_SOURCE_DIR);

  // Q1: Source file count ≤ NERVE_BUS_MAX_SOURCE_FILES
  if (sourceFiles.length > NERVE_BUS_MAX_SOURCE_FILES) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: NERVE_BUS_SOURCE_DIR,
      line: 1,
      severity: "fatal",
      message: `Nerve Bus source file count (${sourceFiles.length}) exceeds limit of ${NERVE_BUS_MAX_SOURCE_FILES}. Delete over-engineering.`,
    }));
  }

  // Q2: Audit file count ≤ NERVE_BUS_MAX_AUDIT_FILES
  if (auditFiles.length > NERVE_BUS_MAX_AUDIT_FILES) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: NERVE_BUS_AUDIT_DIR,
      line: 1,
      severity: "fatal",
      message: `Nerve Bus audit file count (${auditFiles.length}) exceeds limit of ${NERVE_BUS_MAX_AUDIT_FILES}.`,
    }));
  }

  // Q3: Active children only contain allowed children
  const illegalChildren = children.filter(
    (c) => !(NERVE_BUS_ALLOWED_CHILDREN as readonly string[]).includes(c),
  );
  for (const illegal of illegalChildren) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: `${NERVE_BUS_SOURCE_DIR}/${illegal}`,
      line: 1,
      severity: "fatal",
      message: `Illegal child directory "${illegal}" found. Active children must be: ${NERVE_BUS_ALLOWED_CHILDREN.join(", ")}.`,
    }));
  }

  // Q4: No directional children exist
  const foundForbiddenChildren = (NERVE_BUS_FORBIDDEN_CHILDREN as readonly string[]).filter((fc) =>
    children.includes(fc),
  );
  for (const fc of foundForbiddenChildren) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: `${NERVE_BUS_SOURCE_DIR}/${fc}`,
      line: 1,
      severity: "fatal",
      message: `Forbidden directional channel child "${fc}" found. No directional children allowed.`,
    }));
  }

  // Q5: No queue/sequence/retry/fallback infrastructure
  const foundInfra = (NERVE_BUS_FORBIDDEN_INFRA_PATTERNS as readonly string[]).filter((p) =>
    sourceContent.toLowerCase().includes(p.toLowerCase()),
  );
  for (const p of foundInfra) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: NERVE_BUS_SOURCE_DIR,
      line: 1,
      severity: "fatal",
      message: `Forbidden infrastructure pattern "${p}" found in nerve-bus source. No queue/sequence/retry/fallback allowed.`,
    }));
  }

  // Q6: No forbidden envelope fields
  const foundEnvelopeFields = (NERVE_BUS_FORBIDDEN_ENVELOPE_FIELDS as readonly string[]).filter((f) =>
    sourceContent.includes(f),
  );
  for (const f of foundEnvelopeFields) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: NERVE_BUS_SOURCE_DIR,
      line: 1,
      severity: "fatal",
      message: `Forbidden envelope field "${f}" found in nerve-bus source. Short-chain fields only.`,
    }));
  }

  // Q7: Nerve Bus does not build prompt body or action plan
  const foundPromptPatterns = (NERVE_BUS_FORBIDDEN_PROMPT_PATTERNS as readonly string[]).filter((p) =>
    sourceContent.includes(p),
  );
  for (const p of foundPromptPatterns) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: NERVE_BUS_SOURCE_DIR,
      line: 1,
      severity: "fatal",
      message: `Forbidden prompt/action-plan pattern "${p}" found. Nerve Bus must not build prompt body or action plan.`,
    }));
  }

  // Q8: Nerve Bus does not import AI/browser/Forensics/Orchestration private runtime
  const foundForbiddenImports = (NERVE_BUS_FORBIDDEN_IMPORTS as readonly string[]).filter((imp) =>
    sourceContent.includes(imp),
  );
  for (const imp of foundForbiddenImports) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: NERVE_BUS_SOURCE_DIR,
      line: 1,
      severity: "fatal",
      message: `Forbidden import path "${imp}" found in nerve-bus source. Transport layer must not import AI/browser/Forensics/Orchestration internals.`,
    }));
  }

  return finalizeInspectorResult({
    inspector: "GrassEye Nerve Bus Capability Owner Inspector",
    inspectorId: INSPECTOR_ID,
    capabilityDomain: CAPABILITY_DOMAIN,
    findings,
    phases: [
      {
        name: "nerve-bus-governance",
        classification: findings.length === 0 ? "PASS" : "CODE VIOLATION",
        passed: findings.length === 0,
        summary: findings.length === 0
          ? `Nerve Bus passed all ${8} governance checks`
          : `Nerve Bus failed with ${findings.length} violation(s)`,
      },
    ],
    summary: findings.length === 0
      ? "nerve-bus owner inspector passed all governance checks: file count, children, infra patterns, envelope fields, prompt boundary, import boundary"
      : `nerve-bus owner inspector found ${findings.length} governance violation(s)`,
  });
}
