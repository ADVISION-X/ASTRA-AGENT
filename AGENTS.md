# Codex Governance Entry

本仓库使用冻结的法案系统。

1. READ_ONLY 直接读取并回答，不落盘、不加锁、不建立 runtime 任务事务。
2. CHANGE 首次目标写入前只建立三字段 change record，并运行只读 `governance:entry`。
3. 修改不得超出 change record；扩大范围必须先更新同一 record。
4. READY 不等于 RELEASE；不得以静态检查、普通测试或部分证据冒充生产发布。
5. RELEASE 才绑定完整 candidateId，并执行全部 active law 声明的 Dynamic Proof。
6. 只允许一份 active law corpus、一份 law registry；每个生产路径和合同只允许一个 primary Owner；只允许一个 quality verdict。
7. 迁移桥、用于迁移的 feature flag、dual-read/write 或 shadow traffic 必须有 Owner、监控、期限、删除日期和删除验收。
8. active law 只在明确人类授权下修改。
9. 任一 finding、候选漂移、错误证据类型或伪 PASS 必须失败关闭。
