---
name: "GrassEye Constitutional Boundary"
description: "Governs capability authority entry, facade symbol anti-escape, protocol leakage, and DOM bridge boundary closure."
applyTo: "src/**/*.{ts,tsx,js,jsx,mjs},scripts/**/*.{ts,js,mjs,json},package.json"
---

# GrassEye Constitutional Boundary

status: active
version: 2026-05-27
capabilityDomain: constitutional-boundary

## [APEX-CONSTITUTIONAL-BOUNDARY-001-V1] One Authority Entry Per Capability

```apex-law
{
  "lawId": "APEX-CONSTITUTIONAL-BOUNDARY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "constitutional-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+symbol",
  "summary": "External consumers may use a capability group only through its public facade and may not import private owner internals."
}
```

Required:

- Every `src/capabilities/<owner>` has exactly one public authority entry: `index.ts`.
- External consumers may import only `src/capabilities/<owner>/index.ts`.
- `src/lib/local-runtime/**`, `src/app/**`, `src/mediator/**`, `src/plugins/**`, and `scripts/acceptance/**` are all external consumers.
- One capability owner may not import another owner's private implementation files.

Forbidden:

- Importing `runtime`, `children`, `providers`, `registry`, `schema`, `contract`, `storage-adapter`, or `type-contracts` from outside the owning capability.
- A capability importing plugin-owned code.
- External consumers constructing private owner paths through aliases or re-export laundering.

## [APEX-CAPABILITY-FACADE-SYMBOL-001-V1] Facade Symbol Anti-Escape

```apex-law
{
  "lawId": "APEX-CAPABILITY-FACADE-SYMBOL-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "constitutional-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+symbol",
  "summary": "Capability facades must not leak private implementation symbols through re-export or declaration escape."
}
```

Required:

- Facade export checks resolve each exported symbol to its declaration source file.
- Symbol escape enforcement covers value exports and type-only exports.
- DOM Automation public child function exports remain governed by its own allowlisted facade policy.

Forbidden:

- Re-exporting private runtime, child, provider, or registry symbols through a facade.
- Importing a facade symbol whose declaration lives in a private capability implementation file.

## [APEX-PLUGIN-NO-CAPABILITY-PROTOCOL-001-V1] External Consumers Must Not Build Private Capability Protocols

```apex-law
{
  "lawId": "APEX-PLUGIN-NO-CAPABILITY-PROTOCOL-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "constitutional-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "External consumers must not construct private capability execution protocol objects."
}
```

Required:

- Public capability requests use neutral business fields such as `platform`, `trace`, `missionId`, `runId`, or `roundId`.
- Internal execution protocol fields are created inside the owning capability group.

Forbidden:

- External consumers building execution objects that contain `abilityGroupId`, `childCapabilityId`, `capabilityCallId`, or `artifactDisposition` as private capability protocol.

## [APEX-DOM-AUTOMATION-BRIDGE-001-V1] DOM Primitive Bridge Closure

```apex-law
{
  "lawId": "APEX-DOM-AUTOMATION-BRIDGE-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "constitutional-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+symbol",
  "summary": "Business plugins may not scatter low-level DOM primitive imports; only an allowlisted bridge may import DOM primitives directly."
}
```

Required:

- DOM primitive imports from `src/capabilities/dom-automation/index.ts` are allowed only through the registered business bridge file.
- The allowlisted Amazon invoice upload bridge is `src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts`.

Forbidden:

- Plugin, app, mediator, local-runtime, or acceptance files importing `readDomSnapshotOnce`, `locateDomElementOnce`, `fillDomElementOnce`, `clickDomElementOnce`, `uploadApprovedFileOnce`, `waitForDomStateOnce`, or `verifyDomStateOnce` outside the allowlisted bridge.