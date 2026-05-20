import type { Project, SourceFile } from "ts-morph";

import type {
  Finding,
  InspectorPhase,
} from "../../../core/schema.js";

export type DomAutomationValidationResult = {
  phase: InspectorPhase;
  findings: Finding[];
  coveredClauseIds: readonly string[];
};

export type DomAutomationAuditProject = {
  project: Project;
  sourceFiles: {
    dom: SourceFile[];
    domRuntime: SourceFile[];
    domContracts: SourceFile[];
    plugin: SourceFile[];
    visualMission: SourceFile[];
    browser: SourceFile[];
    muscleMemory: SourceFile[];
    acceptance: SourceFile[];
  };
};
