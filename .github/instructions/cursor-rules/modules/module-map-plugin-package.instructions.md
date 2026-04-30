---
name: "GrassEye Map Plugin Package Governance"
description: "Use when defining controlled declarative operational-map packages, task-template packages, import/quarantine/activation/rollback flow, and map-package enforcement boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md, src/map-plugins/**, docs/法案辅助文件/GrassEye 地图插件包治理施工图.md, docs/why/map-plugin-package.WHY.md, scripts/audit/domains/map-plugin-package/**"
---

# GrassEye Map Plugin Package Governance

Scope: governs declarative operational-map packages, task-template packages, package lifecycle, and no-code plugin enforcement.
Boundary: this module governs controlled pluggable map packages only.
Excludes: ability-group ownership, runtime code plugins, direct capability execution, and authority reassignment away from Orchestration.
Authority: this file is authoritative only for the map-plugin-package governance domain.

## Law GRASSEYE-MAP-PLUGIN-001-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map plugins are declarative data packages consumed by Orchestration, not runtime code or child capabilities.

### 法条

Map plugins are declarative data packages consumed by Orchestration. They are not runtime code, not ability plugins, and not new owners.

Required direction:
- map packages are not child capabilities and do not expand the frozen ability-group constitution.
- the registry governs import, quarantine, validation, approval, activation, rollback, and active-read access only.
- the registry must not become the execution owner of mission flow, step dispatch, or branch decisions.
- builtin map packages must pass the same import, quarantine, validation, approval, and activation pipeline shape as non-builtin packages.

FORBIDDEN:
- map packages being modeled as child abilities or public owners.
- the registry executing abilities, mutating mission state, or dispatching steps.
- builtin packages bypassing governed lifecycle stages by using a private side door.

## Law GRASSEYE-MAP-PLUGIN-002-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map plugins must enter quarantine on import and cannot become active without validation and approval.

### 法条

Imported map packages must enter quarantine first and cannot become active without validation, approval, and activation records.

## Law GRASSEYE-MAP-PLUGIN-003-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map plugins must declare full package governance metadata and own their package schemas.

### 法条

Map plugins must declare manifest, task template, operational map, dependencies, compatibility, policy, and prompt bindings.

Required direction:
- map-plugin package schemas must be owned under src/map-plugins/schema.
- package schema validation may mirror Orchestration execution contracts, but it must not depend on Orchestration static map truth or import legacy static map modules as authoritative input.

FORBIDDEN:
- operational-map-package schema importing Orchestration-owned static map truth as the package authority.

## Law GRASSEYE-MAP-PLUGIN-004-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map plugins must never carry executable payloads or direct ability control.

### 法条

Map plugins must never contain executable code, dynamic imports, JS or TS handlers, shell scripts, eval strings, or direct ability calls.

## Law GRASSEYE-MAP-PLUGIN-005-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map plugins expose task-template UX while keeping internal runtime identifiers private in ordinary mode.

### 法条

Map plugins expose user-facing task templates, while mapId, stepId, and childCapabilityId remain developer or internal fields.

Required direction:
- ordinary task feeds must expose runnable task-template records without requiring ordinary UI consumers to read mapId or requestedPlatformId as the start key.
- developer feeds may expose packageId, activationId, mapId, dependency chains, validation findings, and internal runtime identifiers.

FORBIDDEN:
- ordinary-mode UI depending on mapId or requestedPlatformId fields as its primary public task-template contract.

## Law GRASSEYE-MAP-PLUGIN-006-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: AI-generated maps are draft-only until validation and human approval.

### 法条

AI-generated maps remain draft-only and must not execute until validation and human approval complete.

## Law GRASSEYE-MAP-PLUGIN-007-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map package enforcement closes through the map-plugin-package inspector and audit runner scripts.

### 法条

Map package enforcement closes through the map-plugin-package inspector, its negative-proof harness, and audit-runner-compatible governance scripts.

## Law GRASSEYE-MAP-PLUGIN-008-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Map packages may reference prompt contracts but must not embed raw prompt logic or hidden runtime instructions.

### 法条

Map packages may reference promptContractId and prompt binding metadata, but they must not embed raw prompt text, executable prompt logic, or hidden runtime instructions.

## Law GRASSEYE-MAP-PLUGIN-009-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: AI-generated map packages must be authored against governed catalogs.

### 法条

AI-generated map packages must be built against the machine-readable capability catalog and prompt contract catalog.

## Law GRASSEYE-MAP-PLUGIN-010-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: Every AI step must bind to a governed prompt contract package.

### 法条

Every AI step in a map must bind to a valid prompt contract, requiredInputRefs, outputSchemaRef, review policy, and failure branch.

## Law GRASSEYE-MAP-PLUGIN-011-V1

status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: manual-first
evidenceMode: law

summary: AI-generated map packages remain draft-only until all governance gates pass.

### 法条

AI-generated map packages are draft-only until schema validation, capability validation, prompt contract validation, safety validation, and human approval all pass.