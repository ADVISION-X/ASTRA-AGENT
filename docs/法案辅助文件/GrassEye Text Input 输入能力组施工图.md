# GrassEye Text Input 输入能力组施工图

## 1. 定位

Text Input 是 GrassEye 的正式独立能力组。

它不是大脑，不是眼睛，不是手指，也不是裁判。

它只负责把已批准的文本写入已验证的输入目标。

## 2. 主权边界

Text Input 只拥有以下职责：

- 接收已批准文本与已验证输入目标。
- 根据 childCapabilityId 执行 type、paste、clear、replace、press-key、commit。
- 通过受治理输入原语端口落地写入。
- 生成 text-input runtime proof 与统一结果。

Text Input 不拥有以下职责：

- 生成文本。
- 推断输入框位置。
- 判断目标是否安全、可见、已激活。
- 判断页面最终是否接受了输入结果。
- 管理浏览器会话、cookie、token 或持久化剪贴板真相。

## 3. 标准包结构

Text Input 必须采用标准能力组包：

```txt
src/capabilities/text-input/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── runtime/
├── ports/
│   ├── text-input-execution-port.ts
│   ├── clipboard-port.ts
│   └── text-input-clock-port.ts
├── shared/
└── children/
    ├── type-text/
    ├── paste-text/
    ├── clear-input/
    ├── replace-input/
    ├── press-key/
    └── commit-input/
```

## 4. 运行链

统一执行链固定为：

1. ability-group 解析输入。
2. registry 解析 childCapabilityId。
3. runtime gate 校验 approved text、verified target、policy 与 payload budget。
4. executor 通过受治理端口执行输入原语。
5. result builder 生成统一 output 与 runtime proof。

## 5. 端口边界

- TextInputExecutionPort 负责真实输入执行。
- ClipboardPort 只在 paste-text 子能力下作为从属端口使用。
- TextInputClockPort 是唯一时间来源。

公共 contract 不得暴露 BrowserController、AppleScript、JXA、clipboard 原始结果或底层浏览器 action 结构。

## 6. 与相邻能力组的边界

- Visual Target 负责找到输入目标，不负责写字。
- Geometry Guard 负责几何合法化，不负责写字。
- Mouse Click 负责点击，不负责写字。
- Page State 负责页面状态真相，不负责写字。
- Post-action Verification 负责验证输入结果，不负责写字。

## 7. 审计闭环

Text Input 必须拥有独立 audit domain：

- manifest.json
- inspector.ts
- required-shape.ts
- forbidden-shape.ts
- boundary-attack.ts
- anti-escape.ts
- negative-proof-harness.ts

验收只认 law -> manifest -> generated artifacts -> inspector -> audit runner。

## 8. 相邻蓝图引用修正

MISSING_REFERENCE:

- docs/法案辅助文件/GrassEye Visual Target 视觉目标能力组施工图.md
- docs/法案辅助文件/GrassEye Geometry Guard 能力组施工图.md

当前仓库实际有效文件名分别为：

- docs/法案辅助文件/GrassEye Visual Target 视觉目标定位能力组施工图.md
- docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md