# GrassEye PlatformRegistry 平台资料施工图

本施工图替代 map-package / task-template / routePlan / routeLabel 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义平台资料层，不定义动作链，不定义地图生命周期。

Owner boundary: open-capability
Consumers: commander-console-capability, ai-capability, orchestration-capability

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

PlatformRegistry 禁止保存：
- routePlanId
- routeLabel
- taskTemplateId
- prompt text
- map lifecycle
- activation snapshot
- action chain
