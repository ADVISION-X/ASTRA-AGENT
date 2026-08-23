# GrassEye Evidence Store 取证记账施工图

版本：2026-05-21  
状态：active

## 1. 当前定位

Forensics Persistence 已收缩为简单 evidence store。

它写入：

- step trace
- DOM snapshot ref
- screenshot ref
- upload result
- failure reason
- artifact ref

## 2. 它不再负责

- owner universe
- 多层审计矩阵
- 流程控制
- AI 判断真相
- 业务分支

## 3. 当前调用链

```txt
flow script -> evidence store -> generic file storage
```

## 4. 当前必须保留的记录字段

- `missionId` 或 `taskId`
- `stepId`（如果有）
- `status`
- `reason`
- `artifactRefs`
- `createdAt`

## 5. 当前存储原则

- append-first
- traceable
- 不静默成功
- 不静默失败
- 记录已经由其他层决定的事实，不反推流程真相

## 6. Amazon 主线中的职责

- 保存任务步骤状态
- 保存失败原因
- 保存上传结果 ref
- 让人工接管时能看到发生了什么

## 7. Audit owner

唯一 owner 位于 `scripts/audit/domains/forensics-persistence-capability/`。它检查 public facade、append-first storage port、业务插件反向依赖和退休 schema 词汇，不借用其他 domain 的 inspector。

## 8. Acceptance

`scripts/acceptance/forensics-persistence-capability.acceptance.ts` 使用临时目录调用真实 storage 与真实 ability group，证明 record/artifact ref、integrity hash、append-only 落盘和 artifact body 不进入索引。完整入口仍是 `npm run ci:full`。
