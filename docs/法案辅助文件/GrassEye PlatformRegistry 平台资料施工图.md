# GrassEye PlatformRegistry 平台资料施工图

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
