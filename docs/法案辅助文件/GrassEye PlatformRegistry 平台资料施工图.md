# GrassEye PlatformRegistry 平台资料施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义平台资料层，不定义动作链，不定义地图生命周期。

Owner boundary: open-capability
Consumers: commander-console-capability, ai-capability, orchestration-capability

## Retired Vocabulary Table

| 抽象词 | 实际禁止字段 |
| --- | --- |
| retired branch-token field | routeLabel |
| legacy route-plan field | routePlanId |
| retired selection field | selectedMapId / selectedMapVersion |
| retired binding field | activationId / activationSnapshotRef |
| retired package chain | mapPackageId / mapPackageVersion / map-plugin-package |
| retired template flow | taskTemplateId / taskTemplate |

## PlatformProfile

```ts
type PlatformProfile = {
  platformId: "facebook-web" | "tiktok-web";
  displayName: string;
  entryUrl: string;
  targetTitle: string;
  allowedHosts: string[];
  defaultRecoveryActionCode: "REOPEN_ENTRY_PAGE";
  supportedActionCodes: string[];
};
```

## 硬边界

PlatformRegistry 只保存环境资料：
- entryUrl
- targetTitle
- allowedHosts
- supportedActionCodes

supportedActionCodes is an allowlist hint only.
It is not a route.
It is not a recipe.
It is not an action chain.
It is not an execution plan.
MuscleMemoryCatalog remains the only actionCode authority.

PlatformRegistry 禁止保存：
- legacy route-plan field
- retired branch-token field
- legacy template field
- prompt text
- legacy package lifecycle
- retired binding state
- action chain
