# GrassEye 本地模型选型施工图 FINAL

## 文件身份

- owner: ai-capability
- authority: .github/instructions/cursor-rules/modules/module-ai-capability.instructions.md
- subAuthority: .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md
- status: active
- purpose: 说明当前阶段唯一有效的本地模型路径与配置原则

## 一句话原则

当前阶段不做多 provider 选型，只保留一个受治理本地模型路径供 visual-mission-judge-once 使用。

## 当前有效口径

- active child capability: visual-mission-judge-once
- active task type: visual_mission_judgment
- active prompt contract: visual-mission-judge-v1
- active model path: local model call
- config source: config/local-ai.models.json

## 模型选择原则

当前阶段只要求：
- 模型必须来自本地配置
- provider 必须是 local
- executionMode 必须是 local-only
- allowCloudFallback 必须是 false
- paid/future provider 不进入生产主链

推荐方向：
- 视觉判断使用当前本地视觉模型配置
- 文字和 OCR 角色不作为 AI child 真相公开暴露
- 若本地模型不可用，返回 failed 或 review_required，不做 fallback

## 不再承认的旧结构

以下结构不再是当前阶段真相：
- visual-observation / ocr-extraction / text-reasoning 作为公开 child
- provider roster
- provider registry
- paid provider policy gate
- future provider gate
- role control panel 作为 AI 主链

## 验收信号

建对表现：
- 配置只服务单一本地模型主线
- 无 cloud / paid / future fallback
- 运行失败直接显式返回失败原因

漂移信号：
- 新增 provider allowlist 生产链
- 新增 paid/future provider 生产 child
- 通过兼容桥或别名偷偷保留旧 provider 体系
- 用多模型路由替代单一受治理本地调用
