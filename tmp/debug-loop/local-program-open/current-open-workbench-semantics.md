# Current Open Workbench Semantics

## Finding

Current Open law, blueprint, registry, schema, runtime gates, and generated capability catalog define `open-local-workbench` as a local workbench / localhost target, not as a macOS local program opener.

## Evidence

- `.github/instructions/cursor-rules/modules/module-open-capability.instructions.md` lists required children as:
  - `open-tiktok`
  - `open-facebook`
  - `open-local-workbench`
- The same law text says active child capabilities are `open-tiktok`, `open-facebook`, and `open-local-workbench`, and states: "Local workbench may allow localhost only through its own governed target profile."
- `docs/法案辅助文件/GrassEye Open 能力组施工图.md` defines the child table as:
  - `open-local-workbench`
  - target: `local workbench`
  - platform: `local-workbench`
  - special rule: `localhost allowed only by profile`
- `src/capabilities/open/registry.ts` currently registers:
  - `childCapabilityId: "open-local-workbench"`
  - `targetKind: "local-workbench"`
  - `platformId: "local-workbench"`
  - `defaultUrl: "http://127.0.0.1:3000"`
  - `requiresRealChromeSession: true`
  - `allowsLocalhost: true`
- `src/capabilities/open/children/open-local-workbench/contract.ts` binds:
  - `OPEN_LOCAL_WORKBENCH_ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1"]`
  - `OPEN_LOCAL_WORKBENCH_REQUIRES_REAL_CHROME_SESSION = true`
- `src/capabilities/open/children/open-local-workbench/schema.ts` requires:
  - `platformId: "local-workbench"`
  - `targetKind: "local-workbench"`
  - `allowedHostnames: ["localhost", "127.0.0.1"]`
- `src/capabilities/open/runtime/open-input-gate.ts` accepts only:
  - `open-tiktok`
  - `open-facebook`
  - `open-local-workbench`
  and target kinds:
  - `platform-feed`
  - `local-workbench`
- `src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json` exposes `open-local-workbench` with `open.open-local-workbench.input` and `open.open-local-workbench.output`.

## Semantic Conflict

This is inconsistent with the requested third map:

```txt
Open macOS local program: iPhone Mirroring
-> inside mirrored iPhone, open Facebook App
-> execute seeding video discovery through visual / geometry / click / scroll / screenshot / AI / forensics chain
```

`open-local-workbench` cannot honestly represent this flow because it currently means:

```txt
Open localhost workbench URL in a real Chrome session
```

## Required Correction

- Do not keep pretending iPhone Mirroring is a local workbench.
- Do not use `open-facebook` web mode for the iPhone Mirroring Facebook App map.
- Do not use `facebook-web`, `m.facebook.com`, Chrome DOM/BOM, cookie, localStorage, or any web URL fallback for the third map.
- The correct Open child should be `open-local-program` or a narrower `open-iphone-mirroring` child governed under the existing Open ability group.
- Open may only prove that iPhone Mirroring was opened and handed off as an observable local program/window target.
- Facebook App visibility and interaction must be handled by existing visual-target, geometry-guard, mouse-click, mouse-scroll, screenshot, page-state, post-action-verification, AI, and forensics-persistence ability groups.
