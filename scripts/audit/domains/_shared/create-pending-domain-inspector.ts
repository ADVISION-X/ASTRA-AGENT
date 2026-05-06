import path from "node:path";

import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase, finalizeInspectorResult, resolveClassification } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { DomainInspector, Finding, InspectionClassification, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { runDomainOwnerInspection } from "./owner-foundation-inspection.js";

const logDomain = (domain: string, message: string): void => {
  process.stdout.write(`  [${domain}] ${message}\n`);
};

type ExtraCheckResult = {
  findings?: Finding[];
  phases?: InspectorPhase[];
};

type PendingInspectorOptions = {
  inspector: string;
  inspectorId: string;
  capabilityDomain: string;
  inspectorEntry: string;
  ownedPaths: string[];
  pendingSummary: string;
  extraChecks?: (context: InspectorContext) => Promise<ExtraCheckResult>;
  cleanClassification?: InspectionClassification;
  cleanSummary?: string;
  implementedClassification?: InspectionClassification;
  implementedSummary?: string;
};

const ownedPathHasTrackedFiles = async (ownedPath: string): Promise<boolean> => {
  const absolutePath = pathFromRepoRoot(ownedPath);
  if (!(await fileExists(absolutePath))) {
    return false;
  }

  if (path.extname(ownedPath).length > 0) {
    return true;
  }

  const files = await listFilesRecursive(absolutePath, { extensions: [".ts", ".tsx", ".md", ".json"] });
  return files.length > 0;
};

const findOwnedPathExists = async (ownedPaths: string[]): Promise<boolean> => {
  const states = await Promise.all(ownedPaths.map((ownedPath) => ownedPathHasTrackedFiles(ownedPath)));
  return states.some(Boolean);
};

const resolveImplementationPhase = (
  options: PendingInspectorOptions,
  ownedPathExists: boolean,
): InspectorPhase => {
  const classification = ownedPathExists
    ? options.implementedClassification ?? "PASS"
    : options.cleanClassification ?? "ENFORCEMENT GAP";

  return createPhase(
    "implementation-window",
    classification,
    classification === "PASS",
    ownedPathExists
      ? options.implementedSummary ?? options.cleanSummary ?? "implemented owner surface exists and is ready for direct checks"
      : options.pendingSummary,
  );
};

export const createPendingDomainInspector = (options: PendingInspectorOptions): DomainInspector => {
  const inspector: DomainInspector = async (context) => {
    logDomain(options.capabilityDomain, "checking owner-foundation...");
    const base = await runDomainOwnerInspection(context, {
      capabilityDomain: options.capabilityDomain,
      inspectorId: options.inspectorId,
      inspectorEntry: options.inspectorEntry,
    });
    logDomain(options.capabilityDomain, `owner-foundation → ${base.phases[0]?.classification ?? "PASS"}`);

    const findings = [...base.findings];
    const phases = [...base.phases];
    logDomain(options.capabilityDomain, "checking owned paths...");
    const ownedPathExists = await findOwnedPathExists(options.ownedPaths);
    phases.push(resolveImplementationPhase(options, ownedPathExists));
    logDomain(options.capabilityDomain, `owned paths → ${ownedPathExists ? "implemented" : "pending"}`);

    if (options.extraChecks) {
      logDomain(options.capabilityDomain, "running extra checks...");
      const extra = await options.extraChecks(context);
      const extraPhases = extra.phases ?? [];
      const extraFindings = extra.findings ?? [];
      findings.push(...extraFindings);
      phases.push(...extraPhases);
      const failedPhase = extraPhases.find((p) => p.classification !== "PASS");
      logDomain(
        options.capabilityDomain,
        failedPhase
          ? `extra checks → ${failedPhase.classification} (${extraFindings.length} finding(s), ${extraPhases.length} phase(s))`
          : `extra checks → PASS (${extraPhases.length} phase(s))`,
      );
    }

    const classification = resolveClassification(findings, phases);
    const summary =
      phases.find((phase) => phase.classification !== "PASS")?.summary ??
      phases.at(-1)?.summary ??
      options.pendingSummary;

    return finalizeInspectorResult({
      inspector: options.inspector,
      inspectorId: options.inspectorId,
      capabilityDomain: options.capabilityDomain,
      findings,
      phases,
      classification,
      summary,
    });
  };

  return inspector;
};