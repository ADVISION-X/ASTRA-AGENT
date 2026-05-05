# LAW_CHANGE_APPLICATION_REQUIRED_OPEN_LOCAL_PROGRAM

## Reason

The current Open law and blueprint freeze `open-local-workbench` as the third required Open child. That child is legally and technically bound to local workbench / localhost / real Chrome session semantics.

The requested third map requires local program semantics:

```txt
open-local-program
targetKind: local-program
platformId: iphone-mirroring-local
programName: iPhone Mirroring
```

Using `open-local-workbench` to open iPhone Mirroring would violate the current law because it would overload a localhost workbench child with macOS application-opening behavior.

## Frozen Law Constraint

`docs/法案辅助文件/GrassEye Open 能力组施工图.md` states:

```txt
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
```

Because this repository currently treats the Open law as frozen, the implementation must not silently rewrite the law and code in this turn.

## Requested Law Correction

Approve one of the following before code implementation:

### Preferred

Replace `open-local-workbench` with `open-local-program` as the third Open child:

```txt
open-tiktok
open-facebook
open-local-program
```

`open-local-program` remains under the existing `open` ability group and uses the unified Open runtime. It opens only governed allowlisted local application targets such as iPhone Mirroring.

### Acceptable Alternative

Add `open-local-program` as a new Open child and deprecate `open-local-workbench` for map usage, while keeping local workbench startup outside business maps.

## Required Semantics After Approval

- No new ability group.
- No second Open runtime.
- No startup/local shell/platform adapter ownership of Open truth.
- No shell, osascript, AppleScript, raw command, raw prompt, or script in map packages.
- Local program targets must use a governed application target profile gate.
- Local program opening must use an Open-owned port such as `OpenLocalProgramPort`.
- Local program branch must not run web URL safety as if it were Chrome navigation.
- `requiresRealChromeSession` must be false for local program targets.
- `allowsLocalhost` must be false for local program targets.
- Open success must include a local program / window / page-state-equivalent handoff ref.
- Open success must not claim Facebook App is open.

## Blocked Implementation

Until the law correction is approved, code changes for:

- `src/capabilities/open/children/open-local-program/**`
- Open runtime local-program branch
- iPhone Mirroring Facebook built-in map package
- Open and map negative-proof enforcement for local-program targets

are intentionally blocked to avoid implementing a legally inconsistent Open child.
