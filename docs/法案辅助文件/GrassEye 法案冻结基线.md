# GrassEye 法案冻结基线

## 冻结结论

当前法案源头冻结为：

- 11 个 core ability providers
- 2 个 support / transition evidence surfaces
- 1 个 retired surface
- 5 个 foundation laws
- 0 个 support governance domains
- 若干父 owner 子契约法案

与 GRASSEYE-KERNEL 当前阶段（phase-five final-delivery debugging）和简单能力机器公式保持一致：

```
GrassEye = User Requirement + Platform Registry + MuscleMemoryCatalog
         + AI + Orchestration + Nerve Bus + Capability Groups
         + Forensics Persistence + Commander Console
```

## Core ability providers（11 个）

1. commander-console
2. orchestration
3. nerve-bus
4. ai
5. open
6. screenshot
7. geometry-guard
8. mouse-click
9. text-input
10. mouse-scroll
11. forensics-persistence

## Support / transition evidence surfaces（2 个）

These surfaces provide observation packaging and visual target coordination.
They are NOT independent active ability groups and must NOT register as
active CI owners.

1. visual-target — non-executable visual candidate packaging; no geometry ownership
2. post-action-verification — observation packaging and before/after evidence binding only;
   final semantic judgment belongs to the next AI round, not PAV

## Retired surfaces（1 个）

These must NOT exist as `src/capabilities/<name>` or as active CI owners.

1. page-state — retired; raw browser observation belongs to
   `src/lib/browser/browser-observation.ts` as non-owner support evidence only

## 5 个 foundation laws

1. audit-system
2. capability-group-governance
3. code-purity
4. type-safety
5. security-privacy

## 0 个 support governance domains

## 本地开发治理 allowlist

1. debug-loop-boundary

## 本地开发工具

- debug-loop-controller

## 子契约归属表

| 子契约 | 父 owner | 是否 active owner | inspector 归属 |
| --- | --- | --- | --- |
| local-ai-runtime | ai-capability | 否 | ai-capability |
| local-browser-session | open-capability | 否 | open-capability |
| local-app-shell | commander-console-capability | 否 | commander-console-capability |
| startup-entrypoint | commander-console-capability | 否 | commander-console-capability |
| structured-logging | forensics-persistence-capability | 否 | forensics-persistence-capability |
| local-persistence-schema | forensics-persistence-capability | 否 | forensics-persistence-capability |
| platform-action | open-capability | 否 | open-capability |
| code-topology | capability-group-governance | 否 | capability-group-governance |
| code-purity | audit-system | 否 | audit-system |

## 已删除 active owner

- local-data
- localization
- platform-action as action owner
- local-ai-runtime as independent owner
- local-browser-session as independent owner
- local-app-shell as independent owner
- startup-entrypoint as independent owner
- structured-logging as independent owner

structured-logging is governedBy capability-group-governance as a shared law boundary, but its parent owner remains forensics-persistence-capability.
- local-persistence-schema as independent owner
- multi-frame-evidence as independent owner
- code-topology as independent owner
- code-purity as independent owner

## 后续执法系统同步原则

后续 audit/generated registry、matrix、audit-plan、phase-gate、manifest、inspector 必须以本冻结基线为唯一源头。

- 不得用旧 owner 恢复 CI。
- 不得为了 CI 恢复 deleted owner。
- 不得手写 generated 文件伪造通过。
- 不得让 runner 执行不在冻结基线中的独立 owner。
- phase gate 的 activeLawDomains 不得超出本冻结基线 active law domains。
- localDevelopmentGovernanceDomains 只能列出本冻结基线 allowlist 中的本地开发治理域，且不得进入 generated audit plan。
