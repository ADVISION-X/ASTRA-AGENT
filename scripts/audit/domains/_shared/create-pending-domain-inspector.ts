import path from "node:path";

import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase, finalizeInspectorResult, resolveClassification } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { DomainInspector, Finding, InspectionClassification, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { runDomainOwnerInspection } from "./run-domain-owner-inspection.js";

interface ExtraCheckResult {
  findings?: Finding[];
  phases?: InspectorPhase[];
}

interface PendingInspectorOptions {
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
}

export const createPendingDomainInspector = (options: PendingInspectorOptions): DomainInspector => {
  const inspector: DomainInspector = async (context) => {
    const base = await runDomainOwnerInspection(context, {
      capabilityDomain: options.capabilityDomain,
      inspectorId: options.inspectorId,
      inspectorEntry: options.inspectorEntry,
    });

    const findings = [...base.findings];
    const phases = [...base.phases];
    const ownedPathExists = (
      await Promise.all(
        options.ownedPaths.map(async (ownedPath) => {
          const absolutePath = pathFromRepoRoot(ownedPath);
          if (!(await fileExists(absolutePath))) {
            return false;
          }

          if (path.extname(ownedPath).length > 0) {
            return true;
          }

          const files = await listFilesRecursive(absolutePath, { extensions: [".ts", ".tsx", ".md", ".json"] });
          return files.length > 0;
        }),
      )
    ).some(Boolean);

    const cleanClassification = ownedPathExists
      ? options.implementedClassification ?? "PASS"
      : options.cleanClassification ?? "ENFORCEMENT GAP";
    phases.push(
      createPhase(
        "implementation-window",
        cleanClassification,
        cleanClassification === "PASS",
        ownedPathExists
          ? options.implementedSummary ?? options.cleanSummary ?? "implemented owner surface exists and is ready for direct checks"
          : options.pendingSummary,
      ),
    );

    if (options.extraChecks) {
      const extra = await options.extraChecks(context);
      findings.push(...(extra.findings ?? []));
      phases.push(...(extra.phases ?? []));
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