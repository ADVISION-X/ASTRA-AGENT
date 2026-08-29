网站任务只有“成功交付并入库”才算完成。任何一次执行失败，都只是故障现场，不是任务终点。

# Codex Governance Entry

本仓库使用冻结的法案系统。

1. READ_ONLY 直接读取并回答，不写入任何文件。
2. CHANGE 开始修改前只读查看目标路径的 Git 状态，不得覆盖、删除、恢复或移动未获授权的用户改动。
3. CHANGE 的实际差异必须与授权人的请求及完成该请求不可分割的直接关联对象一致。
4. READY 不等于 RELEASE；静态检查、普通测试或部分证据不得被认定为已经完成生产发布。
5. READY、RELEASE 使用原生 clean Git commit；RELEASE 执行全部 active law 声明的 Dynamic Proof。
6. 只允许一份 active law corpus、一份 law registry；每个生产路径和合同只允许一个 primary Owner；只允许一个 quality verdict。
7. 迁移桥、用于迁移的 feature flag、dual-read/write 或 shadow traffic 必须有 Owner、监控、期限、删除日期和删除验收。
8. 本说明书与 active law 只在授权人分别明确批准对应修改后变更。
9. 任一 finding、候选漂移、错误证据类型或无事实依据的 PASS 必须失败关闭。
