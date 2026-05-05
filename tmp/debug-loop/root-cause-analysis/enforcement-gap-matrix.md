# Enforcement Gap Matrix

| Blocker | Inspector file | Negative proof file | Manifest / owner mapping | Current coverage | Gap classification | Why |
| --- | --- | --- | --- | --- | --- | --- |
| BLOCKER-1 | `scripts/audit/domains/map-plugin-package/inspector.ts` | `scripts/audit/domains/map-plugin-package/negative-proof-harness.ts` | `scripts/audit/domains/map-plugin-package/manifest.json`; generated audit plan/matrix | Current worktree calls `runNegativeProofHarness`; previous HEAD returned fake PASS `mutated bypass` | G, C, H | The exact child capability mutation exists, but previously did not execute; startup also does not run the inspector before service import; logs omit package file |
| BLOCKER-2 | same | should add startup preflight mutation | startup owner likely commander-console/bootstrap plus map-plugin-package | Map package inspector validates package shape but launch script has no map readiness gate | C, I | Production launch constructs map registry directly after AI readiness; no audit-enforced startup preflight |
| BLOCKER-3 | no direct coverage found | no direct coverage found | map-plugin-package / startup logging | Schema rejection is covered, but diagnosability is not | H, D | Stderr relay is line-based; loader does not wrap fileName/packageId/ownerResponsible |
| BLOCKER-4 | debug-loop-boundary inspector, startup not covered | debug-loop-boundary negative proof, startup not covered | debug-loop owner only | Debug-loop bundle exists but is stale/unrelated | H, J | Startup failures are not persisted as debug-loop/forensics bundles with correlation ids |

## Evidence: Inspector Bypass Diff

Current worktree:

```txt
scripts/audit/domains/map-plugin-package/inspector.ts:47-58
const runNegativeProofPhase = async () => {
  return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? { ... skipped for nested inspector execution ... }
    : runNegativeProofHarness();
};
```

Previous HEAD:

```txt
HEAD:scripts/audit/domains/map-plugin-package/inspector.ts:47-61
const runNegativeProofPhase = async () => {
  return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? { ... skipped for nested inspector execution ... }
    : Promise.resolve({
        findings: [],
        phase: createPhase("negative-proof-harness", "PASS", true, "mutated bypass"),
      });
};
```

Negative proof has the right mutation:

```txt
scripts/audit/domains/map-plugin-package/negative-proof-harness.ts:56-60
{
  name: "map package modeled as child ability mutation",
  file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
  search: '    "packageKind": "operational-map-package",\n',
  replace: '    "packageKind": "child-capability-package",\n',
}
```

Conclusion:
The law and blueprint were present. The enforcement closure was historically fake for the exact regression class, and startup has no separate package readiness gate. This is not a law gap.
