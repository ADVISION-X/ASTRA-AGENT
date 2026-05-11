# GrassEye PlatformRegistry 平台资料施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义平台资料层，不定义动作链，不定义地图生命周期。

Owner boundary: open-capability
Consumers: commander-console-capability, ai-capability, orchestration-capability

## Retired Vocabulary Table

| 抽象词 | 代表性禁止口径 |
| --- | --- |
| retired branch-token field | retired AI branch token |
| legacy route-plan field | retired route identifier |
| retired selection field | retired binding selection identifier |
| retired binding field | retired binding snapshot identifier |
| retired package chain | retired package-governance chain |
| retired template flow | retired template entry flow |

## PlatformProfile

```ts
type PlatformProfile = {
  platformId: "facebook-web" | "tiktok-web";
  displayName: string;
  entryUrl: string;
  targetTitle: string;
  allowedHosts: string[];
  defaultRecoveryActionCode: "OPEN_FACEBOOK_ENTRY" | "OPEN_TIKTOK_ENTRY";
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
