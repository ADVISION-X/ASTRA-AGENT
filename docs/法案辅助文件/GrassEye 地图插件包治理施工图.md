# GrassEye 地图插件包治理施工图

## 架构定位

GrassEye 采用 Static Capability Package Architecture 加 Controlled Pluggable Map Package Architecture。

能力组保持静态冻结、受法案治理。

可拔插的是地图数据包，不是能力代码。

## map package 文件结构

```txt
grass-map-plugin/
├── manifest.json
├── task-template.json
├── operational-map.json
├── dependencies.json
├── compatibility.json
├── policy.json
├── prompt-bindings.json
├── changelog.md
└── signature.json
```

## schema

必须包含：

- MapPluginManifestSchema
- TaskTemplatePackageSchema
- OperationalMapPackageSchema
- MapDependenciesSchema
- MapCompatibilitySchema
- MapPolicySchema
- PromptBindingsSchema
- MapPackageSchema

## lifecycle

- import
- quarantine
- validation
- human approval
- activation
- active registry
- rollback

## Prompt Binding

地图包可以声明 promptBindings，但 promptBindings 只描述 stepId 和 promptContractId 的绑定关系，不拥有 prompt 内容。

每个 AI step 至少要有：

- promptContractId
- requiredInputRefs
- expectedOutputSchema
- confidencePolicy
- reviewPolicy
- failureBranch

## Prompt Contract Reference

Map package 可以引用 Prompt Contract Catalog，但不得内嵌 raw prompt、systemPrompt、userPrompt 或 executablePromptLogic。

## AI-generated Map Authoring

AI-generated map 只能由 authoring prompt builder 生成候选 JSON，不得直接成为 active map。

## Capability Catalog Dependency

AI-generated map 必须基于 machine-readable capability catalog 生成，不得编造 unknown ability groups、child capabilities 或 supportedTargets。

## No Raw Prompt in Map

- 禁止 rawPrompt
- 禁止 systemPrompt
- 禁止 userPrompt
- 禁止 promptFullText

## No Executable Prompt Logic

- 禁止 handler
- 禁止 script
- 禁止 function body
- 禁止运行时代码

## Draft / Quarantine / Validation / Human Approval

AI-generated map 固定流程：draft -> quarantine -> validation -> human approval -> activation。

未通过前：

- 不得 active
- 不得出现在 ordinary runnable task feed
- 不得绕过 validator 与 audit

## validation gates

- schema
- dependencies
- transition closure
- capability registry
- prompt contract
- platform profile
- compatibility
- security
- dry-run

## activation

只有 active approved package 才能被 Orchestration 选择。

激活必须落 activation record。

## rollback

回滚必须保留 rollback record，且恢复上一个 active approved version。

## UI import flow

- 普通用户导入地图包或选择任务模板
- quarantined package 不可启动
- ordinary StartPage 不显示 mapId
- developer Map Manager 展示 package details、validator findings、compatibility、rollback

## Orchestration consumption

Orchestration 只从 active approved registry 读取 map package。

runtime proof 必须写入 packageId、mapVersion、activationId。

## security boundary

- 禁止 .js .ts .mjs .cjs .sh .py
- 禁止 handler、script、eval、exec、shell 字段
- 禁止 raw prompt
- 禁止 direct ability calls
- 禁止 direct Nerve Bus dispatch

## AI draft map future path

AI 只能生成 draft-only map package。

draft package 必须经过验证和人工批准后才能激活。

## enforcement rules

map-plugin-package inspector 必须使用 parsed JSON、AST、import graph、symbol graph，不得用 includes 作为最终裁决。

## negative proof list

- executable file injection
- handler field injection
- quarantine bypass
- approval bypass
- active registry bypass
- prompt raw text injection
- hardcoded fallback map bypass

## READY gate

只有当 map package schema、quarantine、validation、approval、activation、rollback、UI gating、Orchestration consumption、negative proof 全部通过时，地图插件包治理才算 ready。