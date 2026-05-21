# GrassEye 本地取证存储结构施工图

版本：2026-05-21  
状态：active

## 1. 当前存储分层

当前本地持久化分成两层：

### 1.1 Amazon 任务记录

```txt
<dataDir>/plugin-tasks/amazon-invoice-upload/<taskId>/task.json
```

保存：

- mission payload
- 当前状态
- reachedStep
- reason
- createdAt / updatedAt

### 1.2 通用 evidence store

```txt
<dataDir>/forensics/records-<runId>.ndjson
<dataDir>/forensics/artifacts.ndjson
```

保存：

- append-only record envelope
- append-only artifact envelope
- integrity hash

## 2. 当前批准 PDF 落点

当前已批准 PDF 文件由 Amazon 任务服务保存到：

```txt
~/Downloads/invoice/<amazonOrderId>.pdf
```

## 3. 当前原则

- 任务状态和 evidence 分层
- storage adapter 保持通用
- 不让业务模型污染底层存储 schema
- 不引入第二套 persistence truth

## 4. 当前不做的事

- 不做复杂关系数据库宇宙
- 不做旧 owner ledger 系统
- 不在 storage 层重建业务流程